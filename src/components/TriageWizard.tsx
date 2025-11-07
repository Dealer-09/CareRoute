import React, { useState } from 'react'
import { analyzeSymptoms, AnalysisResult } from '../rules'
import { saveAnalysisToHistory } from '../utils/storage'
import DoctorList from './DoctorList'

type Props = {
  onClose: () => void
}

const durations = ['Hours', '1–3 days', '4–7 days', '1–4 weeks', '>1 month']

const TriageWizard: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState(1)
  const [text, setText] = useState('')
  const [duration, setDuration] = useState(durations[1])
  const [flags, setFlags] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleFlag = (f: string) => {
    setFlags(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f])
  }

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...list.map((f: File)=>f.name)])
    e.currentTarget.value = ''
  }

  const removeFile = (name: string) => setFiles(prev => prev.filter(f=>f!==name))

  const handleNext = () => {
    setError(null)
    if (step === 1 && text.trim().length < 15) {
      setError('Please describe your symptoms in at least 15 characters')
      return
    }
    if (step === 2) {
      // Analyze
      const res = analyzeSymptoms(text, duration, flags)
      const attached = {...res, files, timestamp: Date.now()}
      setResult(res)
      saveAnalysisToHistory(attached)
    }
    setStep(step + 1)
  }

  const handleBack = () => setStep(step - 1)

  return (
    <div className="modal-overlay wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="wizard-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'complete' : ''}`}>
            <div className="step-circle">1</div>
            <div className="step-label">Symptoms</div>
          </div>
          <div className={`progress-line ${step > 1 ? 'complete' : ''}`}></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'complete' : ''}`}>
            <div className="step-circle">2</div>
            <div className="step-label">Details</div>
          </div>
          <div className={`progress-line ${step > 2 ? 'complete' : ''}`}></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-circle">3</div>
            <div className="step-label">Results</div>
          </div>
        </div>

        <div className="wizard-content">
          {step === 1 && (
            <div className="wizard-step">
              <h2>Describe Your Symptoms</h2>
              <p className="muted">Tell us what you're experiencing in your own words</p>
              <textarea 
                value={text} 
                onChange={e=>setText(e.target.value)} 
                placeholder="Example: I have a persistent cough for 3 days, mild fever, and feeling tired..."
                className="wizard-textarea"
              />
              <div className="char-count">{text.length} / 15 min</div>
              {error && <div className="error">{error}</div>}
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step">
              <h2>Additional Details</h2>
              <p className="muted">Help us understand your condition better</p>
              
              <div className="wizard-field">
                <label>How long have you had these symptoms?</label>
                <select value={duration} onChange={e=>setDuration(e.target.value)} className="wizard-select">
                  {durations.map(d=> <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="wizard-field">
                <label>Do any of these apply? (Check all that apply)</label>
                <div className="wizard-flags">
                  {['Chest pain','Severe shortness of breath','Fainting/confusion','One-sided weakness/face droop','Bleeding that won\'t stop'].map(f=> (
                    <label key={f} className="wizard-checkbox">
                      <input type="checkbox" checked={flags.includes(f)} onChange={()=>toggleFlag(f)} />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="wizard-field">
                <label>Upload any relevant medical documents (optional)</label>
                <input type="file" multiple onChange={onFileChange} className="wizard-file" />
                {files.length > 0 && (
                  <div className="file-list">
                    {files.map(f=> (
                      <div key={f} className="file-row">
                        <span>📄 {f}</span>
                        <button onClick={()=>removeFile(f)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && result && (
            <div className="wizard-step results-step">
              {result.severity === 'Red' && (
                <div className="emergency-alert">
                  <div className="alert-icon">🚨</div>
                  <div className="alert-content">
                    <h3>Urgent Medical Attention Required</h3>
                    <p>Based on your symptoms, you should seek immediate medical care.</p>
                    <a href="tel:112" className="btn-emergency">📞 Call 112 Now</a>
                  </div>
                </div>
              )}

              <div className="result-summary">
                <div className="result-badge-wrapper">
                  <span className={`badge-large ${result.severity.toLowerCase()}`}>
                    {result.severity}
                  </span>
                </div>
                <h2>Assessment Complete</h2>
                <p className="result-text">{result.summary}</p>
              </div>

              <div className="result-details">
                <div className="detail-card">
                  <div className="detail-icon">🏥</div>
                  <div className="detail-content">
                    <div className="detail-label">Recommended Specialty</div>
                    <div className="detail-value">{result.recommendedSpecialty}</div>
                  </div>
                </div>
                <div className="detail-card">
                  <div className="detail-icon">💡</div>
                  <div className="detail-content">
                    <div className="detail-label">Next Steps</div>
                    <div className="detail-value">{result.advice}</div>
                  </div>
                </div>
              </div>

              <div className="doctors-section">
                <h3>Available Specialists Near You</h3>
                <DoctorList specialty={result.recommendedSpecialty} />
              </div>
            </div>
          )}
        </div>

        <div className="wizard-actions">
          {step > 1 && step < 3 && (
            <button className="btn-secondary" onClick={handleBack}>
              ← Back
            </button>
          )}
          {step < 3 && (
            <button className="btn-primary" onClick={handleNext}>
              {step === 2 ? 'Analyze Symptoms' : 'Next'} →
            </button>
          )}
          {step === 3 && (
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TriageWizard
