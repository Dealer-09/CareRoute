/**
 * IndicNormalizer — Hinglish / Hindi Symptom Normalisation Layer
 *
 * PURPOSE
 * -------
 * The ClinicalRuleEngine and emergencyPreCheck are English keyword-based.
 * Indian patients frequently describe symptoms in Hinglish (Hindi words
 * written in Roman script) or direct transliterations. Without this layer,
 * "seene mein dard" (chest pain) would never match the 'chest pain' rule
 * and would silently receive a Green triage result.
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * - Zero latency: pure in-memory lookup, no network or model inference
 * - Deterministic: same input always produces same output (CDSCO-compliant)
 * - Additive: does not remove any input text — only appends/substitutes
 * - Conservative: only maps phrases with unambiguous clinical equivalents
 *   (e.g. "seene mein dard" → "chest pain" is unambiguous)
 *   (we do NOT map "dard" alone → "pain" as that would over-match)
 *
 * HOW TO EXTEND
 * -------------
 * Add entries to INDIC_SYMPTOM_MAP. Each entry maps one or more Hinglish
 * surface forms to an English SNOMED-friendly clinical phrase.
 * Source: AIIMS patient intake data patterns + ICD-10 Hindi terminology.
 */

interface SymptomMapping {
  /** Hinglish / transliterated Hindi surface forms (lowercase) */
  hinglish: string[]
  /** Canonical English clinical phrase to inject */
  english: string
}

// ─── Core Symptom Mapping Table ───────────────────────────────────────────────
// Organised by body system, matching ICD-10 / SNOMED clinical concept clusters.

