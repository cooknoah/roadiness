// Routing provider abstraction. Currently backed by the public OSRM demo
// server; swap fetchRoute's implementation to move to Mapbox/Google later.

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Fetch a driving route through the given stops (in order).
 * @param {Array<{lat: number, lon: number}>} stops - at least 2
 * @returns {Promise<{
 *   distanceMeters: number,
 *   durationSeconds: number,
 *   geometry: Array<[number, number]>,  // [lat, lon] pairs for Leaflet
 *   legs: Array<{distanceMeters: number, durationSeconds: number}>
 * }>}
 */
export async function fetchRoute(stops) {
  const coords = stops.map((s) => `${s.lon},${s.lat}`).join(';')
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=false`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Routing request failed (${res.status})`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(data.message || 'No route found between those stops')
  }
  const route = data.routes[0]
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    legs: route.legs.map((leg) => ({
      distanceMeters: leg.distance,
      durationSeconds: leg.duration,
    })),
  }
}

export function metersToMiles(m) {
  return m / 1609.344
}

export function formatDistance(meters) {
  const miles = metersToMiles(meters)
  return miles >= 10 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`
}

export function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} hr`
  return `${h} hr ${m} min`
}
