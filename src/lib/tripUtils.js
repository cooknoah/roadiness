import { metersToMiles } from './routing.js'

/**
 * Split a routed trip into driving days. Days end at stops: we accumulate
 * legs until adding the next leg would push the day past maxHoursPerDay
 * (a day always gets at least one leg, so a single monster leg still fits
 * in one day rather than looping forever).
 *
 * @param {Array<{id: string, name: string}>} stops
 * @param {Array<{distanceMeters: number, durationSeconds: number}>} legs
 * @param {number} maxHoursPerDay
 * @returns {Array<{
 *   day: number,
 *   startStop: object, endStop: object,
 *   stopNames: string[],
 *   durationSeconds: number, distanceMeters: number,
 *   overLimit: boolean
 * }>}
 */
export function splitIntoDays(stops, legs, maxHoursPerDay) {
  if (!legs.length || stops.length < 2) return []
  const maxSeconds = maxHoursPerDay * 3600
  const days = []
  let current = null

  legs.forEach((leg, i) => {
    const from = stops[i]
    const to = stops[i + 1]
    if (current && current.durationSeconds + leg.durationSeconds > maxSeconds) {
      days.push(current)
      current = null
    }
    if (!current) {
      current = {
        day: days.length + 1,
        startStop: from,
        endStop: to,
        stopNames: [from.name, to.name],
        durationSeconds: leg.durationSeconds,
        distanceMeters: leg.distanceMeters,
        overLimit: leg.durationSeconds > maxSeconds,
      }
    } else {
      current.endStop = to
      current.stopNames.push(to.name)
      current.durationSeconds += leg.durationSeconds
      current.distanceMeters += leg.distanceMeters
    }
  })
  if (current) days.push(current)
  return days
}

/**
 * Estimate trip costs.
 * @returns {{fuel: number, lodging: number, food: number, total: number, nights: number, days: number}}
 */
export function estimateCosts(route, dayCount, settings) {
  const { mpg, gasPrice, lodgingPerNight, foodPerDay } = settings
  const miles = route ? metersToMiles(route.distanceMeters) : 0
  const fuel = mpg > 0 ? (miles / mpg) * gasPrice : 0
  const nights = Math.max(0, dayCount - 1)
  const lodging = nights * lodgingPerNight
  const food = dayCount * foodPerDay
  return { fuel, lodging, food, total: fuel + lodging + food, nights, days: dayCount }
}

export function formatMoney(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// --- Share links: trip encoded as base64url JSON in the URL hash ---

export function encodeTripToHash(trip) {
  const payload = {
    n: trip.name,
    s: trip.stops.map((st) => [st.name, round5(st.lat), round5(st.lon)]),
    g: trip.settings,
  }
  const json = JSON.stringify(payload)
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `#trip=${b64}`
}

export function decodeTripFromHash(hash) {
  const match = hash.match(/#trip=([A-Za-z0-9_-]+)/)
  if (!match) return null
  try {
    const b64 = match[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b64)))
    const payload = JSON.parse(json)
    return {
      name: typeof payload.n === 'string' ? payload.n : 'Shared trip',
      stops: (payload.s || []).map(([name, lat, lon], i) => ({
        id: `shared-${i}-${lat}-${lon}`,
        name: String(name),
        lat: Number(lat),
        lon: Number(lon),
      })),
      settings: payload.g || null,
    }
  } catch {
    return null
  }
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5
}

/**
 * Where to insert a new stop so it falls between the pair of existing
 * stops whose connecting segment passes closest to it.
 */
export function insertIndexFor(point, stops) {
  if (stops.length < 2) return stops.length
  let best = 1
  let bestD = Infinity
  for (let i = 0; i < stops.length - 1; i++) {
    const d = distToSegment(point, [stops[i].lat, stops[i].lon], [stops[i + 1].lat, stops[i + 1].lon])
    if (d < bestD) {
      bestD = d
      best = i + 1
    }
  }
  return best
}

// Planar approximation (lon scaled by cos(lat)) — fine at trip scales.
function distToSegment([plat, plon], [alat, alon], [blat, blon]) {
  const k = Math.cos((plat * Math.PI) / 180)
  const p = [plat, plon * k]
  const a = [alat, alon * k]
  const b = [blat, blon * k]
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const lenSq = abx * abx + aby * aby
  let t = lenSq ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const cx = a[0] + abx * t - p[0]
  const cy = a[1] + aby * t - p[1]
  return Math.sqrt(cx * cx + cy * cy)
}

export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
