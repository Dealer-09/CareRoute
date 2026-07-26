"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useState, useEffect, useRef } from 'react'
import type { TriageResult } from '@/types/triage'
import { saveAnalysisToHistory } from '@/lib/storage'
import DoctorList from './DoctorList'
import NearestER from './NearestER'
import { Button } from './ui/button'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
  Brain,
  Stethoscope,
  ChevronRight,
  Phone,
  Mic,
  MicOff,
  ShieldCheck,
  BookOpen,
  Loader2,
  Users,
} from 'lucide-react'


// ─── Dependent type ───────────────────────────────────────────────────────────
type Dependent = {
  id: string
  name: string
  date_of_birth: string | null
  gender: 'M' | 'F' | 'Other' | null
  relationship: string
}
// ─── Constants ────────────────────────────────────────────────────────────────

const DISCLAIMER =
  'CareRoute is a triage aid only. It does not provide a medical diagnosis and is not a substitute for professional medical advice, emergency services, or a qualified clinician. If you are unsure, always seek professional help.'

const DURATIONS = ['Hours', '1–3 days', '4–7 days', '1–4 weeks', '>1 month']

const CRITICAL_FLAGS = [
  'Chest pain',
  'Severe shortness of breath',
  'Fainting/confusion',
  'One-sided weakness/face droop',
  "Bleeding that won't stop",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeverityConfig(severity: TriageResult['severity']) {
  switch (severity) {
    case 'Red':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        badge: 'bg-red-100 text-red-800',
        Icon: AlertTriangle,
        iconColor: 'text-red-600',
        label: 'Red — Urgent',
      }
    case 'Amber':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-800',
        Icon: AlertCircle,
        iconColor: 'text-amber-600',
        label: 'Amber — Needs Review',
      }
    default:
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        badge: 'bg-green-100 text-green-800',
        Icon: CheckCircle,
        iconColor: 'text-green-600',
        label: 'Green — Self-Care',
      }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  onClose?: () => void
  variant?: 'modal' | 'inline'
}


