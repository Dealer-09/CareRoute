"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getHistory } from '@/lib/storage'
import { AnalysisResult } from '@/lib/rules'
import { Activity, Clock, FileText, ChevronRight, AlertCircle, Home } from 'lucide-react'

type HistoryItem = AnalysisResult & { timestamp?: number; files?: string[] }

export default function Dashboard() {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Small delay to ensure client-side hydration compatibility
        setTimeout(() => {
            setHistory(getHistory())
            setLoading(false)
        }, 100)
    }, [])

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <nav className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
                        <span className="text-xl font-bold text-slate-900">CareRoute</span>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-slate-500">Patient Dashboard</span>
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">JD</div>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Your Health Overview</h1>
                    <p className="text-slate-500 mt-1">Manage your assessments and history</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Activity size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{history.length}</div>
                            <div className="text-sm text-slate-500">Total Assessments</div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Clock size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">
                                {history.length > 0 && history[0].timestamp
                                    ? new Date(history[0].timestamp).toLocaleDateString()
                                    : 'N/A'}
                            </div>
                            <div className="text-sm text-slate-500">Last Assessment</div>
                        </div>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Assessments</h2>

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No assessments yet</h3>
                        <p className="text-slate-500 mb-6">Start your first symptom assessment to see results here.</p>
                        <Button asChild>
                            <Link href="/">Start New Assessment</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map((item, i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start space-x-4">
                                        <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                                        ${item.severity === 'Red' ? 'bg-red-100 text-red-600'
                                                : item.severity === 'Amber' ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-green-100 text-green-600'}`}>
                                            {item.severity === 'Red' ? '!' : item.severity === 'Amber' ? '⚠️' : '✓'}
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <h3 className="font-bold text-slate-900">{item.recommendedSpecialty}</h3>
                                                <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                                                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Unknown Date'}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 text-sm mt-1 line-clamp-2">{item.summary}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                                        ${item.severity === 'Red' ? 'bg-red-50 text-red-700'
                                                : item.severity === 'Amber' ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-green-50 text-green-700'}`}>
                                            {item.severity} Severity
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 px-6 py-3 flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Recommended: {item.advice}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-8">
                    <Button variant="outline" asChild>
                        <Link href="/"><Home className="mr-2 w-4 h-4" /> Return Home</Link>
                    </Button>
                </div>
            </main>
        </div>
    )
}
