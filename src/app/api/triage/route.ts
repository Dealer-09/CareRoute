import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { emergencyPreCheck } from '@/lib/emergency'
import { matchSpecialty } from '@/lib/specialty'
import type { TriageResult } from '@/types/triage'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { text, duration, flags } = await req.json()

    if (!text || text.trim().length < 15) {
      return NextResponse.json(
        { error: 'Symptom description too short (minimum 15 characters)' },
        { status: 400 }
      )
    }

    // ─── Step 1: Emergency Pre-Check ────────────────────────────────────────
    // This runs BEFORE the LLM, independent of AI. If it fires, we return
    // immediately — the LLM is never called for emergency-tier cases.
    const emergency = emergencyPreCheck(text, flags ?? [])

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

    // ─── Step 2: Gemini LLM Triage ──────────────────────────────────────────
    // Only reached if no emergency pattern was detected above.
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const prompt = `You are a medical triage assistant. Your job is to assess symptom severity and route patients to the right care. You do NOT diagnose — you triage.

PATIENT INPUT:
Symptom description: "${text}"
Duration: ${duration}
Critical flags checked by patient: ${flags?.length ? flags.join(', ') : 'None'}

Respond with a JSON object containing EXACTLY these fields:
{
  "severity": "Green" | "Amber" | "Red",
  "condition_guess": "string (1–5 words, e.g. 'Upper respiratory infection', 'Possible appendicitis')",
  "summary": "string (one clear sentence summarising the overall assessment)",
  "reasoning": ["string", "string", "string"] (2–4 items explaining WHY you assigned this severity),
  "redFlags": ["string"] (list any red flag symptoms mentioned, empty array if none),
  "recommended_specialty": "string (single medical specialty, e.g. 'Pulmonology')",
  "specialty_reason": "string (one sentence: why this specialty for these symptoms)",
  "advice": "string (concrete, specific next steps the patient should take)"
}

TRIAGE RULES:
- Green: mild symptoms, self-care at home is appropriate, no urgent action needed
- Amber: symptoms need clinical review within 24–48 hours, should not be ignored
- Red: symptoms suggest urgent or emergency care is needed TODAY
- When in doubt between Green and Amber → choose Amber (conservative is safer)
- When in doubt between Amber and Red → choose Red
- reasoning must clearly explain what in the input drove the severity decision
- Do NOT claim to diagnose; suggest likely condition categories only
- advice must be specific and actionable, not generic`

    const geminiResult = await model.generateContent(prompt)
    const responseText = geminiResult.response.text()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(responseText)
    } catch {
      throw new Error('Gemini returned non-JSON response')
    }

    // ─── Step 3: Deterministic Specialty Override ────────────────────────────
    // The LLM suggests a specialty, but our lookup table takes precedence.
    // This is a deliberate architectural choice from plan.md — specialty
    // routing is solved knowledge, not something a model should guess.
    const specialtyMatch = matchSpecialty(text, parsed.recommended_specialty as string)

    const result: TriageResult = {
      severity: (parsed.severity as TriageResult['severity']) ?? 'Amber',
      emergency: false,
      condition_guess: (parsed.condition_guess as string) ?? 'Unspecified condition',
      summary: (parsed.summary as string) ?? '',
      reasoning: (parsed.reasoning as string[]) ?? [],
      redFlags: (parsed.redFlags as string[]) ?? [],
      recommended_specialty: specialtyMatch.specialty,
      specialty_reason: specialtyMatch.reason,
      advice: (parsed.advice as string) ?? '',
      timestamp: Date.now(),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[/api/triage] Error:', error)
    return NextResponse.json(
      { error: 'Unable to process triage request. Please check your API key and try again.' },
      { status: 500 }
    )
  }
}
