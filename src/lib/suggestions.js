// Trip suggestion engine: computes a break schedule along the route
// (rest/meal breaks + overnight stops), then finds real nearby places
// for each break via the Overpass API (OpenStreetMap data).

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

const BREAK_INTERVAL_HOURS = 2.5
const DEPARTURE_HOUR = 9 // assume 9:00 AM starts for clock estimates
const BREAK_PAUSE_HOURS = 0.75 // assumed time spent at each earlier break

const EAT_TAGS = new Set(['restaurant', 'cafe', 'fast_food', 'diner'])
const SLEEP_TAGS = new Set(['hotel', 'motel', 'guest_house', 'camp_site', 'chalet'])

export function haversineMeters(a, b) {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const la1 = (a[0] * Math.PI) / 180
  const la2 = (b[0] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Interpolate the [lat, lon] a given driving time into the route. */
export function pointAtTime(route, tSeconds) {
  // Convert time -> road distance using per-leg average speeds…
  let accT = 0
  let accD = 0
  let target = route.distanceMeters
  for (const leg of route.legs) {
    if (tSeconds <= accT + leg.durationSeconds) {
      const frac = leg.durationSeconds ? (tSeconds - accT) / leg.durationSeconds : 0
      target = accD + leg.distanceMeters * frac
      break
    }
    accT += leg.durationSeconds
    accD += leg.distanceMeters
  }
  // …then map road distance onto the (simplified) geometry proportionally.
  const geom = route.geometry
  let geomTotal = 0
  for (let i = 1; i < geom.length; i++) geomTotal += haversineMeters(geom[i - 1], geom[i])
  let geomTarget = route.distanceMeters ? (target / route.distanceMeters) * geomTotal : 0
  for (let i = 1; i < geom.length; i++) {
    const d = haversineMeters(geom[i - 1], geom[i])
    if (geomTarget <= d) {
      const f = d ? geomTarget / d : 0
      return [
        geom[i - 1][0] + (geom[i][0] - geom[i - 1][0]) * f,
        geom[i - 1][1] + (geom[i][1] - geom[i - 1][1]) * f,
      ]
    }
    geomTarget -= d
  }
  return geom[geom.length - 1]
}

/**
 * Build the suggested break schedule for a routed trip.
 * @returns {Array<{id, tHours, kind: 'rest'|'overnight', day, clockLabel, lat, lon}>}
 */
export function generateBreaks(route, stops, settings) {
  if (!route || route.legs.length === 0) return []
  const totalH = route.durationSeconds / 3600
  const maxH = settings.maxHours

  const raw = []
  for (let t = maxH; t < totalH - 0.5; t += maxH) raw.push({ t, kind: 'overnight' })
  for (let t = BREAK_INTERVAL_HOURS; t < totalH - 0.75; t += BREAK_INTERVAL_HOURS) {
    if (!raw.some((o) => Math.abs(o.t - t) < 1.25)) raw.push({ t, kind: 'rest' })
  }

  // Skip breaks that land right at an existing stop — you're stopping anyway.
  const boundaries = []
  let acc = 0
  for (const leg of route.legs) {
    acc += leg.durationSeconds / 3600
    boundaries.push(acc)
  }
  const breaks = raw
    .filter((b) => !boundaries.some((bd) => Math.abs(bd - b.t) < 0.33))
    .sort((a, b) => a.t - b.t)

  let prevDay = -1
  let breaksThisDay = 0
  return breaks.map((b) => {
    // An overnight at t = k*maxH ends day k; a rest at that time starts day k+1.
    const day =
      b.kind === 'overnight'
        ? Math.max(0, Math.ceil(b.t / maxH) - 1)
        : Math.min(Math.floor(b.t / maxH), Math.ceil(totalH / maxH) - 1)
    if (day !== prevDay) {
      breaksThisDay = 0
      prevDay = day
    }
    const clockH = DEPARTURE_HOUR + (b.t - day * maxH) + BREAK_PAUSE_HOURS * breaksThisDay
    breaksThisDay += 1
    const [lat, lon] = pointAtTime(route, b.t * 3600)
    return {
      id: `${b.kind}-${b.t.toFixed(2)}`,
      tHours: b.t,
      kind: b.kind,
      day: day + 1,
      clockLabel: b.kind === 'overnight' ? 'evening' : formatClock(clockH),
      lat: round4(lat),
      lon: round4(lon),
    }
  })
}

function formatClock(h) {
  const total = Math.round(h * 60)
  let hh = Math.floor(total / 60) % 24
  const mm = total % 60
  const ampm = hh >= 12 ? 'PM' : 'AM'
  hh = hh % 12 || 12
  return `~${hh}:${String(mm).padStart(2, '0')} ${ampm}`
}

function round4(n) {
  return Math.round(n * 1e4) / 1e4
}

/** Human label for a break point, e.g. "Glenwood Springs, Colorado". */
export async function reverseLabel(lat, lon, signal) {
  const params = new URLSearchParams({ format: 'json', lat, lon, zoom: '10' })
  const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, { signal })
  if (!res.ok) throw new Error('reverse geocode failed')
  const data = await res.json()
  const a = data.address || {}
  const place = a.city || a.town || a.village || a.hamlet || a.county || ''
  const region = a.state || ''
  return [place, region].filter(Boolean).join(', ') || 'the middle of nowhere'
}

/**
 * Find places to eat / see / sleep near a break point.
 * @returns {Promise<{eat: Array, see: Array, sleep: Array}>}
 */
export async function fetchBreakSuggestions(lat, lon, signal) {
  const q = `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](around:12000,${lat},${lon});
  node["tourism"~"^(attraction|museum|viewpoint|gallery|theme_park|zoo)$"]["name"](around:24000,${lat},${lon});
  way["tourism"~"^(attraction|museum|theme_park|zoo)$"]["name"](around:24000,${lat},${lon});
  node["leisure"="park"]["name"](around:12000,${lat},${lon});
  node["tourism"~"^(hotel|motel|guest_house|camp_site)$"]["name"](around:12000,${lat},${lon});
  way["tourism"~"^(hotel|motel)$"]["name"](around:12000,${lat},${lon});
);
out center 120;`
  const res = await fetch(OVERPASS, { method: 'POST', body: `data=${encodeURIComponent(q)}`, signal })
  if (!res.ok) throw new Error(`Overpass request failed (${res.status})`)
  const data = await res.json()

  const buckets = { eat: [], see: [], sleep: [] }
  const seen = new Set()
  for (const el of data.elements || []) {
    const tags = el.tags || {}
    const name = tags.name
    const plat = el.lat ?? el.center?.lat
    const plon = el.lon ?? el.center?.lon
    if (!name || plat == null) continue
    const dedupeKey = name.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    let category
    if (EAT_TAGS.has(tags.amenity)) category = 'eat'
    else if (SLEEP_TAGS.has(tags.tourism)) category = 'sleep'
    else category = 'see'

    buckets[category].push({
      id: `${el.type}-${el.id}`,
      name,
      category,
      detail: describePlace(tags),
      lat: plat,
      lon: plon,
      offMiles: haversineMeters([lat, lon], [plat, plon]) / 1609.344,
      notable: !!(tags.wikipedia || tags.wikidata),
    })
  }
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => (b.notable - a.notable) || (a.offMiles - b.offMiles))
    buckets[key] = buckets[key].slice(0, 8)
  }
  return buckets
}

function describePlace(tags) {
  if (tags.cuisine) return titleCase(tags.cuisine.split(';')[0].replace(/_/g, ' '))
  const kind = tags.tourism || tags.amenity || tags.leisure || ''
  return titleCase(kind.replace(/_/g, ' '))
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
