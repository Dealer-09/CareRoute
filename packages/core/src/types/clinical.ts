/**
 * CareRoute v2: Clinical Data Contracts
 * 
 * These interfaces define the strict data shapes required for the Six Engines 
 * Clinical Architecture, enforcing deterministic safety and CDSCO compliance.
 */

// ==========================================
// 1. PATIENT PRESENTATION & TRIAGE FEATURES
// ==========================================

export type TriageUrgency = 'Red' | 'Amber' | 'Green';
export type Sex = 'MALE' | 'FEMALE' | 'OTHER';

export interface Vitals {
  heartRateBpm?: number;
  respiratoryRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  temperatureCelsius?: number;
  spo2Percent?: number;
  painScore?: number; // 1-10
}

/**
 * The core feature schema parsed from user input.
 * Engine 4 (Safety) and Engine 6 (ML Triage) depend on this structure.
 */
export interface PatientPresentation {
  patientId: string; // Hashed/Anonymized
  age: number;
  sex: Sex;
  
  chiefComplaint: string;
  symptomDurationHours: number;
  
  vitals: Vitals;
  
  // Specific red-flag boolean checks derived from UI or NLP
  redFlags: {
    unconsciousOrUnresponsive: boolean;
    severeBreathingDifficulty: boolean;
    activeHeavyBleeding: boolean;
    suddenSevereChestPain: boolean;
    newOnsetParalysisOrSlurredSpeech: boolean;
  };

  context: {
    extractedMedications: PharmaceuticalEntity[];
    knownAllergies: string[];
    pregnancyStatus?: boolean;
  };
}


// ==========================================
// 2. PHARMACEUTICAL KNOWLEDGE BASE (PKB)
// ==========================================

export interface ActiveIngredient {
  ingredientId: string;
  genericName: string;
  strength: string; // e.g., "500 mg", "250 mcg"
}

/**
 * Engine 3 outputs this canonical entity. It preserves the exact brand and 
 * manufacturer rather than destructively normalizing.
 */
export interface PharmaceuticalEntity {
  productId: string;
  brandName: string;      // e.g., "Crocin 500"
  manufacturer: string;
  
  ingredients: ActiveIngredient[]; // e.g., [{ genericName: "Paracetamol", strength: "500 mg" }]
  
  dosageForm: string;     // e.g., "Tablet", "Syrup"
  route: string;          // e.g., "Oral", "Intravenous"
  
  regulatoryMetadata: {
    isBannedFDC: boolean; // Flags if it's a CDSCO banned fixed-dose combination
    sourceVersion: string; // e.g., "CDSCO-2026.07.24"
  };
}


// ==========================================
// 3. GOVERNANCE PLANE & AUDIT LOG
// ==========================================

/**
 * The immutable audit record generated for every inference to comply with
 * CDSCO Medical Device Software (MDSW) tracking and drift analysis.
 */
export interface DecisionRecord {
  recordId: string;
  timestamp: string;      // ISO string
  patientIdHash: string;
  
  // Provenance / Traceability
  versions: {
    visionModel: string;
    entityResolver: string;
    triageModel: string;
    oodModel: string;
    pkbDatabase: string;
    ruleEngine: string;
  };

  // Confidence & OOD Propagation
  scores: {
    ocrConfidence: number;
    entityResolutionConfidence: number;
    semanticOodDistance: number;
    tabularOodDistance: number;
  };

  // Determistic actions
  rulesTriggered: string[]; // e.g., ["SPO2_CRITICAL_COLLAPSE"]
  
  // ML Risk
  triageProbabilityRed: number;
  triageProbabilityAmber: number;
  triageProbabilityGreen: number;
  
  // Final Action
  finalDecision: TriageUrgency | 'ESCALATED';
  
  // Abstention Tracking
  abstained: boolean;
  abstentionReason?: string; // e.g., "TABULAR_OOD_DETECTED" or "LOW_OCR_CONFIDENCE"
}
