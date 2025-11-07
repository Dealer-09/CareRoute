import React, { useState } from 'react'
import { AnalysisResult } from '../rules'
import DoctorList from './DoctorList'

const SeverityBanner: React.FC<{severity:string}> = ({severity}) => {
  if (severity === 'Red') return <div className="emergency-banner">Possible severe condition. Call emergency services (112) now.</div>
  return null
}

const TriageResult: React.FC<{result: AnalysisResult & {files?:string[]}}>=({result})=>{
  const [expanded, setExpanded] = useState(false)

  const copySummary = async () => {
    const text = `${result.severity} - ${result.summary} Recommended: ${result.recommendedSpecialty}`
    try { await navigator.clipboard.writeText(text)} catch(e){}
  }

  return (
    <div className="result-area">
      <SeverityBanner severity={result.severity} />
      <div className="card result-card" aria-live="polite">
        <div className="row">
          <div>
            <div className={`badge ${result.severity.toLowerCase()}`}>{result.severity}</div>
            <div className="summary"><strong>{result.summary}</strong></div>
            <div className="muted">Recommended Specialty: <strong>{result.recommendedSpecialty}</strong></div>
          </div>
          <div className="right">
            <button onClick={copySummary}>Copy summary</button>
          </div>
        </div>

        <div>
          <button className="link" onClick={()=>setExpanded(!expanded)}>{expanded? 'Hide' : 'Why this recommendation?'}</button>
          {expanded && (
            <div className="explain">
              <h4>Matched rules</h4>
              <ul>
                {result.reasoning.map((r,i)=>(<li key={i}>{r}</li>))}
              </ul>
              {result.redFlags && result.redFlags.length>0 && (
                <div>
                  <h4>Detected red flags</h4>
                  <ul>{result.redFlags.map((r,i)=>(<li key={i}>{r}</li>))}</ul>
                </div>
              )}
              <div>
                <h4>Attached files</h4>
                <div className="file-list muted">{(result.files && result.files.length) ? result.files.join(', ') : 'No files'}</div>
              </div>
            </div>
          )}
        </div>

        {result.severity === 'Red' && (
          <div className="urgent-actions">
            <a className="call-112" href="tel:112">Call 112</a>
            <button onClick={()=>alert('Nearest ERs:\n1. St. Mary\n2. City General\n3. Community Hospital')}>View nearest ER (static list)</button>
          </div>
        )}
      </div>

      <div className="doctors">
        <h3>Doctor Recommendations</h3>
        <DoctorList specialty={result.recommendedSpecialty} />
      </div>
    </div>
  )
}

export default TriageResult
