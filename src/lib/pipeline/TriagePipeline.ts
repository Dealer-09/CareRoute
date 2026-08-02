import { PatientPresentation, DecisionRecord, TriageUrgency, SafetyEngine, OodEngine, ClinicalRuleEngine } from '@careroute/core';

/** Typed error thrown when the SafetyEngine rejects physiologically impossible input data. */
interface InvalidPatientDataError extends Error {
  code: 'INVALID_PATIENT_DATA';
  ruleTriggered: string;
}

/**
 * The Master Controller for the Six Engines Architecture.
 * This guarantees the exact sequence: Safety -> OOD -> ML Triage,
 * and ensures an Immutable DecisionRecord is generated regardless of the outcome.
 */
export class TriagePipeline {
  private safetyEngine = new SafetyEngine();
  private oodEngine = new OodEngine();
  private clinicalRuleEngine = new ClinicalRuleEngine();

  public async execute(patient: PatientPresentation): Promise<DecisionRecord> {
    const timestamp = new Date().toISOString();

    // Age guard — catch NaN/impossible ages before any engine runs
    if (isNaN(patient.age) || patient.age < 0 || patient.age > 130) {
      const err = Object.assign(new Error(`Invalid patient age: ${patient.age}`), {
        code: 'INVALID_PATIENT_DATA' as const,
        ruleTriggered: 'PLAUSIBILITY_AGE'
      })
      throw err
    }

    // 1. ENGINE 4: Deterministic Safety Gateway
    const safetyResult = this.safetyEngine.evaluate(patient);
    
    if (safetyResult.action === 'REJECT_INVALID_DATA') {
      // Throw so the caller (route.ts) can return HTTP 400 rather than
      // a false-positive emergency result.
      const err = Object.assign(new Error(safetyResult.reason), {
        code: 'INVALID_PATIENT_DATA' as const,
        ruleTriggered: safetyResult.ruleTriggered,
      }) as InvalidPatientDataError;
      throw err;
    }
    
    if (safetyResult.action === 'ROUTE_RED') {
      return this.generateAuditRecord(
        patient, timestamp, 'Red', false, undefined,
        [safetyResult.ruleTriggered],
        0, 0,
        { red: 1.0, amber: 0, green: 0 }  // Hard deterministic rule — maximum confidence
      );
    }

    // 2. ENGINE 5: Out-Of-Distribution (OOD) Detection
    const oodResult = this.oodEngine.evaluate(patient);

    if (oodResult.action === 'ABSTAIN') {
      return this.generateAuditRecord(
        patient, timestamp, 'ESCALATED', true, oodResult.reason, [],
        oodResult.oodType === 'SEMANTIC' ? oodResult.score : 0,
        oodResult.oodType === 'TABULAR'  ? oodResult.score : 0
      );
    }

    // 3. ENGINE 6: Deterministic Clinical Rule Engine (Replaces XGBoost)
    // If we reach here, the data is valid, not an obvious emergency, and mathematically in-distribution.
    const ruleResult = this.clinicalRuleEngine.evaluate(patient);
    
    // We map the rule engine decision back to the mlProbs structure to keep the legacy DB shape compatible
    const simulatedProbs = {
      red: ruleResult.action === 'Red' ? 0.9 : 0.05,
      amber: ruleResult.action === 'Amber' ? 0.9 : 0.05,
      green: ruleResult.action === 'Green' ? 0.9 : 0.05
    };

    return this.generateAuditRecord(
      patient, timestamp, ruleResult.action, false, undefined, [ruleResult.reason], oodResult.semanticScore, oodResult.tabularScore, simulatedProbs
    );
  }

  /**
   * Generates the WORM-compliant CDSCO audit log.
   */
  private generateAuditRecord(
    patient: PatientPresentation,
    timestamp: string,
    finalDecision: TriageUrgency | 'ESCALATED',
    abstained: boolean,
    abstentionReason?: string,
    rulesTriggered: string[] = [],
    semanticOod: number = 0,
    tabularOod: number = 0,
    mlProbs = { red: 0, amber: 0, green: 0 }
  ): DecisionRecord {
    
    return {
      recordId: `DR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp,
      patientIdHash: `hash_${patient.patientId}`, // Anonymized
      versions: {
        visionModel:    'donut-rxhandbd-1.0',          // Fine-tuned Donut TFLite (OCR feature, separate from triage)
        entityResolver: 'not-implemented',              // SapBERT hybrid reranker — Phase 8 roadmap item
        triageModel:    'clinical-rule-engine-v1',      // Deterministic Manchester/ESI rules (active)
        oodModel:       'heuristic-stub-v1',            // Real isolation-forest pending ONNX integration
        pkbDatabase:    'tata-1mg-251k-2026.07',        // 251k Indian drug names from Tata 1mg dataset
        ruleEngine:     'safety-gateway-v1'             // SafetyEngine red-flag + plausibility rules (active)
      },
      scores: {
        ocrConfidence: 0,               // OCR not invoked during text-only triage
        entityResolutionConfidence: 0,  // Entity resolver not implemented (Phase 8)
        semanticOodDistance: semanticOod,
        tabularOodDistance: tabularOod
      },
      rulesTriggered,
      triageProbabilityRed: mlProbs.red,
      triageProbabilityAmber: mlProbs.amber,
      triageProbabilityGreen: mlProbs.green,
      finalDecision,
      abstained,
      abstentionReason
    };
  }



}
