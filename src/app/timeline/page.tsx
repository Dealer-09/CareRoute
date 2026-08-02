"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { getHistory } from '@/lib/storage'
import type { TriageResult } from '@/types/triage'
import { AlertTriangle, AlertCircle, CheckCircle, ArrowLeft, Activity } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityDot(s: TriageResult['severity']) {
  if (s === 'Red')   return 'bg-red-500 ring-4 ring-red-100'
  if (s === 'Amber') return 'bg-amber-400 ring-4 ring-amber-100'
  return 'bg-green-500 ring-4 ring-green-100'
}

function severityCard(s: TriageResult['severity']) {
  if (s === 'Red')   return 'border-red-200 bg-red-50'
  if (s === 'Amber') return 'border-amber-200 bg-amber-50'
  return 'border-green-200 bg-green-50'
}

function severityLabel(s: TriageResult['severity']) {
  if (s === 'Red')   return <span className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={11} />Red — Urgent</span>
  if (s === 'Amber') return <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1"><AlertCircle size={11} />Amber — Review</span>
  return <span className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1"><CheckCircle size={11} />Green — Self-care</span>
}

function formatDate(ts?: number) {
  if (!ts) return 'Unknown date'
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Timeline() {
  const [history, setHistory] = useState<TriageResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('careRouteToken')
      if (token) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/triage/history`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = await res.json()
            setHistory(data.history)
            setLoading(false)
            return
          }
        } catch { /* fallthrough to localStorage */ }
      }
      setHistory(getHistory())
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...history].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))

  // Summary stats
  const redCount   = sorted.filter(h => h.severity === 'Red').length
  const amberCount = sorted.filter(h => h.severity === 'Amber').length
  const greenCount = sorted.filter(h => h.severity === 'Green').length

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-blue-600" />
            <span className="font-bold text-slate-900">Symptom Timeline</span>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-10 max-w-2xl">

        {/* Summary strip */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-10">
            <div className="bg-white border border-red-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{redCount}</div>
              <div className="text-xs font-semibold text-red-500 mt-0.5">Red</div>
            </div>
            <div className="bg-white border border-amber-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{amberCount}</div>
              <div className="text-xs font-semibold text-amber-500 mt-0.5">Amber</div>
            </div>
            <div className="bg-white border border-green-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{greenCount}</div>
              <div className="text-xs font-semibold text-green-600 mt-0.5">Green</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading your history…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && sorted.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-lg font-bold text-slate-800">No assessments yet</h2>
            <p className="text-slate-500 text-sm mt-1 mb-6">Run your first triage to see your symptom history here.</p>
            <Link
              href="/patient"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              <Activity size={16} /> Start Assessment
            </Link>
          </div>
        )}

        {/* Timeline */}
        {!loading && sorted.length > 0 && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[1.35rem] top-3 bottom-3 w-0.5 bg-slate-200" />

            <div className="space-y-6">
              {sorted.map((item) => (
                <div key={item.id ?? item.timestamp} className="flex gap-5 items-start">
                  {/* Dot */}
                  <div className={`relative z-10 w-5 h-5 rounded-full shrink-0 mt-2 ${severityDot(item.severity)}`} />

                  {/* Card */}
                  <div className={`flex-1 rounded-2xl border p-4 ${severityCard(item.severity)}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        {severityLabel(item.severity)}
                        <div className="text-base font-bold text-slate-900 mt-1">{item.condition_guess}</div>
                      </div>
                      <div className="text-xs text-slate-400 whitespace-nowrap">{formatDate(item.timestamp)}</div>
                    </div>

                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{item.summary}</p>

                    {/* Confidence badge */}
                    {item.confidence !== undefined && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-white/70 border border-slate-200 px-2.5 py-0.5 rounded-full">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.confidence >= 80 ? 'bg-green-500' : item.confidence >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} />
                        <span className="text-xs text-slate-600 font-medium">{item.confidence}% confidence</span>
                      </div>
                    )}

                    {/* Specialty + duration */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                        🩺 {item.recommended_specialty}
                      </span>
                      {item.duration && (
                        <span className="text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                          ⏱ {item.duration}
                        </span>
                      )}
                    </div>

                    {/* Red flags */}
                    {item.redFlags && item.redFlags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.redFlags.map((f, j) => (
                          <span key={j} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚑ {f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
