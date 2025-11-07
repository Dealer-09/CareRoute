export type AnalysisResult = {
  summary: string;
  severity: 'Green'|'Amber'|'Red';
  recommendedSpecialty: string;
  reasoning: string[];
  redFlags: string[];
  advice: string;
}

const kws = {
  breathing: ['shortness of breath','short of breath','breathless','wheeze','wheezing','breathlessness','unable to breathe','blue lips','cant breathe','can\'t breathe'],
  chest: ['chest pain','tight chest','pressure','palpitations','tightness'],
  fever: ['fever','febrile','temperature'],
  cough: ['cough','coughing','productive cough','dry cough'],
  headache: ['headache','migraine','severe headache'],
  neuro: ['face droop','one-sided weakness','slurred speech','slur','weakness on one side','numbness'],
  abdominal: ['abdominal pain','stomach pain','vomit','vomiting','diarrhea','gi bleed','bleeding from'],
  urinary: ['burning when','painful urination','frequency','urinating','blood in urine','urine'],
  chronic: ['asthma','copd','diabetes','hypertension','hypertensive'],
  pregnancy: ['pregnant','pregnancy','pregnancy test']
}

function findAny(text: string, list: string[]) {
  const found: string[] = []
  for (const k of list) {
    if (text.includes(k)) found.push(k)
  }
  return found
}

export function analyzeSymptoms(inputText: string, duration: string, flags: string[]): AnalysisResult {
  const text = inputText.toLowerCase()
  const reasoning: string[] = []
  const redFlags: string[] = []

  // detect keywords
  const breathing = findAny(text, kws.breathing)
  const chest = findAny(text, kws.chest)
  const fever = findAny(text, kws.fever)
  const cough = findAny(text, kws.cough)
  const neuro = findAny(text, kws.neuro)
  const chronic = findAny(text, kws.chronic)

  // red rules
  if (chest.length && (text.includes('sweat') || text.includes('sweating') || breathing.length)) {
    if (text.includes('sweat') || text.includes('sweating') || text.includes('pressure') || breathing.length) {
      redFlags.push('Chest pain with concerning features')
      reasoning.push("Detected 'chest pain' with features suggesting cardiac/acute risk")
    }
  }

  if (breathing.length && (text.includes('unable to speak') || text.includes('unable to speak full') || text.includes('blue lips') || flags.includes('Severe shortness of breath'))) {
    redFlags.push('Severe shortness of breath')
    reasoning.push("Detected severe breathing difficulty")
  }

  if (text.includes('faint') || text.includes('confusion') || text.includes('seizure')) {
    redFlags.push('Fainting / confusion / seizure')
    reasoning.push('Detected fainting/confusion/seizure')
  }

  if (neuro.length || flags.includes('One-sided weakness/face droop')) {
    if (neuro.length) reasoning.push("Detected neurological phrase(s): " + neuro.join(', '))
    redFlags.push('Neurological deficit')
  }

  // checklist flags -> immediate red
  const criticalFlags = ['Chest pain','Severe shortness of breath','Fainting/confusion','One-sided weakness/face droop','Bleeding that won\'t stop']
  if (flags.some(f=> criticalFlags.includes(f))) {
    redFlags.push('User selected critical flag')
    reasoning.push('User ticked a critical checkbox')
  }

  // determine severity
  let severity: AnalysisResult['severity'] = 'Green'

  if (redFlags.length > 0) severity = 'Red'
  else {
    // amber rules
    if (text.includes('worse') || text.includes('worsening') || text.includes('exacerb') || text.includes('increasing') || text.includes('night')) {
      severity = 'Amber'
      reasoning.push('Worsening or nocturnal pattern noted')
    }
    if (text.includes('moderate') || text.includes('disturbing sleep')) {
      severity = 'Amber'
      reasoning.push('Moderate pain/disturbing sleep')
    }
    if ((duration === '4–7 days' || duration === '1–4 weeks' || duration === '>1 month') && fever.length) {
      severity = 'Amber'
      reasoning.push('Prolonged fever pattern')
    }
    if (duration === '>1 month' && cough.length) {
      severity = 'Amber'
      reasoning.push('Persistent cough for over a month')
    }
  }

  // specialty mapping
  let specialty = 'General Medicine'
  if (breathing.length || text.includes('wheeze') || text.includes('asthma') || text.includes('copd')) specialty = 'Pulmonology'
  if (chest.length || text.includes('palpitation') || text.includes('palpitations')) specialty = 'Cardiology'
  if (neuro.length || text.includes('stroke') || text.includes('slurred')) specialty = 'Neurology'
  if (text.includes('sore throat') || text.includes('hoarseness') || text.includes('throat')) specialty = 'ENT'
  if (text.includes('abdominal') || text.includes('vomit') || text.includes('reflux') || text.includes('gi')) specialty = 'Gastroenterology'
  if (text.includes('diabetes') || text.includes('sugar') || text.includes('thirst') || text.includes('frequent urination')) specialty = 'Endocrinology'
  if (text.includes('burning when') || text.includes('urinating') || text.includes('blood in urine')) specialty = 'Urology'
  if (text.includes('joint') && text.includes('morning')) specialty = 'Rheumatology'

  // make readable reasons for non-red matches
  if (!reasoning.length) reasoning.push('No severe or specific red-flag phrases detected; assigned default evaluation')

  const summary = (() => {
    const base = severity === 'Red' ? 'Possible severe condition — seek emergency care.' : severity === 'Amber' ? 'Symptoms need clinical review soon.' : 'Symptoms likely suitable for self-care at home.'
    const brief = text.split('.').slice(0,1)[0]
    const s = brief ? `${brief.trim()}` : base
    return (s.length > 140 ? s.slice(0,140)+'…' : s)
  })()

  const advice = severity === 'Red' ? 'Call 112 immediately or go to the nearest ER.' : severity === 'Amber' ? 'Schedule a clinician consult in 24–48h. Use prescribed meds if applicable.' : 'Monitor symptoms, hydrate, rest. If symptoms worsen or new red flags appear, seek care.'

  return {
    summary,
    severity,
    recommendedSpecialty: specialty,
    reasoning,
    redFlags,
    advice
  }
}

export default analyzeSymptoms
