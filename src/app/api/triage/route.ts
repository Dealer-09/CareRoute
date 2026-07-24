import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { emergencyPreCheck } from '@/lib/emergency'
import { matchSpecialty } from '@/lib/specialty'
import type { TriageResult } from '@/types/triage'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ─── Strict JSON Schema ───────────────────────────────────────────────────────
// Gemini enforces this at generation time — it physically cannot produce a
// response that violates this shape. No more manual ?? fallbacks needed.
const TRIAGE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    severity: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['Green', 'Amber', 'Red'],
      description: 'Triage severity level',
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
  },
  required: [
    'severity',
    'condition_guess',
    'summary',
    'reasoning',
    'redFlags',
    'recommended_specialty',
    'specialty_reason',
    'advice',
  ],
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// Clinical rules are explicit — not vague. Each severity tier has named signals.
const SYSTEM_PROMPT = `You are CareRoute, a clinical triage assistant. Your role is to assess symptom severity and route patients to the correct care. You do NOT diagnose — you triage.

SEVERITY RULES (apply strictly in order):

RED — Patient needs care TODAY. Use when ANY of:
• Chest pain or tightness (especially with sweating, jaw/arm pain, nausea, breathlessness)
• Severe difficulty breathing or cyanosis (blue lips/fingertips)
• Sudden confusion, loss of consciousness, or fainting
• Suspected stroke (face droop, arm weakness, slurred speech, sudden severe headache)
• Active seizure or convulsion
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
• Never give a definitive diagnosis — use phrases like "possibly", "consistent with", "may indicate"`

// ─── Safe Amber Fallback ──────────────────────────────────────────────────────
// Returned when Gemini is unavailable or returns an unexpected error.
// Conservative (Amber not Green) because we don't know what was wrong.
function amberFallback(text: string, errorReason: string): TriageResult {
  console.error('[/api/triage] Falling back to Amber:', errorReason)
  const specialtyMatch = matchSpecialty(text)
  return {
    severity: 'Amber',
    emergency: false,
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

    if (!text || text.trim().length < 15) {
      return NextResponse.json(
        { error: 'Symptom description too short (minimum 15 characters)' },
        { status: 400 }
      )
    }

    // ─── Step 1: Emergency Pre-Check ──────────────────────────────────────────
    // Deterministic safety net. Runs before any LLM call.
    // If it fires → return Red immediately, no Gemini call.
    const emergency = emergencyPreCheck(text, flags)

    if (emergency.triggered) {
      const result: TriageResult = {
        severity: 'Red',
        emergency: true,
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
        timestamp: Date.now(),
      }
      return NextResponse.json(result)
    }

    // ─── Step 2: Gemini LLM Triage ────────────────────────────────────────────
    // Strict schema enforced at generation time — Gemini cannot return
    // a malformed response. JSON.parse is still guarded but should never throw.
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: TRIAGE_SCHEMA,
        temperature: 0.2, // Low temperature = more deterministic, clinical responses
      },
    })

    const userPrompt = `PATIENT SYMPTOM REPORT:

Description: "${text.trim()}"
Duration: ${duration}
Critical flags checked by patient: ${flags.length > 0 ? flags.join(', ') : 'None'}

Apply the severity rules strictly. Provide your triage assessment.`

    let parsed: {
      severity: TriageResult['severity']
      condition_guess: string
      summary: string
      reasoning: string[]
      redFlags: string[]
      recommended_specialty: string
      specialty_reason: string
      advice: string
    }

    try {
      const geminiResult = await model.generateContent(userPrompt)
      parsed = JSON.parse(geminiResult.response.text())
    } catch (geminiError) {
      // Gemini failed or returned unparseable output — return safe fallback
      return NextResponse.json(
        amberFallback(text, String(geminiError))
      )
    }

    // Validate severity is one of our known values (extra safety)
    const validSeverities: TriageResult['severity'][] = ['Green', 'Amber', 'Red']
    if (!validSeverities.includes(parsed.severity)) {
      return NextResponse.json(amberFallback(text, `Invalid severity: ${parsed.severity}`))
    }

    // ─── Step 3: Deterministic Specialty Override ──────────────────────────────
    // Our lookup table takes precedence over the LLM's specialty suggestion.
    // Specialty routing is solved knowledge — not something a model should guess.
    const specialtyMatch = matchSpecialty(text, parsed.recommended_specialty)

    const result: TriageResult = {
      severity: parsed.severity,
      emergency: false,
      condition_guess: parsed.condition_guess,
      summary: parsed.summary,
      reasoning: parsed.reasoning,
      redFlags: parsed.redFlags,
      recommended_specialty: specialtyMatch.specialty,
      specialty_reason: specialtyMatch.reason,
      advice: parsed.advice,
      timestamp: Date.now(),
    }

    return NextResponse.json(result)
  } catch (error) {
    // Top-level catch — unexpected errors (network, auth, etc.)
    console.error('[/api/triage] Unexpected error:', error)
    return NextResponse.json(amberFallback(text, String(error)))
  }
}
