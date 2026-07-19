/**
 * Deterministic condition → specialty lookup table.
 *
 * Medicine already knows which specialty treats which condition.
 * This is NOT a model — it's a lookup table. The LLM suggestion is
 * used only as a fallback when no deterministic rule fires.
 *
 * Specialty routing is separate from triage severity — the LLM handles
 * severity; this table handles routing. (Per plan.md Phase 2.)
 */

export type SpecialtyMatch = {
  specialty: string
  reason: string
}

const SPECIALTY_RULES: Array<{
  keywords: string[]
  specialty: string
  reason: string
}> = [
  {
    keywords: ['chest pain', 'palpitation', 'palpitations', 'heart', 'cardiac', 'arrhythmia', 'angina', 'coronary', 'myocardial'],
    specialty: 'Cardiology',
    reason: 'Cardiac-related symptoms detected in description',
  },
  {
    keywords: ['shortness of breath', 'breathless', 'breathlessness', 'wheeze', 'wheezing', 'asthma', 'copd', 'cough', 'lung', 'pneumonia', 'bronchitis', 'respiratory'],
    specialty: 'Pulmonology',
    reason: 'Respiratory symptoms detected in description',
  },
  {
    keywords: ['stroke', 'face droop', 'one-sided weakness', 'slurred speech', 'seizure', 'migraine', 'headache', 'numbness', 'tingling', 'memory', 'dizziness', 'vertigo', 'concussion', 'epilepsy', 'tremor'],
    specialty: 'Neurology',
    reason: 'Neurological symptoms detected in description',
  },
  {
    keywords: ['sore throat', 'ear pain', 'earache', 'hearing loss', 'sinusitis', 'nasal congestion', 'hoarseness', 'tonsil', 'throat', 'runny nose', 'sneezing', 'nosebleed'],
    specialty: 'ENT',
    reason: 'Ear, nose, or throat symptoms detected in description',
  },
  {
    keywords: ['abdominal pain', 'stomach pain', 'stomach ache', 'vomit', 'vomiting', 'nausea', 'diarrhea', 'constipation', 'reflux', 'heartburn', 'liver', 'bowel', 'bloating', 'indigestion', 'ulcer', 'ibs', 'crohn'],
    specialty: 'Gastroenterology',
    reason: 'Gastrointestinal symptoms detected in description',
  },
  {
    keywords: ['diabetes', 'thyroid', 'blood sugar', 'thirst', 'weight gain', 'weight loss', 'hormone', 'metabolic', 'hypoglycemia', 'hyperglycemia', 'insulin'],
    specialty: 'Endocrinology',
    reason: 'Metabolic or hormonal symptoms detected in description',
  },
  {
    keywords: ['burning urination', 'painful urination', 'frequent urination', 'blood in urine', 'kidney', 'bladder', 'urinary', 'uti', 'prostate', 'kidney stone'],
    specialty: 'Urology',
    reason: 'Urinary tract symptoms detected in description',
  },
  {
    keywords: ['joint pain', 'joint stiffness', 'morning stiffness', 'arthritis', 'swollen joint', 'rheumatoid', 'lupus', 'fibromyalgia', 'gout'],
    specialty: 'Rheumatology',
    reason: 'Joint or autoimmune symptoms detected in description',
  },
  {
    keywords: ['rash', 'skin', 'itching', 'eczema', 'psoriasis', 'acne', 'hives', 'dermatitis', 'lesion', 'blistering', 'skin infection'],
    specialty: 'Dermatology',
    reason: 'Skin-related symptoms detected in description',
  },
  {
    keywords: ['pregnant', 'pregnancy', 'period', 'menstrual', 'pelvic pain', 'vaginal', 'ovarian', 'uterus', 'fertility', 'miscarriage', 'prenatal'],
    specialty: 'Obstetrics & Gynecology',
    reason: 'Gynecological or obstetric symptoms detected in description',
  },
  {
    keywords: ['back pain', 'spine', 'disc', 'fracture', 'bone', 'muscle pain', 'sprain', 'strain', 'knee pain', 'hip pain', 'shoulder pain', 'sports injury', 'tendon'],
    specialty: 'Orthopedics',
    reason: 'Musculoskeletal symptoms detected in description',
  },
  {
    keywords: ['depression', 'anxiety', 'panic attack', 'mental health', 'stress', 'mood', 'insomnia', 'sleep disorder', 'hallucination', 'bipolar', 'ocd', 'ptsd', 'eating disorder'],
    specialty: 'Psychiatry',
    reason: 'Mental health symptoms detected in description',
  },
  {
    keywords: ['eye pain', 'vision', 'blurry vision', 'blindness', 'eye redness', 'cataracts', 'glaucoma', 'eye infection', 'floaters'],
    specialty: 'Ophthalmology',
    reason: 'Eye-related symptoms detected in description',
  },
]

export function matchSpecialty(text: string, llmSuggested?: string): SpecialtyMatch {
  const lower = text.toLowerCase()

  for (const rule of SPECIALTY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return { specialty: rule.specialty, reason: rule.reason }
    }
  }

  // LLM suggestion as fallback when no deterministic rule fires
  if (llmSuggested && llmSuggested !== 'General Medicine') {
    return {
      specialty: llmSuggested,
      reason: 'Matched based on AI symptom pattern analysis',
    }
  }

  return {
    specialty: 'General Medicine',
    reason: 'No specific specialty pattern identified — general assessment recommended',
  }
}
