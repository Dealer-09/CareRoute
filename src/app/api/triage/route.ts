import { NextRequest, NextResponse } from 'next/server'
import { TriagePipeline } from '../../../lib/pipeline/TriagePipeline'
import { PatientPresentation } from '@careroute/core'
import { emergencyPreCheck } from '../../../lib/emergency'
import { matchSpecialty } from '../../../lib/specialty'
import { durationLabelToHours } from '../../../lib/durations'
import { normaliseIndicSymptoms } from '../../../lib/indicNormalizer'

// Initialize the V2 pipeline (Zero internet required)
const v2Pipeline = new TriagePipeline()
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawText: string = body.text ?? ''
    
    if (!rawText || rawText.trim().length < 15) {
      return NextResponse.json(
        { error: 'Symptom description too short (minimum 15 characters)' },
        { status: 400 }
      )
    }
    
    if (rawText.length > 2000) {
      return NextResponse.json(
        { error: 'Symptom description too long (maximum 2000 characters)' },
        { status: 400 }
      )
    }

    // Normalise Hinglish / Hindi idioms into English clinical equivalents.
    // Pure English input passes through unchanged. The normalised text is used
    // for all downstream keyword matching — the original is preserved inside it.
    const text = normaliseIndicSymptoms(rawText)

    const parseNum = (val: string | number | undefined, isFloat = false): number | undefined => {
      if (val === undefined || val === null || val === '') return undefined;
      const n = isFloat ? parseFloat(String(val)) : parseInt(String(val), 10);
      return isNaN(n) || !isFinite(n) ? undefined : n;
    };

    // ── V1 EMERGENCY FALLBACK ──
    // Because V2 XGBoost is mocked, we retain the V1 deterministic emergency check to ensure safety!
    const emergencyCheck = emergencyPreCheck(text, body.flags || [])
    if (emergencyCheck.triggered) {
      const emergencyRecord = {
        recordId: `DR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        patientIdHash: 'emergency_precheck',
        versions: {
          visionModel:    'donut-rxhandbd-1.0',
          entityResolver: 'not-implemented',
          triageModel:    'emergency-precheck-v1',
          oodModel:       'not-invoked',
          pkbDatabase:    'tata-1mg-251k-2026.07',
          ruleEngine:     'emergency-precheck-v1',
        },
        scores: { ocrConfidence: 0, entityResolutionConfidence: 0, semanticOodDistance: 0, tabularOodDistance: 0 },
        rulesTriggered: emergencyCheck.redFlags,
        triageProbabilityRed: 1.0,
        triageProbabilityAmber: 0,
        triageProbabilityGreen: 0,
        finalDecision: 'Red' as const,
        abstained: false,
      }
      return NextResponse.json({
        severity: 'Red',
        emergency: true,
        confidence: 100,
        condition_guess: 'Possible Emergency Condition',
        summary: `Immediate medical attention is recommended based on your symptoms: ${emergencyCheck.reasons.join('; ')}`,
        reasoning: emergencyCheck.reasons,
        redFlags: emergencyCheck.redFlags,
        recommended_specialty: 'Emergency Medicine',
        specialty_reason: 'Emergency symptoms detected.',
        advice: 'Seek emergency medical attention immediately or call an ambulance.',
        self_care: [],
        escalation_signs: [],
        timestamp: Date.now(),
        decision_record: emergencyRecord,
      })
    }

    // Server-side demographics lookup (TD-14)
    let calculatedAge = 30; // Fallback adult baseline
    let calculatedSex: 'MALE' | 'FEMALE' | 'OTHER' = 'OTHER';
    
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        if (body.dependent) {
          // body.dependent is the full dependent object sent by TriageWizard
          const depId: string = typeof body.dependent === 'object' ? body.dependent.id : body.dependent
          const depRes = await fetch(`${BACKEND_URL}/api/dependents`, { headers: { 'Authorization': authHeader } });
          if (depRes.ok) {
            const data = await depRes.json();
            const dep = data.dependents?.find((d: { id: string; date_of_birth: string | null; gender: string | null }) => d.id === depId);
            if (dep?.date_of_birth) {
              calculatedAge = Math.floor((Date.now() - new Date(dep.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
              calculatedSex = dep.gender === 'M' ? 'MALE' : (dep.gender === 'F' ? 'FEMALE' : 'OTHER');
            }
          }
        } else {
          // GET /api/profile returns a flat object: { id, name, date_of_birth, gender, ... }
          const profRes = await fetch(`${BACKEND_URL}/api/profile`, { headers: { 'Authorization': authHeader } });
          if (profRes.ok) {
            const data = await profRes.json();
            if (data.date_of_birth) {
              calculatedAge = Math.floor((Date.now() - new Date(data.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
              calculatedSex = data.gender === 'M' ? 'MALE' : (data.gender === 'F' ? 'FEMALE' : 'OTHER');
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch server-side demographics, falling back to defaults:', err);
      }
    } else {
      // Guest triage fallback
      if (typeof body.dependent === 'object' && body.dependent?.date_of_birth) {
        calculatedAge = Math.floor((Date.now() - new Date(body.dependent.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      } else if (body.age) {
        calculatedAge = body.age;
      }
      calculatedSex = (typeof body.dependent === 'object' && body.dependent?.gender === 'M') ? 'MALE' :
                      (typeof body.dependent === 'object' && body.dependent?.gender === 'F') ? 'FEMALE' : 'OTHER';
    }

    // Extract user ID from JWT if present, otherwise guest
    let patientId = 'GUEST-' + Date.now()
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(atob(authHeader.split('.')[1]))
        if (payload?.id) patientId = payload.id
      } catch { /* guest fallback */ }
    }

    const patientPresentation: PatientPresentation = {
      patientId,
      age: calculatedAge,
      sex: calculatedSex,
      chiefComplaint: text,
      symptomDurationHours: durationLabelToHours(body.duration),
      vitals: {
        heartRateBpm: parseNum(body.vitals?.heartRate),
        spo2Percent: parseNum(body.vitals?.spo2),
        temperatureCelsius: parseNum(body.vitals?.temperature, true),
        systolicBp: body.vitals?.bloodPressure && body.vitals.bloodPressure.includes('/') ? parseNum(body.vitals.bloodPressure.split('/')[0]) : undefined,
        diastolicBp: body.vitals?.bloodPressure && body.vitals.bloodPressure.includes('/') ? parseNum(body.vitals.bloodPressure.split('/')[1]) : undefined,
      },
      redFlags: {
        unconsciousOrUnresponsive: body.flags?.includes('Fainting/confusion'),
        severeBreathingDifficulty: body.flags?.includes('Severe shortness of breath'),
        activeHeavyBleeding: body.flags?.includes("Bleeding that won't stop"),
        suddenSevereChestPain: body.flags?.includes('Chest pain'),
        newOnsetParalysisOrSlurredSpeech: body.flags?.includes('One-sided weakness/face droop')
      },
      context: {
        extractedMedications: [],
        knownAllergies: []
      }
    }

    // 2. Execute the V2 Six-Engine Architecture
    const result = await v2Pipeline.execute(patientPresentation)

    // 3. Map the V2 DecisionRecord back to the V1 frontend UI structure
    const urgency =
      patientPresentation.redFlags.unconsciousOrUnresponsive ||
      patientPresentation.redFlags.severeBreathingDifficulty ||
      patientPresentation.redFlags.suddenSevereChestPain ||
      patientPresentation.redFlags.activeHeavyBleeding ||
      patientPresentation.redFlags.newOnsetParalysisOrSlurredSpeech ? 'Red' :
      result.finalDecision === 'Red' || result.finalDecision === 'ESCALATED' ? 'Red' :
      result.finalDecision === 'Amber' ? 'Amber' : 'Green';

    // Derive a meaningful condition label from the specialty match rather than
    // exposing internal rule engine strings like "No severe rules triggered".
    const specialtyMatch = matchSpecialty(text)
    
    // DETERMINISTIC NARRATIVE ENGINE (No LLM Required)
    let conditionGuess = '';
    let summary = '';
    
    if (result.abstained) {
      conditionGuess = 'Safety Override - Out of Distribution';
      summary = `The system has abstained from automatic triage: ${result.abstentionReason}. Your case has been escalated for manual doctor review.`;
    } else if (urgency === 'Red') {
      conditionGuess = `Critical Emergency (Suspected ${specialtyMatch.specialty} Issue)`;
      const ruleText = result.rulesTriggered.length > 0 ? ` triggered safety protocols (${result.rulesTriggered[0]})` : '';
      summary = `Your reported symptoms${ruleText} and indicate a severe condition. Immediate emergency medical evaluation is required.`;
    } else if (urgency === 'Amber') {
      conditionGuess = specialtyMatch.specialty === 'Cardiology' ? 'Cardiac/Circulatory Anomaly' :
                       specialtyMatch.specialty === 'Neurology' ? 'Neurological Concern' :
                       specialtyMatch.specialty === 'Pulmonology' ? 'Respiratory Irregularity' :
                       specialtyMatch.specialty === 'Gastroenterology' ? 'Gastrointestinal Distress' :
                       `${specialtyMatch.specialty} Condition - Urgent Review`;
      summary = `Based on your symptoms and vitals, we have detected signs requiring prompt medical attention. A specialist in ${specialtyMatch.specialty} should review your case within the next 24 hours.`;
    } else {
      conditionGuess = `Routine ${specialtyMatch.specialty} Condition`;
      summary = `Your reported symptoms appear stable. While not an immediate emergency, we recommend scheduling a routine checkup with a ${specialtyMatch.specialty} specialist.`;
    }

    // Confidence: derive from how decisive the probability spread is.
    // ESCALATED/abstained = 0. Rule engine gives high probability to one class (0.9)
    // and low to others (0.05), so confidence = winning probability × 100.
    const winningProb = Math.max(
      result.triageProbabilityRed,
      result.triageProbabilityAmber,
      result.triageProbabilityGreen
    )
    const confidence = result.abstained ? 0 : Math.round(winningProb * 100)

    const uiResponse = {
      severity: urgency,
      emergency: urgency === 'Red',
      confidence,
      condition_guess: conditionGuess,
      summary: summary,
      reasoning: result.rulesTriggered.length > 0 ? result.rulesTriggered : ['Analyzed mathematically via ML'],
      redFlags: result.rulesTriggered,
      recommended_specialty: specialtyMatch.specialty,
      specialty_reason: specialtyMatch.reason,
      advice: urgency === 'Red'
        ? 'Seek emergency medical attention immediately.'
        : urgency === 'Amber'
          ? 'Schedule a doctor appointment within 24 hours.'
          : 'Self care is appropriate at this time.',
      self_care: [],
      escalation_signs: [],
      timestamp: Date.now(),
      decision_record: result,
    }

    return NextResponse.json(uiResponse)

  } catch (error: unknown) {
    // REJECT_INVALID_DATA from SafetyEngine — bad vitals, not a server error
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'INVALID_PATIENT_DATA') {
      const e = error as { message: string }
      return NextResponse.json(
        { error: 'Invalid vital signs data', details: e.message },
        { status: 400 }
      )
    }
    console.error('[/api/triage] V2 Pipeline Error:', error)
    return NextResponse.json(
      { error: 'Triage processing failed', details: process.env.NODE_ENV !== 'production' ? String(error) : undefined },
      { status: 500 }
    )
  }
}
