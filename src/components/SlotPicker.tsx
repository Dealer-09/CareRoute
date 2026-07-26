"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useEffect, useState } from 'react'
import { Calendar, Clock, Loader2, CheckCircle, X } from 'lucide-react'
import { Button } from './ui/button'

type Slot = { id: string; starts_at: string }

type Props = {
  doctorId: string
  doctorName: string
  feeInr: number | null
  triageCaseId?: string
  onBooked: (appointmentId: string, startsAt: string) => void
  onClose: () => void
}

function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const date = new Date(slot.starts_at).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(slot)
    return acc
  }, {})
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function SlotPicker({ doctorId, doctorName, feeInr, triageCaseId, onBooked, onClose }: Props) {
  const [slots, setSlots]         = useState<Slot[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Slot | null>(null)
  const [booking, setBooking]     = useState(false)
  const [booked, setBooked]       = useState(false)
  const [error, setError]         = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('careRouteToken') : null

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/doctors/${doctorId}/slots`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setSlots(data.slots)
      } catch {
        setError('Could not load available slots.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [doctorId])

  async function confirmBooking() {
    if (!selected) return
    if (!token) { setError('Please sign in to book an appointment.'); return }
    setBooking(true)
    setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          doctor_id: doctorId,
          slot_id: selected.id,
          triage_case_id: triageCaseId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Booking failed'); return }
      setBooked(true)
      onBooked(data.appointment.id, selected.starts_at)
    } catch {
      setError('Booking failed. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  const grouped = groupByDate(slots)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Book Appointment</h2>
            <p className="text-sm text-slate-500">{doctorName}{feeInr ? ` · ₹${feeInr}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Success */}
          {booked && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle size={48} className="text-green-500" />
              <h3 className="font-bold text-slate-900 text-lg">Appointment Confirmed!</h3>
              <p className="text-slate-500 text-sm">
                {new Date(selected!.starts_at).toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })} at {formatTime(selected!.starts_at)}
              </p>
              <p className="text-xs text-slate-400 mt-1">with {doctorName}</p>
              <Button className="mt-4" onClick={onClose}>Done</Button>
            </div>
          )}

          {/* Loading */}
          {!booked && loading && (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="text-blue-400 animate-spin" />
            </div>
          )}

          {/* Error */}
          {!booked && error && !loading && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}

          {/* Empty */}
          {!booked && !loading && !error && slots.length === 0 && (
            <div className="text-center py-12">
              <Calendar size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">No slots available in the next 7 days</p>
              <p className="text-xs text-slate-400 mt-1">Try contacting the doctor directly</p>
            </div>
          )}

          {/* Slot grid */}
          {!booked && !loading && slots.length > 0 && (
            <div className="space-y-5">
              {Object.entries(grouped).map(([date, daySlots]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={13} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{date}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {daySlots.map(slot => (
                      <button
                        key={slot.id}
                        onClick={() => setSelected(slot)}
                        className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                          selected?.id === slot.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {formatTime(slot.starts_at)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!booked && selected && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock size={14} className="text-blue-500" />
                {new Date(selected.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' · '}{formatTime(selected.starts_at)}
                {' · 30 min'}
              </div>
              <Button onClick={confirmBooking} disabled={booking} className="gap-2">
                {booking ? <><Loader2 size={14} className="animate-spin" />Booking…</> : 'Confirm'}
              </Button>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
