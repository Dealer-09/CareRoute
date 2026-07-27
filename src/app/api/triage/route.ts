import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { emergencyPreCheck } from '@/lib/emergency'
import { matchSpecialty } from '@/lib/specialty'
import type { TriageResult } from '@/types/triage'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ─── Strict JSON Schema ───────────────────────────────────────────────────────
const TRIAGE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    severity: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['Green', 'Amber', 'Red'],
      description: 'Triage severity level',
    },
    confidence: {
      type: SchemaType.INTEGER,
      description: 'Confidence in this severity level, 0–100. Be honest — if symptoms are ambiguous, score lower (50–70). If clear-cut, score higher (85–99).',
    },
    condition_guess: {
      type: SchemaType.STRING,
      description: '1–5 word likely condition category. Not a diagnosis.',
    },
    summary: {
      type: SchemaType.STRING,
      description: 'One clear sentence summarising the triage assessment.',
    },
    reasoning: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '2–4 specific reasons that drove the severity decision.',
    },
    redFlags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Red flag symptoms detected. Empty array if none.',
    },
    recommended_specialty: {
      type: SchemaType.STRING,
      description: 'Single medical specialty name.',
    },
    specialty_reason: {
      type: SchemaType.STRING,
      description: 'One sentence: why this specialty for these symptoms.',
    },
    advice: {
      type: SchemaType.STRING,
      description: 'Concrete, specific next steps the patient should take now.',
    },
    self_care: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'For GREEN cases: 2–4 specific self-care steps (e.g. "Drink 2–3 litres of water daily"). Empty array for Amber/Red.',
    },
    escalation_signs: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'For GREEN cases: 2–3 specific signs that mean they should seek care (e.g. "If fever exceeds 39°C"). Empty array for Amber/Red.',
    },
  },
  required: [
    'severity',
    'confidence',
    'condition_guess',
    'summary',
    'reasoning',
    'redFlags',
    'recommended_specialty',
    'specialty_reason',
    'advice',
    'self_care',
    'escalation_signs',
  ],
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are CareRoute, a clinical triage assistant for Indian patients. Your role is to assess symptom severity and route patients to the correct care. You do NOT diagnose — you triage.

CULTURAL CONTEXT — INDIAN PATIENT IDIOMS:
Patients may describe symptoms using Indian English idioms or colloquial expressions. Interpret these clinically:
• "motions" / "loose motions" = diarrhoea
• "urine burning" / "burning micturition" = dysuria (possible UTI)
• "acidity" / "gas problem" = dyspepsia, GERD, or bloating
• "body pain" = myalgia (generalised muscle ache — often viral)
• "weakness" / "fatigue all over" = generalised asthenia
• "BP problem" = hypertension or hypotension
• "sugar problem" / "sugar high" = hyperglycaemia / diabetes concern
• "stomach upset" = nausea, vomiting, or abdominal discomfort
• "heaviness in chest" = may indicate cardiac or anxiety origin — treat as Amber minimum
• "fits" = seizure / convulsion — treat as Red
• "giddiness" / "giddyness" = dizziness or vertigo
• "numbness-tingling" = paraesthesia
• "neck pain going to hand" = possible cervical radiculopathy

SEVERITY RULES (apply strictly in order):

RED — Patient needs care TODAY. Use when ANY of:
• Chest pain or tightness (especially with sweating, jaw/arm pain, nausea, breathlessness)
• Severe difficulty breathing or cyanosis (blue lips/fingertips)
• Sudden confusion, loss of consciousness, or fainting
• Suspected stroke (face droop, arm weakness, slurred speech, sudden severe headache)
• Active seizure / "fits"
• Uncontrolled bleeding
• Severe abdominal rigidity or sudden sharp abdominal pain (possible perforation)
• Symptoms rapidly worsening over minutes to hours
• High fever (>39°C) with stiff neck, photophobia, or rash (possible meningitis)
• Diabetic — very high or very low blood sugar with altered consciousness
• Suicidal ideation or immediate psychiatric emergency

