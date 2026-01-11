"use client"

import React, { useState } from 'react'
import { analyzeSymptoms, AnalysisResult } from '@/lib/rules'
import { saveAnalysisToHistory } from '@/lib/storage'
import DoctorList from './DoctorList'
import { Button } from './ui/button'


type Props = {
    onClose?: () => void
    variant?: 'modal' | 'inline'
}

const durations = ['Hours', '1–3 days', '4–7 days', '1–4 weeks', '>1 month']

const TriageWizard: React.FC<Props> = ({ onClose, variant = 'modal' }) => {
    const [step, setStep] = useState(1)
    const [text, setText] = useState('')
    const [duration, setDuration] = useState(durations[1])
    const [flags, setFlags] = useState<string[]>([])
    const [files, setFiles] = useState<string[]>([])
    const [result, setResult] = useState<AnalysisResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const toggleFlag = (f: string) => {
        setFlags(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
    }

    const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const list = Array.from(e.target.files || [])
        setFiles(prev => [...prev, ...list.map((f: File) => f.name)])
        e.currentTarget.value = ''
    }

    const removeFile = (name: string) => setFiles(prev => prev.filter(f => f !== name))

    const handleNext = () => {
        setError(null)
        if (step === 1 && text.trim().length < 15) {
            setError('Please describe your symptoms in at least 15 characters')
            return
        }
        if (step === 2) {
            // Analyze
            const res = analyzeSymptoms(text, duration, flags)
            const attached = { ...res, files, timestamp: Date.now() }
            setResult(res)
            saveAnalysisToHistory(attached)
        }
        setStep(step + 1)
    }

    const handleBack = () => setStep(step - 1)

    const Wrapper = variant === 'modal' ?
        ({ children }: { children: React.ReactNode }) => (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
                <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
                    {children}
                </div>
            </div>
        ) :
        ({ children }: { children: React.ReactNode }) => (
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 mx-auto">
                {children}
            </div>
        )

    const content = (
        <>
            {variant === 'modal' && (
                <button className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 p-2" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
            )}

            {/* Progress */}
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-center">
                <div className="flex items-center space-x-4">
                    {[1, 2, 3].map(s => (
                        <React.Fragment key={s}>
                            <div className={`flex flex-col items-center ${step === s ? 'text-blue-600' : s < step ? 'text-green-600' : 'text-slate-400'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-1 ${step === s ? 'bg-blue-100' : s < step ? 'bg-green-100' : 'bg-slate-100'
                                    }`}>
                                    {s < step ? '✓' : s}
                                </div>
                                <span className="text-xs font-medium">{s === 1 ? 'Symptoms' : s === 2 ? 'Details' : 'Results'}</span>
                            </div>
                            {s < 3 && <div className={`w-12 h-1 rounded-full ${s < step ? 'bg-green-500' : 'bg-slate-200'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto">
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-900">Describe Your Symptoms</h2>
                            <p className="text-slate-500 mt-2">Tell us what you&apos;re experiencing in your own words</p>
                        </div>

                        <div className="space-y-2">
                            <textarea
                                value={text}
                                onChange={e => setText(e.target.value)}
                                placeholder="Example: I have a persistent cough for 3 days, mild fever, and feeling tired..."
                                className="flex min-h-[120px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>{text.length} chars</span>
                                <span>Min 15 chars</span>
                            </div>
                            {error && <div className="text-red-500 text-sm mt-1 bg-red-50 p-2 rounded">{error}</div>}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-900">Additional Details</h2>
                            <p className="text-slate-500 mt-2">Help us understand your condition better</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">How long have you had these symptoms?</label>
                                <select
                                    value={duration}
                                    onChange={e => setDuration(e.target.value)}
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {durations.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Do any of these apply? (Check all that apply)</label>
                                <div className="space-y-2">
                                    {['Chest pain', 'Severe shortness of breath', 'Fainting/confusion', 'One-sided weakness/face droop', 'Bleeding that won\'t stop'].map(f => (
                                        <label key={f} className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" checked={flags.includes(f)} onChange={() => toggleFlag(f)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-slate-900">{f}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Upload any relevant medical documents (optional)</label>
                                <input type="file" multiple onChange={onFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                {files.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {files.map(f => (
                                            <div key={f} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                                                <span className="truncate">📄 {f}</span>
                                                <button onClick={() => removeFile(f)} className="text-red-500 hover:text-red-700">×</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {step === 3 && result && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {result.severity === 'Red' && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start space-x-4">
                                <div className="text-2xl">🚨</div>
                                <div>
                                    <h3 className="text-lg font-bold text-red-800">Urgent Medical Attention Required</h3>
                                    <p className="text-red-700 mt-1">Based on your symptoms, you should seek immediate medical care.</p>
                                    <a href="tel:112" className="inline-block mt-3 bg-red-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-700 transition-colors">📞 Call 112 Now</a>
                                </div>
                            </div>
                        )}

                        <div className="text-center">
                            <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-semibold mb-4 capitalize
                                ${result.severity === 'Red' ? 'bg-red-100 text-red-800' : result.severity === 'Amber' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}
                            >
                                {result.severity} Severity
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">Assessment Complete</h2>
                            <p className="text-lg text-slate-600">{result.summary}</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start space-x-3">
                                <div className="bg-white p-2 rounded-full shadow-sm">🏥</div>
                                <div>
                                    <div className="text-sm font-medium text-slate-500">Recommended Specialty</div>
                                    <div className="text-lg font-bold text-slate-900">{result.recommendedSpecialty}</div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start space-x-3">
                                <div className="bg-white p-2 rounded-full shadow-sm">💡</div>
                                <div>
                                    <div className="text-sm font-medium text-slate-500">Next Steps</div>
                                    <div className="text-sm font-medium text-slate-900 mt-1">{result.advice}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Available Specialists Near You</h3>
                            <DoctorList specialty={result.recommendedSpecialty} />
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between">
                <div>
                    {step > 1 && step < 3 && (
                        <Button variant="ghost" onClick={handleBack}>← Back</Button>
                    )}
                </div>
                <div className="space-x-2">
                    {step < 3 ? (
                        <Button onClick={handleNext}>{step === 2 ? 'Analyze Symptoms' : 'Next'} →</Button>
                    ) : (
                        <Button onClick={onClose}>Done</Button>
                    )}
                </div>
            </div>
        </>
    )

    if (variant === 'modal') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
                <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
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

export default TriageWizard