export const TriageWizard: React.FC<Props> = ({ onClose, variant = 'modal' }) => {
  const [step, setStep]           = useState(1)
  const [text, setText]           = useState('')
  const [duration, setDuration]   = useState(DURATIONS[1])
  const [flags, setFlags]         = useState<string[]>([])
  const [files, setFiles]         = useState<string[]>([])
  const [result, setResult]       = useState<TriageResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [listening, setListening] = useState(false)
  const [pubmed, setPubmed]       = useState<{ title: string; url: string }[]>([])
  const [pubmedLoading, setPubmedLoading] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Optional vitals — all strings so empty = not provided
  const [heartRate, setHeartRate] = useState('')
  const [spo2, setSpo2]           = useState('')
  const [temperature, setTemperature] = useState('')
  const [bloodPressure, setBloodPressure] = useState('')


  // Dependent profiles
  const [dependents,   setDependents]  = useState<Dependent[]>([])
  const [selectedFor,  setSelectedFor] = useState<'self' | Dependent>('self')

  // Fetch dependents on mount
  useEffect(() => {
    const token = localStorage.getItem('careRouteToken')
    if (!token) return
    fetch(`${BACKEND_URL}/api/dependents`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.dependents) setDependents(d.dependents) })
      .catch(() => {})
  }, [])
  // ─── Voice-to-text ─────────────────────────────────────────────────────────
  function toggleVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice input is not supported in this browser. Try Chrome.'); return }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const rec = new SpeechRecognition()
    rec.lang = 'en-IN'
    rec.continuous = true
    rec.interimResults = true
    recognitionRef.current = rec

    let final = text
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim = e.results[i][0].transcript
      }
      setText(final + interim)
    }
    rec.onend = () => { setText(final.trim()); setListening(false) }
    rec.onerror = () => setListening(false)
    rec.start()
    setListening(true)
  }

  // ─── PubMed citations (free E-utilities API) ─────────────────────────────
  useEffect(() => {
    if (!result) return
    const query = encodeURIComponent(`${result.condition_guess} triage`)
    setPubmedLoading(true)
    const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
    fetch(`${baseUrl}/esearch.fcgi?db=pubmed&term=${query}&retmax=3&sort=relevance&retmode=json`)
      .then(r => r.json())
      .then(async data => {
        const ids: string[] = data.esearchresult?.idlist ?? []
        if (ids.length === 0) return
        const summary = await fetch(`${baseUrl}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`)
        const sData = await summary.json()
        const articles = ids.map(id => ({
          title: sData.result?.[id]?.title ?? 'PubMed Article',
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        })).filter(a => a.title !== 'PubMed Article')
        setPubmed(articles)
      })
      .catch(() => {})
      .finally(() => setPubmedLoading(false))
  }, [result])

  const toggleFlag = (f: string) =>
    setFlags(prev => (prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]))

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    const list = Array.from(e.target.files ?? [])
    setFiles(prev => [...prev, ...list.map((f: File) => f.name)])
    e.currentTarget.value = ''
  }

  const removeFile = (name: string) =>
    setFiles(prev => prev.filter(f => f !== name))

  const handleNext = async () => {
    setError(null)

    if (step === 1) {
      if (text.trim().length < 15) {
        setError('Please describe your symptoms in at least 15 characters.')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      setLoading(true)
      setStep(3) // show loading state in step 3 immediately
      try {
        const res = await fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, duration, flags,
            vitals: {
              heartRate:     heartRate     || undefined,
              spo2:          spo2          || undefined,
              temperature:   temperature   || undefined,
              bloodPressure: bloodPressure || undefined,
            },
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? 'Analysis failed')
        }

        const data: TriageResult = await res.json()
        const withMeta: TriageResult = { ...data, files, duration }
        setResult(withMeta)
        saveAnalysisToHistory(withMeta)

        // Phase 0: Save to DB if logged in
        const token = localStorage.getItem('careRouteToken')
        if (token) {
          try {
            await fetch(`${BACKEND_URL}/api/triage/save`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                ...withMeta,
                symptom_text:     text,
                for_dependent_id: selectedFor !== 'self' ? selectedFor.id   : undefined,
                for_name:         selectedFor !== 'self' ? selectedFor.name  : undefined,
              })

            })
          } catch (e) {
            console.error('Failed to save to DB, but local analysis completed', e)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed. Please try again.'
        setError(message)
        setStep(2) // go back on error
      } finally {
        setLoading(false)
      }
    }
  }

  const handleBack = () => {
    setError(null)
    setStep(prev => prev - 1)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col">
      {/* Close button (modal only) */}
      {variant === 'modal' && (
        <button
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 p-2 rounded-full hover:bg-slate-100 transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Persistent Disclaimer — always visible, per plan.md */}
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-start gap-2 shrink-0">
        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">{DISCLAIMER}</p>
      </div>

      {/* Progress bar */}
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-center shrink-0">
        <div className="flex items-center gap-3">
          {[1, 2, 3].map(s => (
            <React.Fragment key={s}>
              <div
                className={`flex flex-col items-center ${
                  step === s
                    ? 'text-blue-600'
                    : s < step
                    ? 'text-green-600'
                    : 'text-slate-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-1 transition-colors ${
                    step === s
                      ? 'bg-blue-100 text-blue-700'
                      : s < step
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                <span className="text-xs font-semibold">
                  {s === 1 ? 'Symptoms' : s === 2 ? 'Details' : 'Results'}
                </span>
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 rounded-full transition-colors ${
                    s < step ? 'bg-green-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 md:p-8 overflow-y-auto max-h-[60vh]">

        {/* ── Step 1: Symptom Description ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Describe Your Symptoms</h2>
              <p className="text-slate-500 mt-1 text-sm">
                Tell us what you&apos;re experiencing in your own words
              </p>
            </div>

            {/* For whom? — only shown if the user has dependents */}
            {dependents.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={13} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Who is this for?</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedFor('self')}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                      selectedFor === 'self'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    Myself
                  </button>
                  {dependents.map(dep => (
                    <button
                      key={dep.id}
                      onClick={() => setSelectedFor(dep)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                        typeof selectedFor !== 'string' && selectedFor.id === dep.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {dep.name} <span className="opacity-60 font-normal">({dep.relationship})</span>
                    </button>
                  ))}
                </div>
                {selectedFor !== 'self' && (
                  <p className="text-xs text-blue-600 mt-1.5 font-medium">
                    ✓ AI will tailor its advice for {selectedFor.name}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="relative">
                <textarea
                  id="symptom-input"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Example: I have had a persistent cough for 3 days with mild fever around 38°C. I feel very tired and my throat is sore..."
                  className="w-full min-h-[140px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={toggleVoice}
                  title={listening ? 'Stop recording' : 'Speak your symptoms (English or Hindi)'}
                  className={`absolute bottom-3 right-3 p-2 rounded-full transition-all ${
                    listening
                      ? 'bg-red-500 text-white animate-pulse shadow-md'
                      : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className={text.length >= 15 ? 'text-green-600 font-medium' : 'text-slate-400'}>
                  {text.length} chars {text.length >= 15 && '✓'}
                </span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Mic size={10} /> Voice input supported
                </span>
              </div>
              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Step 2: Additional Details ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Additional Details</h2>
              <p className="text-slate-500 mt-1 text-sm">
                Help us understand your condition better
              </p>
            </div>

            <div className="space-y-5">
              {/* Duration */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  How long have you had these symptoms?
                </label>
                <select
                  id="duration-select"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {DURATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Critical flags */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Do any of these apply?{' '}
                  <span className="text-red-600 font-medium">(Answer honestly — these affect your triage priority)</span>
                </label>
                <div className="space-y-2 mt-3">
                  {CRITICAL_FLAGS.map(f => (
                    <label
                      key={f}
                      htmlFor={`flag-${f}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        flags.includes(f)
                          ? 'border-red-400 bg-red-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        id={`flag-${f}`}
                        type="checkbox"
                        checked={flags.includes(f)}
                        onChange={() => toggleFlag(f)}
                        className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 shrink-0"
                      />
                      <span className="text-sm font-medium text-slate-900">{f}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Vitals — optional, improves triage accuracy */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Vitals{' '}
                  <span className="text-slate-400 font-normal">(optional — helps the AI triage more accurately)</span>
                </label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { label: 'Heart Rate', unit: 'bpm', placeholder: 'e.g. 88', value: heartRate, set: setHeartRate, id: 'vitals-hr' },
                    { label: 'SpO₂', unit: '%', placeholder: 'e.g. 96', value: spo2, set: setSpo2, id: 'vitals-spo2' },
                    { label: 'Temperature', unit: '°C', placeholder: 'e.g. 38.5', value: temperature, set: setTemperature, id: 'vitals-temp' },
                    { label: 'Blood Pressure', unit: 'mmHg', placeholder: 'e.g. 120/80', value: bloodPressure, set: setBloodPressure, id: 'vitals-bp' },
                  ].map(({ label, unit, placeholder, value, set, id }) => (
                    <div key={id} className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                      <div className="text-xs font-semibold text-slate-500 mb-1">{label} <span className="font-normal text-slate-400">({unit})</span></div>
                      <input
                        id={id}
                        type="text"
                        inputMode="decimal"
                        value={value}
                        onChange={e => set(e.target.value)}
                        placeholder={placeholder}
                        className="w-full text-sm text-slate-800 placeholder:text-slate-300 bg-transparent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* File upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Upload medical documents{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={onFileChange}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {files.map(f => (
                      <div
                        key={f}
                        className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"
                      >
                        <span className="truncate text-slate-700">📄 {f}</span>
                        <button
                          onClick={() => removeFile(f)}
                          className="text-red-400 hover:text-red-600 ml-2 font-bold text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Loading ── */}
        {step === 3 && loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-5">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-800 text-lg">Analysing your symptoms…</div>
              <div className="text-sm text-slate-500 mt-1">
                Running emergency pre-check, then AI triage
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Results ── */}
        {step === 3 && !loading && result && (() => {
          const cfg = getSeverityConfig(result.severity)
          const SeverityIcon = cfg.Icon
          return (
            <div className="space-y-5 animate-in fade-in duration-500">

              {/* Emergency banner */}
              {result.emergency && (
                <div className="bg-red-600 text-white p-5 rounded-2xl flex items-start gap-4">
                  <div className="text-3xl shrink-0">🚨</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">Seek Emergency Care Immediately</h3>
                    <p className="text-sm opacity-90 mt-1">
                      Your symptoms match a known emergency pattern. Do not wait for this to resolve.
                    </p>
                    <a
                      href="tel:112"
                      className="inline-flex items-center gap-2 mt-3 bg-white text-red-700 px-5 py-2 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors"
                    >
                      <Phone size={16} />
                      Call 112 Now
                    </a>
                  </div>
                </div>
              )}

              {/* Nearest ER — only for Red / emergency */}
              {(result.emergency || result.severity === 'Red') && (
                <NearestER />
              )}

              {/* Severity card + confidence badge */}
              <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5`}>
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <SeverityIcon size={22} className={cfg.iconColor} />
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {result.confidence !== undefined && (
                    <div className="flex items-center gap-1.5 bg-white/70 border border-slate-200 px-3 py-1 rounded-full">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          result.confidence >= 80 ? 'bg-green-500' :
                          result.confidence >= 60 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-700">{result.confidence}% confidence</span>
                    </div>
                  )}
                </div>
                <div className="text-xl font-bold text-slate-900 mb-1">{result.condition_guess}</div>
                <p className="text-slate-600 text-sm leading-relaxed">{result.summary}</p>
              </div>

              {/* Green reassurance block */}
              {result.severity === 'Green' && result.self_care && result.self_care.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-green-600" />
                    <span className="text-sm font-bold text-green-800">You're likely fine — here's what to do</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Self-Care Steps</p>
                    <ul className="space-y-1.5">
                      {result.self_care.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-green-900">
                          <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {result.escalation_signs && result.escalation_signs.length > 0 && (
                    <div className="border-t border-green-200 pt-3">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">⚠ Seek care if…</p>
                      <ul className="space-y-1.5">
                        {result.escalation_signs.map((sign, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                            <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            {sign}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Why this assessment — explainability */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={17} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Why this assessment
                  </span>
                </div>
                <ul className="space-y-2">
                  {result.reasoning.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <ChevronRight size={15} className="text-blue-400 mt-0.5 shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Specialty + Advice */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Stethoscope size={17} className="text-violet-600" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Recommended Specialty
                    </span>
                  </div>
                  <div className="text-lg font-bold text-slate-900">{result.recommended_specialty}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {result.specialty_reason}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={17} className="text-emerald-600" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Next Steps
                    </span>
                  </div>
                  <div className="text-sm text-slate-800 leading-relaxed font-medium">
                    {result.advice}
                  </div>
                </div>
              </div>

              {/* Red flags */}
              {result.redFlags && result.redFlags.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">
                    Red Flags Detected
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.redFlags.map((f, i) => (
                      <span
                        key={i}
                        className="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* PubMed citations */}
              {(pubmedLoading || pubmed.length > 0) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={17} className="text-indigo-600" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Evidence</span>
                    {pubmedLoading && <Loader2 size={13} className="text-slate-400 animate-spin ml-1" />}
                  </div>
                  {pubmed.length === 0 && pubmedLoading && (
                    <p className="text-xs text-slate-400">Searching PubMed…</p>
                  )}
                  <ul className="space-y-2">
                    {pubmed.map((p, i) => (
                      <li key={i}>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-700 hover:text-indigo-900 hover:underline leading-snug line-clamp-2 block"
                        >
                          {p.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Doctor list */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">
                  Available Specialists Near You
                </h3>
                <DoctorList specialty={result.recommended_specialty} />
              </div>

              {/* Footer disclaimer — repeated at bottom of results */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
                ⚠️ {DISCLAIMER}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Footer action buttons */}
      {!loading && (
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          <div>
            {step > 1 && step < 3 && (
              <Button variant="ghost" onClick={handleBack} className="text-slate-600">
                ← Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button id="triage-next-btn" onClick={handleNext}>
                {step === 2 ? 'Analyse Symptoms →' : 'Next →'}
              </Button>
            ) : result ? (
              <Button id="triage-done-btn" onClick={onClose}>
                Done
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )

  if (variant === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto"
          onClick={e => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 mx-auto">
      {content}
    </div>
  )
}
