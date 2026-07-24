import { Router } from 'express'

const router = Router()

// Overpass API — completely free, no key, OpenStreetMap data
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

type OverpassElement = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

type OverpassResponse = {
  elements: OverpassElement[]
}

// GET /api/maps/nearest-er?lat=&lng=
// Returns up to 5 nearby hospitals using Overpass API (OpenStreetMap). Free, no key needed.
router.get('/nearest-er', async (req, res) => {
  const { lat, lng } = req.query

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params required' })
  }

  const latN = Number(lat)
  const lngN = Number(lng)

  if (isNaN(latN) || isNaN(lngN)) {
    return res.status(400).json({ error: 'lat and lng must be numbers' })
  }

  // Overpass QL: hospitals within 5 km, nodes + ways (some hospitals are mapped as areas)
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:5000,${latN},${lngN});
      way["amenity"="hospital"](around:5000,${latN},${lngN});
    );
    out center 8;
  `

  try {
    const apiRes = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!apiRes.ok) {
      throw new Error(`Overpass returned ${apiRes.status}`)
    }

    const data = await apiRes.json() as OverpassResponse

    const hospitals = data.elements
      .map(el => {
        // nodes have lat/lon directly; ways have a center
        const elLat = el.lat ?? el.center?.lat
        const elLng = el.lon ?? el.center?.lon

        if (!elLat || !elLng) return null

        const dLat = (elLat - latN) * 111
        const dLng = (elLng - lngN) * 111 * Math.cos(latN * Math.PI / 180)
        const distKm = parseFloat(Math.sqrt(dLat ** 2 + dLng ** 2).toFixed(1))

        const name    = el.tags?.name ?? 'Hospital'
        const phone   = el.tags?.['contact:phone'] ?? el.tags?.phone ?? null
        const website = el.tags?.website ?? null
        const emergency = el.tags?.emergency === 'yes' || el.tags?.['emergency'] !== 'no'

        return {
          id:       el.id,
          name,
          lat:      elLat,
          lng:      elLng,
          dist_km:  distKm,
          phone,
          website,
          emergency,
          maps_url: `https://www.google.com/maps/dir/?api=1&destination=${elLat},${elLng}&travelmode=driving`,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a!.dist_km - b!.dist_km)
      .slice(0, 5)

    res.json({ hospitals })
  } catch (err) {
    console.error('GET /maps/nearest-er error:', err)
    res.status(502).json({ error: 'Could not reach Overpass API. Try again shortly.' })
  }
})

export default router
