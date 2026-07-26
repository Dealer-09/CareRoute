"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useEffect, useState } from 'react'
import { Star, MapPin, Phone, Briefcase, Loader2, CalendarDays } from 'lucide-react'
import { Button } from './ui/button'
import SlotPicker from './SlotPicker'

type Doctor = {
  id: string
  name: string
  specialty: string
  location: string | null
  contact: string | null
  bio: string | null
  experience_yrs: number | null
  fee_inr: number | null
  rating: number | null
}

type Props = {
  specialty: string
  triageCaseId?: string
}

export default function DoctorList({ specialty, triageCaseId }: Props) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [pickingFor, setPickingFor] = useState<Doctor | null>(null)
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/doctors${specialty ? `?specialty=${encodeURIComponent(specialty)}` : ''}`
        )
        if (!res.ok) throw new Error()
        const data = await res.json()
        setDoctors(data.doctors.length > 0 ? data.doctors : await fallbackGeneralMedicine())
      } catch {
        setDoctors([])
      } finally {
        setLoading(false)
      }
    }

    async function fallbackGeneralMedicine() {
      const res = await fetch(`${BACKEND_URL}/api/doctors?specialty=General Medicine`)
      if (!res.ok) return []
      const data = await res.json()
      return data.doctors
    }

    load()
  }, [specialty])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={24} className="text-blue-400 animate-spin" />
      </div>
    )
  }

  if (doctors.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
        No doctors found for <strong>{specialty}</strong>. Try contacting a hospital directly.
      </p>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map(d => (
          <div
            key={d.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col gap-3"
          >
            {/* Name + specialty */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-slate-900 leading-tight">{d.name}</h3>
                {d.rating && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold shrink-0">
                    <Star size={12} fill="currentColor" />
                    {d.rating}
                  </div>
                )}
              </div>
              <p className="text-blue-600 text-sm font-medium mt-0.5">{d.specialty}</p>
            </div>

            {/* Bio */}
            {d.bio && <p className="text-xs text-slate-500 line-clamp-2">{d.bio}</p>}

            {/* Meta */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              {d.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} />{d.location}
                </span>
              )}
              {d.experience_yrs && (
                <span className="flex items-center gap-1">
                  <Briefcase size={11} />{d.experience_yrs} yrs exp
                </span>
              )}
              {d.fee_inr && (
                <span className="font-semibold text-slate-700">₹{d.fee_inr} / visit</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto pt-1">
              {d.contact && (
                <a href={`tel:${d.contact}`} className="flex-1">
                  <Button variant="outline" className="w-full gap-1.5 text-xs h-9">
                    <Phone size={13} /> Call
                  </Button>
                </a>
              )}
              <Button
                className={`flex-1 gap-1.5 text-xs h-9 ${bookedIds.has(d.id) ? 'bg-green-600 hover:bg-green-700' : ''}`}
                onClick={() => setPickingFor(d)}
              >
                <CalendarDays size={13} />
                {bookedIds.has(d.id) ? 'Booked ✓' : 'Book Slot'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Slot picker modal */}
      {pickingFor && (
        <SlotPicker
          doctorId={pickingFor.id}
          doctorName={pickingFor.name}
          feeInr={pickingFor.fee_inr}
          triageCaseId={triageCaseId}
          onBooked={(_, startsAt) => {
            setBookedIds(prev => new Set(prev).add(pickingFor.id))
            setPickingFor(null)
          }}
          onClose={() => setPickingFor(null)}
        />
      )}
    </>
  )
}
