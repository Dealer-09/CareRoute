/**
 * Shared symptom duration options.
 *
 * Single source of truth used by:
 *   - TriageWizard (dropdown labels)
 *   - /api/triage route.ts (hours conversion)
 *
 * Using a structured map eliminates the fragile string-includes() chain that
 * previously broke on en-dash vs hyphen differences between the UI labels and
 * the parser.
 */

export interface DurationOption {
  label: string  // Displayed in the UI dropdown
  hours: number  // Canonical hours value used by the clinical engines
}

export const DURATION_OPTIONS: DurationOption[] = [
  { label: 'Hours',      hours: 6   },
  { label: '1–3 days',  hours: 48  },
  { label: '4–7 days',  hours: 120 },
  { label: '1–4 weeks', hours: 336 },
  { label: '>1 month',  hours: 720 },
]

/** Array of label strings for use in the UI select element */
export const DURATION_LABELS = DURATION_OPTIONS.map(d => d.label)

/**
 * Convert a duration label to hours.
 * Falls back to 24 h if the label is not found (safe default).
 */
export function durationLabelToHours(label: string | undefined): number {
  if (!label) return 24
  const match = DURATION_OPTIONS.find(d => d.label === label)
  return match ? match.hours : 24
}