AMBER — Needs clinical review within 24–48 hours. Use when:
• Moderate pain not severe enough for Red, but not resolving with rest/OTC meds
• Fever persisting >72 hours in adults, >48 hours in children
• Symptoms interfering with daily activities (eating, sleeping, working)
• Worsening trend over days — not improving with self-care
• New unexplained symptoms lasting >1 week
• Respiratory infection with productive cough lasting >3 weeks (TB screening)
• Any symptom in pregnancy that would be Amber or above
• Chronic condition (diabetes, asthma, hypertension) showing unusual pattern
• "Heaviness in chest" or cardiac-sounding symptoms in any age group

GREEN — Self-care appropriate. Use when:
• Mild, short-duration symptoms (<72 hours)
• Improving trend on self-care (rest, fluids, OTC medication)
• No fever or low-grade fever (<38°C) in otherwise healthy adult
• Symptoms do not interfere significantly with daily function
• Known condition following expected pattern

ESCALATION RULE: When in doubt between two levels → choose the higher one. False positives are safer than false negatives in triage.

ADVICE RULES:
• Red: Lead with "Seek emergency care now" or "Call 112"
• Amber: State a specific timeframe ("See a doctor within 24 hours")
• Green: Give concrete self-care steps (hydration, rest, specific OTC options if relevant)
• Never say "monitor symptoms" without a follow-up condition ("If X worsens, go to Y")
• Never give a definitive diagnosis — use phrases like "possibly", "consistent with", "may indicate"

