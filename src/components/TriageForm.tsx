import React, { useState, useRef } from 'react'
import { analyzeSymptoms, AnalysisResult } from '../rules'

type Props = {
  onAnalyze: (r: AnalysisResult & { files?: string[]; timestamp?: number }) => void
}

const durations = ['Hours', '1–3 days', '4–7 days', '1–4 weeks', '>1 month']

const sampleText = "Chronic asthma. Night-time wheeze and chest tightness for 2 days. Shortness of breath on climbing stairs. Using rescue inhaler more often."

const quickSamples: {label:string, text:string, duration:string, files?:string[]}[] = [
  {label: 'Asthma (Amber)', text: sampleText, duration: '1–3 days', files: ['spirometry_2024.pdf','discharge_2023.png']},
  {label: 'Chest pain (Red)', text: 'Tight chest pain with sweating and breathlessness since 1 hour.', duration: 'Hours'},
  {label: 'Stroke signs (Red)', text: 'Sudden face droop and slurred speech.', duration: 'Hours'},
  {label: 'Persistent cough (Amber)', text: 'Dry cough for over a month, worse at night.', duration: '>1 month'}
]

function isNonsense(s: string) {
  const trimmed = s.trim()
  if (trimmed.length === 0) return true
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return true
  if (/([a-zA-Z])\1{10,}/.test(trimmed)) return true
  const profanity = ['damn','shit','fuck']
  if (profanity.some(p=> trimmed.toLowerCase().includes(p))) return true
  return false
}

const TriageForm: React.FC<Props> = ({ onAnalyze }) => {
  const [text, setText] = useState('')
  const [duration, setDuration] = useState(durations[1])
  const [flags, setFlags] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [firstAnalyzeDone, setFirstAnalyzeDone] = useState(false)

  const toggleFlag = (f: string) => {
    setFlags(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f])
  }

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...list.map(f=>f.name)])
    e.currentTarget.value = ''
  }

  const removeFile = (name: string) => setFiles(prev => prev.filter(f=>f!==name))

  const handleAnalyze = () => {
    setError(null)
    if (text.trim().length < 15) {
      setError('Please enter at least 15 characters describing your symptoms.')
      return
    }
    if (isNonsense(text)) {
      setError('Please enter real symptoms to proceed.')
      return
    }
    const res = analyzeSymptoms(text, duration, flags)
    // attach files and timestamp
    const attached = {...res, files, timestamp: Date.now()}
    onAnalyze(attached)
    setFirstAnalyzeDone(true)
  }

  const loadSample = () => {
    setText(sampleText)
    setDuration('1–3 days')
    setFiles(['spirometry_2024.pdf','discharge_2023.png'])
    setFlags([])
  }

  const quickLoad = (s: typeof quickSamples[0]) => {
    setText(s.text)
    setDuration(s.duration)
    setFiles(s.files || [])
    setFlags([])
  }

  return (
    <div className="card form-card">
      <label className="label">Describe your symptoms</label>
      <textarea aria-label="symptoms" value={text} onChange={e=>setText(e.target.value)} placeholder="tight chest, wheezing at night, shortness of breath since 2 days" />
      <div className="row small muted">
        <div>{text.length} chars</div>
        <div className="muted">min 15</div>
      </div>

      <div className="field">
        <label className="label">Duration</label>
        <select value={duration} onChange={e=>setDuration(e.target.value)}>
          {durations.map(d=> <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="label">Quick flags (optional)</label>
        <div className="flags">
          {['Chest pain','Severe shortness of breath','Fainting/confusion','One-sided weakness/face droop','Bleeding that won\'t stop'].map(f=> (
            <label key={f} className="checkbox">
              <input type="checkbox" checked={flags.includes(f)} onChange={()=>toggleFlag(f)} />
              <span>{f}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label">Attach files (mock upload)</label>
        <input type="file" multiple onChange={onFileChange} />
        <div className="file-list">
          {files.map(f=> (
            <div key={f} className="file-row">{f} <button onClick={()=>removeFile(f)} aria-label={`remove ${f}`}>Remove</button></div>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="actions">
        <button className="primary" onClick={handleAnalyze}>Analyze</button>
        <button onClick={loadSample}>Load Sample</button>
        <div className="quick-samples">
          {quickSamples.map(s=> <button key={s.label} onClick={()=>quickLoad(s)} className="mini">{s.label}</button>)}
        </div>
      </div>

      {!firstAnalyzeDone && <div className="notice small muted">In production, users must pass government ID verification to prevent misuse.</div>}
    </div>
  )
}

export default TriageForm
