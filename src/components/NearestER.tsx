"use client"

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Navigation, Loader2, ExternalLink, AlertCircle, Phone } from 'lucide-react'

// ─── Leaflet must be dynamically imported — it uses window ───────────────────
const ERMap = dynamic(() => import('./ERMap'), { ssr: false, loading: () => (
  <div className="h-52 bg-slate-100 rounded-xl flex items-center justify-center">
    <Loader2 size={20} className="animate-spin text-slate-400" />
  </div>
)})

// ─── Types ───────────────────────────────────────────────────────────────────
type Hospital = {
  id: number
  name: string
  lat: number
  lng: number
  dist_km: number
  phone: string | null
  website: string | null
  emergency: boolean
  maps_url: string
}

type UserCoords = { lat: number; lng: number }

type State =
  | { status: 'locating' }
  | { status: 'loading'; coords: UserCoords }
  | { status: 'done';    coords: UserCoords; hospitals: Hospital[] }
  | { status: 'error';   message: string }

// ─── Component ───────────────────────────────────────────────────────────────
export default function NearestER() {
  const [state, setState] = useState<State>({ status: 'locating' })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ status: 'error', message: 'Geolocation is not supported by your browser.' })
      return
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const userCoords = { lat: coords.latitude, lng: coords.longitude }
        setState({ status: 'loading', coords: userCoords })

        try {
          const res = await fetch(
            `http://localhost:4000/api/maps/nearest-er?lat=${userCoords.lat}&lng=${userCoords.lng}`
          )
          if (!res.ok) throw new Error()
          const data = await res.json()
          setState({ status: 'done', coords: userCoords, hospitals: data.hospitals })
        } catch {
          setState({ status: 'error', message: 'Could not fetch nearby hospitals. Try again shortly.' })
        }
      },
      () => setState({
        status: 'error',
        message: 'Location access denied. Enable location permissions to find nearest ERs.',
      }),
      { timeout: 8000 }
    )
  }, [])

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <MapPin size={18} className="text-red-600 shrink-0" />
        <span className="font-bold text-red-800 text-sm uppercase tracking-wide">Nearest Emergency Rooms</span>
      </div>

      {/* Locating */}
      {state.status === 'locating' && (
        <div className="flex items-center gap-2 text-sm text-red-700 px-5 pb-5">
          <Loader2 size={15} className="animate-spin shrink-0" />
          Getting your location…
        </div>
      )}

      {/* Loading hospitals */}
      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-red-700 px-5 pb-5">
          <Loader2 size={15} className="animate-spin shrink-0" />
          Finding nearest hospitals via OpenStreetMap…
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-start gap-2 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            {state.message}
          </div>
          <a
            href="https://www.google.com/maps/search/emergency+hospital+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-900 underline underline-offset-2"
          >
            <ExternalLink size={14} />
            Search "Emergency Hospital Near Me" on Google Maps →
          </a>
        </div>
      )}

      {/* Map + list */}
      {state.status === 'done' && (
        <>
          {/* Leaflet map */}
          <div className="px-5 pb-3">
            <ERMap
              userLat={state.coords.lat}
              userLng={state.coords.lng}
              hospitals={state.hospitals}
            />
          </div>

          {/* Hospital list */}
          <ul className="divide-y divide-red-100">
            {state.hospitals.length === 0 && (
              <li className="px-5 py-4 text-sm text-red-700">
                No hospitals found within 5 km. Call <strong>112</strong> immediately.
              </li>
            )}
            {state.hospitals.map((h, i) => (
              <li key={h.id} className="px-5 py-3.5 flex items-start gap-3 bg-white/60 hover:bg-white/90 transition-colors">
                {/* Rank badge */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  i === 0 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'
                }`}>
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">{h.name}</p>
                    {h.emergency && (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-full">ER</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{h.dist_km} km away</p>
                  {h.phone && (
                    <a
                      href={`tel:${h.phone}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                    >
                      <Phone size={11} />{h.phone}
                    </a>
                  )}
                </div>

                {/* Directions */}
                <a
                  href={h.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Navigation size={12} />
                  Go
                </a>
              </li>
            ))}
          </ul>

          <p className="text-[10px] text-slate-400 text-center px-5 py-2">
            Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors
          </p>
        </>
      )}
    </div>
  )
}
