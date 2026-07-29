"use client"
import { BACKEND_URL } from '@/lib/api'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Clock, MapPin, Phone, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Appointment = {
  id: string
  status: 'confirmed' | 'cancelled' | 'completed'
  starts_at: string
  clinician_note: string | null
  doctor_name: string
  specialty: string
  location: string | null
  contact: string | null
  fee_inr: number | null
  condition_guess: string | null
  severity: string | null
  created_at: string
}

function statusBadge(s: string) {
  if (s === 'confirmed')  return 'bg-green-100 text-green-800 border-green-200'
  if (s === 'cancelled')  return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  }
}

function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now()
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [error, setError]               = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('careRouteToken') : null

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${BACKEND_URL}/api/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAppointments(data.appointments ?? []))
      .catch(() => setError('Could not load appointments.'))
      .finally(() => setLoading(false))
  }, [token])

  async function cancel(id: string) {
    if (!token) return
    setCancellingId(id)
    try {
      const res = await fetch(`${BACKEND_URL}/api/appointments/${id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a)
      )
    } catch {
      alert('Failed to cancel. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const upcoming  = appointments.filter(a => a.status === 'confirmed' && !isPast(a.starts_at))
  const past      = appointments.filter(a => a.status !== 'confirmed' || isPast(a.starts_at))

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-800">My Appointments</span>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">My Appointments</h1>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="text-blue-400 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        {!loading && !error && appointments.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-14 text-center">
            <CalendarDays size={36} className="text-slate-300 mx-auto mb-4" />
            <p className="font-semibold text-slate-600">No appointments yet</p>
            <p className="text-sm text-slate-400 mt-1">Book a slot from your triage results</p>
            <Link href="/patient" className="inline-block mt-5">
              <Button size="sm">Start Assessment</Button>
            </Link>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Upcoming</h2>
            <div className="space-y-3">
              {upcoming.map(a => {
                const { date, time } = formatDateTime(a.starts_at)
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-slate-900">{a.doctor_name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(a.status)}`}>
                            {a.status}
                          </span>
                        </div>
                        <p className="text-blue-600 text-sm font-medium">{a.specialty}</p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={12} />{date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{time} · 30 min
                          </span>
                          {a.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />{a.location}
                            </span>
                          )}
                          {a.fee_inr && (
                            <span className="font-semibold text-slate-700">₹{a.fee_inr}</span>
                          )}
                        </div>

                        {a.condition_guess && (
                          <p className="text-xs text-slate-400 mt-2">
                            For: {a.condition_guess}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        {a.contact && (
                          <a href={`tel:${a.contact}`}>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                              <Phone size={12} />Call
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5 text-xs"
                          disabled={cancellingId === a.id}
                          onClick={() => cancel(a.id)}
                        >
                          {cancellingId === a.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <X size={12} />}
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Past</h2>
            <div className="space-y-3">
              {past.map(a => {
                const { date, time } = formatDateTime(a.starts_at)
                return (
                  <div key={a.id} className={`bg-white rounded-2xl border border-slate-200 p-5 opacity-70`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-slate-700">{a.doctor_name}</span>
                      <span className="text-slate-400 text-sm">{a.specialty}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${statusBadge(a.status)}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{date} · {time}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
