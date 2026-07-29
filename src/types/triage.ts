export type Severity = 'Green' | 'Amber' | 'Red'

/**
 * The canonical triage result type used across the whole app.
 * Produced by the API route (/api/triage) and stored in history.
 * Every field is required to surface in the UI — no black-box verdicts.
 */
export type TriageResult = {
  // Core assessment
  id: string
  severity: Severity
  emergency: boolean           // true = emergency pre-check fired (bypassed LLM)
  condition_guess: string      // e.g. "Upper respiratory infection"
  summary: string              // one-sentence summary

  // Explainability — why this result was produced
  reasoning: string[]          // list of reasons (from LLM or pre-check)
  redFlags: string[]           // specific red flag phrases detected

  // Confidence (0–100) — how certain the model is about this severity level
  confidence?: number

  // Routing
  recommended_specialty: string  // e.g. "Pulmonology"
  specialty_reason: string       // why this specialty was chosen (shown in UI)

  // Action
  advice: string               // what the patient should do next

  // Green-specific — concrete self-care steps + when to escalate
  self_care?: string[]         // e.g. ["Rest and hydrate", "Take paracetamol if needed"]
  escalation_signs?: string[]  // e.g. ["If fever exceeds 39°C, see a doctor"]

  // PubMed citations (fetched client-side after result)
  pubmed_citations?: { title: string; url: string }[]

  // Metadata
  timestamp?: number
  duration?: string
  files?: string[],
  symptom_text?: string
}
