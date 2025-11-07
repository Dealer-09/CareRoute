import React, { useState, useRef, useEffect } from 'react'
import TriageForm from '../components/TriageForm'
import TriageResult from '../components/TriageResult'
import { AnalysisResult } from '../rules'
import { saveAnalysisToHistory, getHistory } from '../utils/storage'

const Patient: React.FC = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [noticeShown, setNoticeShown] = useState(false)

  useEffect(() => {
    // nothing for now
  }, [])

  const onAnalyze = (res: AnalysisResult) => {
    setResult(res)
    saveAnalysisToHistory(res)
    if (!noticeShown) setNoticeShown(true)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>AI Symptom Assessment</h1>
        <p className="muted subtitle">This prototype offers AI-supported triage guidance only. It is not a medical diagnosis.</p>
      </header>

      <div className="grid">
        <TriageForm onAnalyze={onAnalyze} />
        {result && <TriageResult result={result} />}
      </div>

      <div className="always-footer muted small">
        <span className="footer-icon">⚠️</span>
        This system does not provide medical diagnoses. For emergencies, call 112 immediately.
      </div>
    </div>
  )
}

export default Patient
