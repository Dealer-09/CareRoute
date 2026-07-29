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
    // TODO: Implement actual Cosine Distance against the ClinicalBERT corpus baseline.
    // For now, return a heuristic mock score.
    
    // Simulate detecting a clearly out-of-distribution input
    if (text.toLowerCase().includes('cobra')) return 0.99;
    
    // Dynamic mock based on text length. Cap is set ABOVE the threshold (0.85)
    // so that sufficiently unusual inputs can actually trigger abstention.
    // Prior cap of 0.80 was below the 0.85 threshold, making semantic OOD permanently disabled.
    return Math.min(0.90, 0.10 + (text.length * 0.005));
  }

  /**
   * Calculates multivariate distance (e.g. Mahalanobis distance) of the patient's vitals 
   * against the training distribution cluster.
   */
  private calculateTabularDistance(patient: PatientPresentation): number {
    // TODO: Implement actual Isolation Forest or Mahalanobis calculation using ONNX.
    // For now, return a dynamic score based on vital extremes
    let score = 0.15;
    if (patient.vitals.temperatureCelsius && patient.vitals.temperatureCelsius < 32) score += 0.5;
    if (patient.vitals.heartRateBpm && patient.vitals.heartRateBpm > 200) score += 0.5;
    
    return Math.min(0.99, score);
  }
}