const INDIC_SYMPTOM_MAP: SymptomMapping[] = [

  // ── Cardiovascular ──────────────────────────────────────────────────────────
  {
    hinglish: ['seene mein dard', 'seene mein dard ho raha', 'sine mein dard', 'chati mein dard',
               'seene mein jalan', 'sine mein jalan', 'dil mein dard', 'dil ka dard'],
    english: 'chest pain',
  },
  {
    hinglish: ['dil ki dharkan tez', 'dil jor jor se dhadak raha', 'dil bhaag raha',
               'ghabrahat ho rahi', 'dil mein tez dhadkan'],
    english: 'palpitations',
  },
  {
    hinglish: ['saans phoolna', 'saans phool raha', 'saans phool rahi', 'saans phool rahe',
               'saans nahi aa raha', 'saans nahi aa rahi', 'saans lene mein takleef',
               'saans lene mein problem', 'saans ruk raha', 'saans ruk rahi', 'dama'],
    english: 'shortness of breath',
  },

  // ── Neurological ────────────────────────────────────────────────────────────
  {
    hinglish: ['sar dard', 'sir dard', 'sar mein dard', 'sir mein dard',
               'sar phata ja raha', 'bahut tez sar dard', 'sar mein bahut dard'],
    english: 'severe headache',
  },
  {
    hinglish: ['chakkar aa raha', 'chakkar aana', 'sar ghoom raha', 'sir ghoom raha',
               'balance nahi', 'lad khada raha'],
    english: 'dizziness',
  },
  {
    hinglish: ['hath pair soo gaye', 'ek taraf kamzori', 'ek taraf hath nahi chal raha',
               'muh tedha ho gaya', 'bolne mein takleef', 'awaaz band ho gayi'],
    english: 'one-sided weakness slurred speech',
  },
  {
    hinglish: ['behosh ho gaya', 'hosh kho diya', 'girh gayi', 'murcha aa gayi',
               'ankh andheri aa gayi', 'blackout'],
    english: 'unconscious fainted',
  },

  // ── Gastrointestinal ────────────────────────────────────────────────────────
  {
    hinglish: ['pet mein dard', 'pet mein dard ho raha', 'pet kata ja raha',
               'pait mein dard', 'aant mein dard'],
    english: 'abdominal pain',
  },
  {
    hinglish: ['ulti ho rahi', 'ulti aana', 'qai ho rahi', 'jee machlana',
               'nausea ho raha', 'ulti jaisi feel'],
    english: 'nausea vomiting',
  },
  {
    hinglish: ['dast lag rahe', 'loose motion', 'patlaa pakhana', 'daast',
               'pet kharab hai'],
    english: 'diarrhea',
  },
  {
    hinglish: ['khoon ki ulti', 'khoon waali qai', 'ulti mein khoon'],
    english: 'vomiting blood',
  },
  {
    hinglish: ['kala pakhana', 'kaala pottee', 'mal mein khoon', 'pakhane mein khoon'],
    english: 'black stool rectal bleeding',
  },

  // ── Respiratory ─────────────────────────────────────────────────────────────
  {
    hinglish: ['khansi aa rahi', 'khansi ho rahi', 'bahut khansi', 'sukhi khansi',
               'balgam waali khansi'],
    english: 'cough',
  },
  {
    hinglish: ['khansi mein khoon', 'balgam mein khoon', 'khoon thookna'],
    english: 'coughing blood',
  },
  {
    hinglish: ['saas ghut raha', 'saas band ho raha', 'dam ghut raha',
               'naak band hai', 'naak se saans nahi aa raha'],
    english: 'breathing difficulty',
  },

  // ── Fever / Systemic ────────────────────────────────────────────────────────
  {
    hinglish: ['bukhar hai', 'tez bukhar', 'bahut tez bukhar', 'bukhaar chadha hai',
               'jwar hai', 'body hot hai'],
    english: 'fever',
  },
  {
    hinglish: ['bahut zyada kamzori', 'jism mein jaan nahi', 'thakan ho rahi',
               'uthne ka mann nahi', 'fatigue ho rahi'],
    english: 'severe fatigue weakness',
  },
  {
    hinglish: ['kaanpna', 'kaanp raha', 'thithurana', 'jism kaanp raha', 'rigor'],
    english: 'chills rigors',
  },

  // ── Musculoskeletal ─────────────────────────────────────────────────────────
  {
    hinglish: ['kamar dard', 'kamar mein dard', 'peeth mein dard', 'peeth dard',
               'jodon mein dard', 'jodo ka dard', 'haddiyon mein dard'],
    english: 'back pain joint pain',
  },
  {
    hinglish: ['hath mein dard', 'pair mein dard', 'ghutne mein dard',
               'kandhe mein dard', 'muscles mein dard', 'pindo mein dard'],
    english: 'limb pain muscle pain',
  },

  // ── Urinary ─────────────────────────────────────────────────────────────────
  {
    hinglish: ['peshab mein jalan', 'peshab karte waqt dard', 'peshab mein dard',
               'sulabh mein jalan'],
    english: 'burning urination painful urination',
  },
  {
    hinglish: ['peshab mein khoon', 'laal peshab', 'peshab laal aa raha'],
    english: 'blood in urine',
  },
  {
    hinglish: ['baar baar peshab', 'peshab baar baar aa raha', 'peshab ruk nahi raha'],
    english: 'frequent urination',
  },

  // ── Eyes / ENT ──────────────────────────────────────────────────────────────
  {
    hinglish: ['aankhon mein dard', 'aankhein laal hain', 'aankhon se paani',
               'dhoondla dikhna', 'dhundhla dikhna', 'nazar kamzor'],
    english: 'eye pain blurred vision',
  },
  {
    hinglish: ['kaan mein dard', 'kaan mein awaz', 'kaan se khoon',
               'sunai nahi de raha', 'sunne mein takleef'],
    english: 'ear pain hearing loss',
  },
  {
    hinglish: ['gala dard', 'gale mein dard', 'gala kharab', 'nigalne mein takleef',
               'gala sookh raha'],
    english: 'sore throat difficulty swallowing',
  },

  // ── Skin ────────────────────────────────────────────────────────────────────
  {
    hinglish: ['khujli ho rahi', 'kharish ho rahi', 'jild mein khujli',
               'charm rog', 'daane nikal aaye', 'raashes aa gaye', 'daad khaj'],
    english: 'itching skin rash',
  },
  {
    hinglish: ['peela pad gaya', 'ankhein peeli', 'jandice ho gaya', 'piliya'],
    english: 'jaundice yellow skin',
  },

  // ── Reproductive / OB-GYN ───────────────────────────────────────────────────
  {
    hinglish: ['pet mein dard pregnant', 'garbhwati hoon', 'pregnancy mein dard',
               'baccha wali problem', 'prasav ki takleef'],
    english: 'abdominal pain pregnancy',
  },
  {
    hinglish: ['mahwari mein dard', 'periods mein dard', 'MC mein dard',
               'haiz mein dard', 'periods band ho gaye'],
    english: 'menstrual pain irregular periods',
  },

  // ── Psychiatric / Neuropsychiatric ──────────────────────────────────────────
  {
    hinglish: ['neend nahi aa rahi', 'raat ko neend nahi', 'insomnia ho raha',
               'bahut anxiety ho rahi', 'ghabrahat ho rahi', 'dar lag raha'],
    english: 'insomnia anxiety',
  },
  {
    hinglish: ['dimag sahi nahi', 'bhool jaata', 'yaaddasht kamzor',
               'confusion ho raha', 'kuch samajh nahi aa raha'],
    english: 'confusion memory loss',
  },

  // ── Bleeding / Emergency ────────────────────────────────────────────────────
  {
    hinglish: ['khoon band nahi ho raha', 'bahut khoon nikal raha', 'khoon bahut beh raha',
               'zakhm se khoon band nahi'],
    english: 'uncontrolled bleeding',
  },
  {
    hinglish: ['daura pada', 'dora pada', 'seizure aa gaya', 'mircchi aa gayi', 'convulsion hua',
               'jhatke aa rahe', 'mirgi aa gayi', 'mirgi ka daura'],
    english: 'seizure convulsion',
  },
]

// ─── Normaliser ───────────────────────────────────────────────────────────────

/**
 * Normalises Hinglish / Hindi symptom text into English clinical phrases.
 *
 * Strategy: APPEND rather than replace.
 * We append matched English equivalents in parentheses after the original text.
 * This preserves the original for any future LLM processing while ensuring
 * the English keyword matchers in emergencyPreCheck and ClinicalRuleEngine fire.
 *
 * Example:
 *   input:  "seene mein dard ho raha hai aur saans phool rahi hai"
 *   output: "seene mein dard ho raha hai aur saans phool rahi hai
 *            [chest pain] [shortness of breath]"
 */
export function normaliseIndicSymptoms(text: string): string {
  if (!text || text.trim().length === 0) return text

  const lower = text.toLowerCase()
  const appended = new Set<string>()

  for (const mapping of INDIC_SYMPTOM_MAP) {
    if (mapping.hinglish.some(phrase => lower.includes(phrase))) {
      appended.add(mapping.english)
    }
  }

  if (appended.size === 0) return text  // Pure English input — pass through unchanged

  return `${text}\n[Normalised: ${Array.from(appended).join(', ')}]`
}
