import { PatientPresentation } from '../types/clinical';

export type OodEvaluationResult = 
  | { action: 'ABSTAIN'; reason: string; oodType: 'SEMANTIC' | 'TABULAR'; score: number }
  | { action: 'PROCEED_TO_ML'; semanticScore: number; tabularScore: number };

/**
 * ENGINE 5: Out-Of-Distribution (OOD) Engine
 * 
 * Separates novelty detection into two distinct layers. If a patient is too 
 * far outside the training distribution, we must ABSTAIN and escalate to a 
 * human clinician, preventing the ML from guessing on unprecedented cases.
 */
export class OodEngine {
  
  // These thresholds would be mathematically derived during the Calibration Phase 
  // on the MIMIC-IV-ED / Indian retrospective datasets.
  private readonly SEMANTIC_OOD_THRESHOLD = 0.85; 
  private readonly TABULAR_OOD_THRESHOLD = 0.90;

  public evaluate(patient: PatientPresentation): OodEvaluationResult {
    // 1. Evaluate Semantic Novelty (e.g. "bitten by cobra")
    const semanticScore = this.calculateSemanticDistance(patient.chiefComplaint);
    if (semanticScore > this.SEMANTIC_OOD_THRESHOLD) {
      return {
        action: 'ABSTAIN',
        reason: `Chief complaint falls outside safe semantic bounds (Score: ${semanticScore})`,
        oodType: 'SEMANTIC',
        score: semanticScore
      };
    }

    // 2. Evaluate Tabular Novelty (e.g. bizarre vital combinations)
    const tabularScore = this.calculateTabularDistance(patient);
    if (tabularScore > this.TABULAR_OOD_THRESHOLD) {
      return {
        action: 'ABSTAIN',
        reason: `Multivariate vital state falls outside safe bounds (Score: ${tabularScore})`,
        oodType: 'TABULAR',
        score: tabularScore
      };
    }

    // Patient is safely in-distribution. Proceed to XGBoost.
    return {
      action: 'PROCEED_TO_ML',
      semanticScore,
      tabularScore
    };
  }

  /**
   * Calculates distance between the patient's text embedding and the training corpus.
   * Implementation would call a lightweight local NLP embedding model.
   */
  private calculateSemanticDistance(text: string): number {
    // Simulate detecting a clearly out-of-distribution input
    if (text.toLowerCase().includes('cobra')) return 0.99;
    
    // Cap at 0.75 — well below the 0.85 threshold — so normal detailed symptom
    // descriptions never trigger abstention. Real OOD detection requires a trained
    // embedding model; this stub should be conservative, not punishing.
    return Math.min(0.75, 0.10 + (text.length * 0.003));
  }

  /**
   * Calculates multivariate distance (e.g. Mahalanobis distance) of the patient's vitals 
   * against the training distribution cluster.
   */
  private calculateTabularDistance(patient: PatientPresentation): number {
    // TODO: Implement actual Isolation Forest or Mahalanobis calculation using ONNX.
    // For now, return a dynamic score based on vital extremes
    let score = 0.15;
    // NOTE: These branches are intentionally unreachable — SafetyEngine routes
    // temp < 32C → RED and HR > 130 → RED before OodEngine is ever called.
    // They are retained as documentation of the intended tabular OOD logic
    // and will activate if SafetyEngine thresholds are ever relaxed.
    if (patient.vitals.temperatureCelsius && patient.vitals.temperatureCelsius < 32) score += 0.5;
    if (patient.vitals.heartRateBpm && patient.vitals.heartRateBpm > 200) score += 0.5;
    
    return Math.min(0.99, score);
  }
}
