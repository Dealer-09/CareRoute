/**
 * Deterministic emergency pre-check.
 *
 * This runs BEFORE any LLM call and is independent of AI.
 * Its job: catch obvious life-threatening symptom patterns reliably and immediately.
 * It must never be "softened" or made more nuanced — it is the hard safety net.
 *
 * If this fires → skip Gemini → return emergency response immediately.
 */

/** Patterns where ANY keyword in `pattern` triggers immediately (no companion needed) */
const STANDALONE_PATTERNS: Array<{ keywords: string[]; label: string; flag: string }> = [
  {
    keywords: ['unable to breathe', 'cant breathe', "can't breathe", 'cannot breathe', 'blue lips', 'turning blue', 'lips are blue'],
    label: 'Severe breathing emergency — possible airway obstruction or respiratory failure',
    flag: 'Severe breathing difficulty',
  },
  {
    keywords: ['face droop', 'facial droop', 'face is drooping', 'slurred speech', 'slurring', 'one-sided weakness', 'arm weakness on one side', 'sudden confusion', 'sudden severe headache', 'worst headache of my life'],
    label: 'Possible stroke — F.A.S.T. signs detected (Face, Arms, Speech, Time)',
    flag: 'Neurological emergency (stroke)',
  },
  {
    keywords: ['seizure', 'convulsion', 'convulsing', 'fitting', 'epileptic'],
    label: 'Active seizure detected',
    flag: 'Seizure',
  },
  {
    keywords: ['uncontrolled bleeding', 'bleeding that won\'t stop', 'bleeding won\'t stop', 'severe bleeding', 'blood won\'t stop', 'major bleeding'],
    label: 'Uncontrolled bleeding — possible haemorrhagic emergency',
    flag: 'Severe bleeding',
  },
  {
    keywords: ['heart attack', 'cardiac arrest', 'cardiac event'],
    label: 'Patient reports suspected cardiac event',
    flag: 'Cardiac emergency',
  },
]

const CHEST_KEYWORDS = ['chest pain', 'chest tightness', 'tight chest', 'pressure in chest', 'chest pressure']
const CHEST_COMPANIONS = ['sweating', 'sweat', 'arm pain', 'jaw pain', 'nausea', 'shortness of breath', 'breathless', 'unable to breathe', 'radiating']

/** Checkbox flags from the TriageWizard that immediately trigger emergency */
const CRITICAL_FLAGS = [
  'Chest pain',
  'Severe shortness of breath',
  'Fainting/confusion',
  'One-sided weakness/face droop',
  'Bleeding that won\'t stop',
]

export type EmergencyCheckResult = {
  triggered: boolean
  reasons: string[]
  redFlags: string[]
}

export function emergencyPreCheck(text: string, flags: string[]): EmergencyCheckResult {
  const lower = text.toLowerCase()
  const reasons: string[] = []
  const redFlagSet = new Set<string>()

  // Check standalone patterns
  for (const { keywords, label, flag } of STANDALONE_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) {
      reasons.push(label)
      redFlagSet.add(flag)
    }
  }

  // Chest pain requires an associated symptom to be emergency-tier
  if (CHEST_KEYWORDS.some(k => lower.includes(k)) && CHEST_COMPANIONS.some(c => lower.includes(c))) {
    reasons.push('Chest pain with associated symptoms — possible acute cardiac event (STEMI/ACS)')
    redFlagSet.add('Chest pain with cardiac features')
  }

  // User-checked critical flags always trigger, regardless of text
  const triggeredFlags = flags.filter(f => CRITICAL_FLAGS.includes(f))
  if (triggeredFlags.length > 0) {
    reasons.push(`Patient confirmed critical symptom(s): ${triggeredFlags.join(', ')}`)
    triggeredFlags.forEach(f => redFlagSet.add(f))
  }

  return {
    triggered: reasons.length > 0,
    reasons,
    redFlags: Array.from(redFlagSet),
  }
}
