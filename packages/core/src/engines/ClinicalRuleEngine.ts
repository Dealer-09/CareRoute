import { PatientPresentation, TriageUrgency } from '../types/clinical';

export interface RuleEvaluationResult {
  action: TriageUrgency;
  reason: string;
}

// Keyword clusters that should escalate to Amber when present in free text
// and no critical flag was checked. These are patterns the SafetyEngine
// (boolean flags + vitals) cannot catch from text alone.
const AMBER_TEXT_PATTERNS: Array<{ keywords: string[]; reason: string }> = [
  {
    keywords: ['chest pain', 'chest tightness', 'chest pressure', 'tight chest'],
    reason: 'Chest pain described in free text — cardiac cause not excluded',
  },
  {
    keywords: ['crushing', 'squeezing', 'pressure in chest', 'radiating pain'],
    reason: 'Cardiac-descriptive pain pattern in free text',
  },
  {
    keywords: ['weakness', 'face droop', 'facial droop', 'slurred', 'one side', 'one-sided'],
    reason: 'Neurological symptom pattern (possible CVA) in free text',
  },
  {
    keywords: ['severe headache', 'worst headache', 'thunderclap', 'sudden headache'],
    reason: 'Sudden severe headache — subarachnoid haemorrhage not excluded',
  },
  {
    keywords: ['can\'t breathe', 'cannot breathe', 'unable to breathe', 'no air', 'gasping'],
    reason: 'Severe dyspnoea described in free text',
  },
  {
    keywords: ['coughing blood', 'vomiting blood', 'blood in urine', 'rectal bleeding', 'black stool'],
    reason: 'Bleeding symptom pattern in free text',
  },
  {
    keywords: ['unconscious', 'passed out', 'blacked out', 'fainted', 'collapsed'],
    reason: 'Loss of consciousness described in free text',
  },
  {
    keywords: ['high fever', 'very high fever', 'fever 40', 'fever 41', 'fever 42', '104', '105'],
    reason: 'Very high fever described in free text',
  },
];

export class ClinicalRuleEngine {
  /**
   * Deterministic Manchester Triage / ESI inspired rule tree.
   * Now evaluates chiefComplaint text and boolean redFlags in addition to vitals.
   */
  public evaluate(patient: PatientPresentation): RuleEvaluationResult {
    const lower = patient.chiefComplaint.toLowerCase();

    // ── 0. Boolean red flags that reached this engine (SafetyEngine didn't catch them,
    //       meaning vitals were normal — but the flag is still a clinical concern) ──
    if (patient.redFlags.suddenSevereChestPain) {
      return { action: 'Amber', reason: 'Chest pain flag confirmed — requires urgent cardiac evaluation' };
    }
    if (patient.redFlags.newOnsetParalysisOrSlurredSpeech) {
      return { action: 'Amber', reason: 'Neurological symptom flag confirmed — urgent neurological assessment needed' };
    }
    if (patient.redFlags.unconsciousOrUnresponsive) {
      return { action: 'Amber', reason: 'Altered consciousness flag confirmed — urgent evaluation required' };
    }
    if (patient.redFlags.severeBreathingDifficulty) {
      return { action: 'Amber', reason: 'Severe breathing difficulty flag confirmed — urgent respiratory evaluation' };
    }
    if (patient.redFlags.activeHeavyBleeding) {
      return { action: 'Amber', reason: 'Active bleeding flag confirmed — urgent assessment required' };
    }

    // ── 1. Free-text Amber patterns (catches what vitals/flags alone cannot) ──
    for (const pattern of AMBER_TEXT_PATTERNS) {
      if (pattern.keywords.some(k => lower.includes(k))) {
        return { action: 'Amber', reason: pattern.reason };
      }
    }

    // ── 2. Vital-sign Amber rules ──

    // Fever > 38.5°C for more than 3 days
    if (patient.vitals.temperatureCelsius && patient.vitals.temperatureCelsius > 38.5 && patient.symptomDurationHours > 72) {
      return { action: 'Amber', reason: 'High fever persisting > 72 hours' };
    }

    // Elevated heart rate (below the RED threshold of 130 handled by SafetyEngine)
    if (patient.vitals.heartRateBpm && patient.vitals.heartRateBpm > 110) {
      return { action: 'Amber', reason: 'Elevated heart rate > 110 bpm' };
    }

    // Borderline SpO2 (90–94% — below 90% is RED in SafetyEngine)
    if (patient.vitals.spo2Percent && patient.vitals.spo2Percent >= 90 && patient.vitals.spo2Percent <= 94) {
      return { action: 'Amber', reason: 'Borderline SpO2 (90–94%)' };
    }

    // Stage 2 hypertension
    if (patient.vitals.systolicBp && patient.vitals.systolicBp >= 160) {
      return { action: 'Amber', reason: 'Severe hypertension (Systolic ≥ 160)' };
    }

    // ── 3. Duration rule ──
    if (patient.symptomDurationHours >= 168) {
      return { action: 'Amber', reason: 'Symptoms persisting ≥ 1 week' };
    }

    // ── 4. High-risk demographics ──
    if (patient.age < 1 || patient.age > 75) {
      return { action: 'Amber', reason: 'High-risk age demographic (< 1 or > 75 years)' };
    }

    // ── 5. Default Green ──
    return { action: 'Green', reason: 'No severe or moderate clinical indicators detected' };
  }
}
