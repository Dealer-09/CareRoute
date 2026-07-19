"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bell, Search, Settings, Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string
  initials: string
  name: string
  age: number
  gender: string
  severity: 'Red' | 'Amber' | 'Green'
  symptoms: string
  timeAgo: string
  reviewed: boolean
  notes: string
}

// ─── Demo data — clearly labelled, not real patients ─────────────────────────
// This is placeholder data used until Phase 3 connects this to real triage_cases rows.

const DEMO_PATIENTS: Patient[] = [
  {
    id: 'demo-1',
    initials: 'AS',
    name: 'Alex Smith',
    age: 34,
    gender: 'M',
    severity: 'Red',
    symptoms: 'Chest pain, sweating, shortness of breath',
    timeAgo: '10 mins ago',
    reviewed: false,
    notes: '',
  },
  {
    id: 'demo-2',
    initials: 'JD',
    name: 'Jane Doe',
    age: 28,
    gender: 'F',
    severity: 'Amber',
    symptoms: 'Persistent cough, fever for 5 days',
    timeAgo: '45 mins ago',
    reviewed: false,
    notes: '',
  },
  {
    id: 'demo-3',
    initials: 'MR',
    name: 'Mike Ross',
    age: 42,
    gender: 'M',
    severity: 'Green',
    symptoms: 'Sore throat, mild headache',
    timeAgo: '2 hrs ago',
    reviewed: true,
    notes: '',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityBadge(severity: Patient['severity']) {
  if (severity === 'Red')
    return 'bg-red-100 text-red-800 border border-red-200'
  if (severity === 'Amber')
    return 'bg-amber-100 text-amber-800 border border-amber-200'
  return 'bg-green-100 text-green-800 border border-green-200'
}

function avatarColor(severity: Patient['severity']) {
  if (severity === 'Red') return 'bg-red-100 text-red-700'
  if (severity === 'Amber') return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Clinician() {
  const [patients, setPatients] = useState<Patient[]>(DEMO_PATIENTS)
  const [search, setSearch] = useState('')
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const filtered = patients.filter(
    p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.symptoms.toLowerCase().includes(search.toLowerCase())
  )

  const markReviewed = (id: string) => {
    setPatients(prev =>
      prev.map(p => (p.id === id ? { ...p, reviewed: true } : p))
    )
  }

  const saveNote = (id: string) => {
    setPatients(prev =>
      prev.map(p => (p.id === id ? { ...p, notes: noteText } : p))
    )
    setActiveNoteId(null)
    setNoteText('')
  }

  const openNote = (p: Patient) => {
    setActiveNoteId(p.id)
    setNoteText(p.notes)
  }

  const unreviewedCount = patients.filter(p => !p.reviewed).length

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                C
              </div>
              <span className="text-xl font-bold text-slate-900">CareRoute</span>
            </Link>
            <div className="hidden md:flex gap-1">
              <a href="#" className="px-3 py-2 rounded-md bg-blue-50 text-blue-700 font-semibold text-sm">
                Patients
              </a>
              <a href="#" className="px-3 py-2 rounded-md text-slate-500 hover:bg-slate-50 font-medium text-sm">
                Schedule
              </a>
              <a href="#" className="px-3 py-2 rounded-md text-slate-500 hover:bg-slate-50 font-medium text-sm">
                Analytics
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell size={20} className="text-slate-500 hover:text-slate-700 cursor-pointer" />
              {unreviewedCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border border-white">
                  {unreviewedCount}
                </span>
              )}
            </div>
            <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200">
              Dr
            </div>
          </div>
        </div>
      </nav>

      {/* Demo data banner */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2 justify-center">
        <Info size={14} className="text-blue-600 shrink-0" />
        <p className="text-xs text-blue-800">
          <strong>Demo data</strong> — This queue will show real{' '}
          <code className="bg-blue-100 px-1 rounded">triage_cases</code> rows once the backend is connected (Phase 3).
        </p>
      </div>

      <main className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Patient Queue</h1>
            <p className="text-slate-500 text-sm mt-1">
              {unreviewedCount} unreviewed triage assessment{unreviewedCount !== 1 ? 's' : ''} awaiting review
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
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Symptoms</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <React.Fragment key={p.id}>
                  <tr
                    className={`hover:bg-slate-50/60 transition-colors ${
                      p.reviewed ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Patient */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor(p.severity)}`}
                        >
                          {p.initials}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
                          <div className="text-xs text-slate-500">
                            {p.gender}, {p.age}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Severity */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${severityBadge(p.severity)}`}
                      >
                        {p.severity}
                      </span>
                    </td>

                    {/* Symptoms */}
                    <td className="px-6 py-4 max-w-[220px]">
                      <span className="text-sm text-slate-600 line-clamp-2">{p.symptoms}</span>
                    </td>

                    {/* Time */}
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {p.timeAgo}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {p.reviewed ? (
                        <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-semibold">
                          Reviewed
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-semibold">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {!p.reviewed && (
                          <Button
                            size="sm"
                            onClick={() => markReviewed(p.id)}
                            className={
                              p.severity === 'Red'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : ''
                            }
                          >
                            Review
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openNote(p)}
                          className="text-slate-600"
                        >
                          Note
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline note editor */}
                  {activeNoteId === p.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                            Clinical Note — {p.name}
                          </label>
                          <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Add clinical observations, instructions, follow-up notes…"
                            className="w-full min-h-[90px] rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveNote(p.id)}>
                              Save Note
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActiveNoteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Show saved note if exists */}
                  {p.notes && activeNoteId !== p.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="px-6 pb-3">
                        <div className="text-xs text-slate-500 ml-12 italic border-l-2 border-slate-300 pl-3">
                          Note: {p.notes}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">
              No patients match your search.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
