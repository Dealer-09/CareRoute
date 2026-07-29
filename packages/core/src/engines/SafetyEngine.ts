import { PatientPresentation } from '../types/clinical';

export type SafetyEvaluationResult = 
  | { action: 'ROUTE_RED'; reason: string; ruleTriggered: string }
  | { action: 'REJECT_INVALID_DATA'; reason: string; ruleTriggered: string }
  | { action: 'PROCEED_TO_OOD'; rulesTriggered: string[] };

/**
 * ENGINE 4: Deterministic Safety Engine
 * 
 * This engine acts as the absolute safety gateway. It guarantees that the 
 * Machine Learning models (Engine 6) never receive impossible data (e.g. SpO2 = 840%) 
 * and never attempt to predict on obvious, catastrophic emergencies.
 */
export class SafetyEngine {
  
  public evaluate(patient: PatientPresentation): SafetyEvaluationResult {
    // 1. Schema & Plausibility Validation
    const plausibilityCheck = this.checkPhysiologicalPlausibility(patient);
    if (plausibilityCheck) return plausibilityCheck;

    // 2. Deterministic Red Flags
    const redFlagCheck = this.evaluateRedFlags(patient);
    if (redFlagCheck) return redFlagCheck;

    // If all checks pass, we proceed to Engine 5 (OOD Engine)
    return { 
      action: 'PROCEED_TO_OOD', 
      rulesTriggered: ['NONE'] 
    };
  }

  /**
   * Rejects physically impossible data to prevent ML hallucination or division-by-zero errors.
   */
  private checkPhysiologicalPlausibility(patient: PatientPresentation): SafetyEvaluationResult | null {
    const { vitals } = patient;

    if (vitals.spo2Percent !== undefined && (vitals.spo2Percent < 0 || vitals.spo2Percent > 100)) {
      return { action: 'REJECT_INVALID_DATA', reason: `SpO2 ${vitals.spo2Percent}% is physically impossible`, ruleTriggered: 'PLAUSIBILITY_SPO2' };
    }
    
    if (vitals.heartRateBpm !== undefined && (vitals.heartRateBpm <= 0 || vitals.heartRateBpm > 300)) {
      return { action: 'REJECT_INVALID_DATA', reason: `Heart rate ${vitals.heartRateBpm} BPM is physiologically implausible`, ruleTriggered: 'PLAUSIBILITY_HR' };
    }

    if (vitals.temperatureCelsius !== undefined && (vitals.temperatureCelsius < 20 || vitals.temperatureCelsius > 45)) {
      return { action: 'REJECT_INVALID_DATA', reason: `Temperature ${vitals.temperatureCelsius}°C is physically impossible for a living human`, ruleTriggered: 'PLAUSIBILITY_TEMP' };
    }

    if (vitals.systolicBp !== undefined && vitals.diastolicBp !== undefined) {
      if (vitals.diastolicBp >= vitals.systolicBp) {
        return { action: 'REJECT_INVALID_DATA', reason: `Diastolic BP cannot be >= Systolic BP`, ruleTriggered: 'PLAUSIBILITY_BP_INVERSION' };
      }
    }

    return null; // Passed plausibility
  }

  /**
   * Evaluates monotonic safety constraints. If these are met, the patient is 
   * instantly routed to RED without consulting any ML models.
   */
  private evaluateRedFlags(patient: PatientPresentation): SafetyEvaluationResult | null {
    const { redFlags, vitals } = patient;

    // A. Explicit Boolean Red Flags (Derived from UI triage questions)
    if (redFlags.unconsciousOrUnresponsive) {
      return { action: 'ROUTE_RED', reason: 'Patient is unconscious or unresponsive', ruleTriggered: 'RED_FLAG_UNCONSCIOUS' };
    }
    if (redFlags.severeBreathingDifficulty) {
      return { action: 'ROUTE_RED', reason: 'Patient reporting severe breathing difficulty', ruleTriggered: 'RED_FLAG_BREATHING' };
    }
    if (redFlags.activeHeavyBleeding) {
      return { action: 'ROUTE_RED', reason: 'Patient reporting active heavy bleeding', ruleTriggered: 'RED_FLAG_BLEEDING' };
    }
    if (redFlags.suddenSevereChestPain) {
      return { action: 'ROUTE_RED', reason: 'Patient reporting sudden severe chest pain — possible cardiac event', ruleTriggered: 'RED_FLAG_CHEST_PAIN' };
    }
    if (redFlags.newOnsetParalysisOrSlurredSpeech) {
      return { action: 'ROUTE_RED', reason: 'New onset paralysis or slurred speech detected — possible stroke (CVA)', ruleTriggered: 'RED_FLAG_STROKE' };
    }

    // B. Monotonic Vital Sign Collapse Constraints
    if (vitals.spo2Percent !== undefined && vitals.spo2Percent < 90) {
      return { action: 'ROUTE_RED', reason: `Critical Hypoxia: SpO2 is ${vitals.spo2Percent}%`, ruleTriggered: 'VITAL_SPO2_COLLAPSE' };
    }

    if (vitals.systolicBp !== undefined && vitals.systolicBp < 90) {
      return { action: 'ROUTE_RED', reason: `Critical Hypotension: Systolic BP is ${vitals.systolicBp}`, ruleTriggered: 'VITAL_BP_COLLAPSE' };
    }

    if (vitals.heartRateBpm !== undefined && (vitals.heartRateBpm > 130 || vitals.heartRateBpm < 40)) {
      return { action: 'ROUTE_RED', reason: `Critical Arrhythmia/Tachycardia risk: HR is ${vitals.heartRateBpm}`, ruleTriggered: 'VITAL_HR_CRITICAL' };
    }

    return null; // No red flags triggered
  }
}