GREEN REASSURANCE:
For Green cases, self_care must have 2–4 specific actionable steps (not vague). escalation_signs must include exactly when to seek help (specific thresholds, not "if it gets worse").`

// ─── Safe Amber Fallback ──────────────────────────────────────────────────────
function amberFallback(text: string, errorReason: string): TriageResult {
  console.error('[/api/triage] Falling back to Amber:', errorReason)
  const specialtyMatch = matchSpecialty(text)
  return {
    severity: 'Amber',
    emergency: false,
    confidence: 50,
    condition_guess: 'Unable to assess',
    summary:
      'Our AI triage system encountered an issue. As a precaution, we recommend seeing a doctor within 24–48 hours.',
    reasoning: [
      'AI triage was unavailable — conservative Amber assigned by default',
      'Please describe your symptoms to a clinician directly',
    ],
    redFlags: [],
    recommended_specialty: specialtyMatch.specialty,
    specialty_reason: specialtyMatch.reason,
    advice:
      'Because automated triage could not complete, please see a doctor within 24 hours to be assessed in person. If your symptoms worsen significantly or you experience chest pain, difficulty breathing, or loss of consciousness, call 112 immediately.',
    self_care: [],
    escalation_signs: [],
    timestamp: Date.now(),
  }
}

export async function POST(req: NextRequest) {
  let text = ''

  try {
    const body = await req.json()
    text = body.text ?? ''
    const duration: string = body.duration ?? 'Not specified'
    const flags: string[] = body.flags ?? []
    const vitals = body.vitals ?? {}

    // Build optional vitals string for Gemini
    const vitalsLines: string[] = []
    if (vitals.heartRate)     vitalsLines.push(`Heart Rate: ${vitals.heartRate} bpm`)
    if (vitals.spo2)          vitalsLines.push(`SpO₂: ${vitals.spo2}%`)
    if (vitals.temperature)   vitalsLines.push(`Temperature: ${vitals.temperature}°C`)
    if (vitals.bloodPressure) vitalsLines.push(`Blood Pressure: ${vitals.bloodPressure} mmHg`)
    const vitalsSection = vitalsLines.length > 0
      ? `\nVitals provided by patient:\n${vitalsLines.map(l => `• ${l}`).join('\n')}`
      : ''
    const dependent = body.dependent ?? null

    // Build optional demographics section for the AI prompt (caregiver triage)
    let demographicsSection = ''
    if (dependent) {
      const age = dependent.date_of_birth
        ? Math.floor((Date.now() - new Date(dependent.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : null
      const genderMap: Record<string, string> = { M: 'Male', F: 'Female', Other: 'Other' }
      const parts: string[] = [
        `Patient Name: ${dependent.name}`,
        ...(age !== null ? [`Age: ${age} years`] : []),
        ...(dependent.gender ? [`Gender: ${genderMap[dependent.gender] ?? dependent.gender}`] : []),
        `Relationship to reporter: ${dependent.relationship}`,
      ]
      demographicsSection = `\nPatient Demographics (reported by caregiver):\n${parts.map(p => `• ${p}`).join('\n')}\nNote: Adjust advice appropriately for the patient's age.`
    }

    if (!text || text.trim().length < 15) {
      return NextResponse.json(
        { error: 'Symptom description too short (minimum 15 characters)' },
        { status: 400 }
      )
    }

    // ─── Step 1: Emergency Pre-Check ──────────────────────────────────────────
    const emergency = emergencyPreCheck(text, flags)

    if (emergency.triggered) {
      const result: TriageResult = {
        severity: 'Red',
        emergency: true,
        confidence: 99,
        condition_guess: 'Possible Emergency Condition',
        summary:
          'Your symptoms match a pattern that requires immediate emergency medical attention. Do not wait.',
        reasoning: emergency.reasons,
        redFlags: emergency.redFlags,
        recommended_specialty: 'Emergency Medicine',
        specialty_reason:
          'Emergency pre-check triggered — bypass specialist routing. Go to the nearest ER.',
        advice:
          'Call emergency services (112) immediately or go to the nearest Emergency Room. Do not drive yourself. If you are alone, leave your door unlocked and call 112 now.',
        self_care: [],
        escalation_signs: [],
        timestamp: Date.now(),
      }
      return NextResponse.json(result)
    }

    // ─── Step 2: Gemini LLM Triage ────────────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: TRIAGE_SCHEMA,
        temperature: 0.2,
      },
    })

    const userPrompt = `PATIENT SYMPTOM REPORT:

Description: "${text.trim()}"
Duration: ${duration}
Critical flags checked by patient: ${flags.length > 0 ? flags.join(', ') : 'None'}${vitalsSection}${demographicsSection}

Apply the severity rules strictly. Provide your triage assessment.`

    let parsed: {
      severity: TriageResult['severity']
      confidence: number
      condition_guess: string
      summary: string
      reasoning: string[]
      redFlags: string[]
      recommended_specialty: string
      specialty_reason: string
      advice: string
      self_care: string[]
      escalation_signs: string[]
    }

    try {
      const geminiResult = await model.generateContent(userPrompt)
      parsed = JSON.parse(geminiResult.response.text())
    } catch (geminiError) {
      return NextResponse.json(amberFallback(text, String(geminiError)))
    }

    const validSeverities: TriageResult['severity'][] = ['Green', 'Amber', 'Red']
    if (!validSeverities.includes(parsed.severity)) {
      return NextResponse.json(amberFallback(text, `Invalid severity: ${parsed.severity}`))
    }

    // ─── Step 3: Deterministic Specialty Override ──────────────────────────────
    const specialtyMatch = matchSpecialty(text, parsed.recommended_specialty)

    const result: TriageResult = {
      severity: parsed.severity,
      emergency: parsed.severity === 'Red',
      confidence: Math.min(100, Math.max(0, parsed.confidence ?? 75)),
      condition_guess: parsed.condition_guess,
      summary: parsed.summary,
      reasoning: parsed.reasoning,
      redFlags: parsed.redFlags,
      recommended_specialty: specialtyMatch.specialty,
      specialty_reason: specialtyMatch.reason,
      advice: parsed.advice,
      self_care: parsed.self_care ?? [],
      escalation_signs: parsed.escalation_signs ?? [],
      timestamp: Date.now(),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[/api/triage] Unexpected error:', error)
    return NextResponse.json(amberFallback(text, String(error)))
  }
}
