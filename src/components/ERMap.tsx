"use client"

/**
 * ERMap — Leaflet map showing the user's location + nearby hospital markers.
 * This file is ONLY imported via dynamic() with ssr:false in NearestER.tsx
 * because Leaflet requires the browser window object.
 */

import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet's default icon paths broken by webpack/Next.js bundling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Red hospital marker
const hospitalIcon = new L.Icon({
  iconUrl:       'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
})

// Blue user location marker
const userIcon = new L.Icon({
  iconUrl:       'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
})

type Hospital = {
  id: number
  name: string
  lat: number
  lng: number
  dist_km: number
  maps_url: string
}

type Props = {
  userLat: number
  userLng: number
  hospitals: Hospital[]
}

// Auto-fit bounds to show user + all hospitals
function BoundsFitter({ userLat, userLng, hospitals }: Props) {
  const map = useMap()
  useEffect(() => {
    if (hospitals.length === 0) {
      map.setView([userLat, userLng], 14)
      return
    }
    const points: [number, number][] = [
      [userLat, userLng],
      ...hospitals.map(h => [h.lat, h.lng] as [number, number]),
    ]
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
  }, [map, userLat, userLng, hospitals])
  return null
}

export default function ERMap({ userLat, userLng, hospitals }: Props) {
  return (
    <div className="h-52 w-full rounded-xl overflow-hidden border border-red-100">
      <MapContainer
        center={[userLat, userLng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={false}
      >
        {/* OpenStreetMap tiles — free, attribution required */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <BoundsFitter userLat={userLat} userLng={userLng} hospitals={hospitals} />

        {/* User location */}
        <Marker position={[userLat, userLng]} icon={userIcon}>
          <Popup>📍 Your location</Popup>
        </Marker>

        {/* Hospital markers */}
        {hospitals.map((h, i) => (
          <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
            <Popup>
              <div className="text-sm">
                <strong>#{i + 1} {h.name}</strong>
                <br />
                {h.dist_km} km away
                <br />
                <a
                  href={h.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Get Directions →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
