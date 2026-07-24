"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bell, Search, Settings, DatabaseZap, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'Red' | 'Amber' | 'Green'

type QueueCase = {
  id: string
  severity: Severity
  emergency: boolean
  condition_guess: string
  summary: string
  symptom_text: string | null
  recommended_specialty: string
  reviewed: boolean
  reviewed_at: string | null
  clinician_note: string | null
  created_at: string
  patient_name: string
  gender: 'M' | 'F' | 'Other' | null
  date_of_birth: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityBadge(s: Severity) {
  if (s === 'Red')   return 'bg-red-100 text-red-800 border border-red-200'
  if (s === 'Amber') return 'bg-amber-100 text-amber-800 border border-amber-200'
  return 'bg-green-100 text-green-800 border border-green-200'
}

function avatarColor(s: Severity) {
  if (s === 'Red')   return 'bg-red-100 text-red-700'
  if (s === 'Amber') return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function age(dob: string | null) {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + ' yrs'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Clinician() {
  const [queue, setQueue] = useState<QueueCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('careRouteToken') : null

  useEffect(() => {
    async function fetchQueue() {
      if (!token) { setError('Not authenticated'); setLoading(false); return }
      try {
        const res = await fetch('http://localhost:4000/api/triage/queue', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 403) {
          setError('This page is for clinicians only. Log in with a doctor account.')
          setLoading(false)
          return
        }
        if (!res.ok) throw new Error('Failed to load queue')
        const data = await res.json()
        setQueue(data.queue)
      } catch {
        setError('Could not load patient queue. Make sure the backend is running.')
      } finally {
        setLoading(false)
      }
    }
    fetchQueue()
  }, [token])

  const filtered = queue.filter(c =>
    c.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.symptom_text ?? '').toLowerCase().includes(search.toLowerCase()) ||
    c.condition_guess.toLowerCase().includes(search.toLowerCase())
  )

  const unreviewedCount = queue.filter(c => !c.reviewed).length

  async function markReviewed(id: string) {
    if (!token) return
    setReviewingId(id)
    try {
      const res = await fetch(`http://localhost:4000/api/triage/${id}/review`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setQueue(prev => prev.map(c =>
        c.id === id ? { ...c, reviewed: true, reviewed_at: new Date().toISOString() } : c
      ))
    } catch {
      alert('Failed to mark as reviewed. Please try again.')
    } finally {
      setReviewingId(null)
    }
  }

  function openNote(c: QueueCase) {
    setActiveNoteId(c.id)
    setNoteText(c.clinician_note ?? '')
  }

  async function saveNote(id: string) {
    if (!token) return
    setSavingNote(true)
    try {
      const res = await fetch(`http://localhost:4000/api/triage/${id}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: noteText }),
      })
      if (!res.ok) throw new Error()
      setQueue(prev => prev.map(c =>
        c.id === id ? { ...c, clinician_note: noteText } : c
      ))
      setActiveNoteId(null)
      setNoteText('')
    } catch {
      alert('Failed to save note. Please try again.')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
              <span className="text-xl font-bold text-slate-900">CareRoute</span>
            </Link>
            <div className="hidden md:flex gap-1">
              <a href="#" className="px-3 py-2 rounded-md bg-blue-50 text-blue-700 font-semibold text-sm">Patients</a>
              <a href="#" className="px-3 py-2 rounded-md text-slate-500 hover:bg-slate-50 font-medium text-sm">Schedule</a>
              <a href="#" className="px-3 py-2 rounded-md text-slate-500 hover:bg-slate-50 font-medium text-sm">Analytics</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell size={20} className="text-slate-500 hover:text-slate-700 cursor-pointer" />
              {unreviewedCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border border-white">
                  {unreviewedCount > 9 ? '9+' : unreviewedCount}
                </span>
              )}
            </div>
            <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200">Dr</div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Patient Queue</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? 'Loading…' : `${unreviewedCount} unreviewed triage assessment${unreviewedCount !== 1 ? 's' : ''} awaiting review`}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patients…"
                className="h-10 pl-9 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-56 text-sm bg-white"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Settings size={15} />
              Filter
            </Button>
          </div>
        </div>

        {/* Patient table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Loading */}
          {loading && (
            <div className="py-20 flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-blue-400 animate-spin" />
              <p className="text-slate-500 text-sm">Loading patient queue…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="py-20 flex flex-col items-center gap-3 text-center px-6">
              <DatabaseZap size={36} className="text-red-300" />
              <p className="font-semibold text-slate-600">{error}</p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">Condition</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <React.Fragment key={c.id}>
                    <tr className={`hover:bg-slate-50/60 transition-colors ${c.reviewed ? 'opacity-60' : ''}`}>

                      {/* Patient */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(c.severity)}`}>
                            {initials(c.patient_name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{c.patient_name}</div>
                            <div className="text-xs text-slate-500">
                              {c.gender ?? '—'}, {age(c.date_of_birth)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${severityBadge(c.severity)}`}>
                          {c.emergency && '🚨 '}{c.severity}
                        </span>
                      </td>

                      {/* Condition */}
                      <td className="px-6 py-4 max-w-[220px]">
                        <div className="text-sm font-medium text-slate-700 truncate">{c.condition_guess}</div>
                        <div className="text-xs text-slate-400 truncate">{c.recommended_specialty}</div>
                      </td>

                      {/* Time */}
                      <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                        {timeAgo(c.created_at)}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {c.reviewed ? (
                          <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-semibold">Reviewed</span>
                        ) : (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-semibold">Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {!c.reviewed && (
                            <Button
                              size="sm"
                              onClick={() => markReviewed(c.id)}
                              disabled={reviewingId === c.id}
                              className={c.severity === 'Red' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                            >
                              {reviewingId === c.id ? <Loader2 size={13} className="animate-spin" /> : 'Review'}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openNote(c)} className="text-slate-600">
                            {c.clinician_note ? 'Edit Note' : 'Note'}
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline note editor */}
                    {activeNoteId === c.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                              Clinical Note — {c.patient_name}
                            </label>
                            <textarea
                              value={noteText}
                              onChange={e => setNoteText(e.target.value)}
                              placeholder="Add clinical observations, instructions, follow-up notes…"
                              maxLength={2000}
                              className="w-full min-h-[90px] rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                            />
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => saveNote(c.id)} disabled={savingNote}>
                                {savingNote ? <><Loader2 size={13} className="animate-spin mr-1" />Saving…</> : 'Save Note'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setActiveNoteId(null); setNoteText('') }}>
                                Cancel
                              </Button>
                              <span className="text-xs text-slate-400 ml-auto">{noteText.length}/2000</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Show saved note */}
                    {c.clinician_note && activeNoteId !== c.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={6} className="px-6 pb-3">
                          <div className="text-xs text-slate-500 ml-12 italic border-l-2 border-slate-300 pl-3">
                            Note: {c.clinician_note}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 && (
            <div className="py-20 flex flex-col items-center gap-3 text-center">
              <DatabaseZap size={36} className="text-slate-300" />
              <p className="font-semibold text-slate-500">
                {search ? 'No patients match your search.' : 'No cases in queue yet.'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                {!search && 'Patient triage submissions will appear here in real time.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
