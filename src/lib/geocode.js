// Place search via Nominatim (OpenStreetMap). Free, no key; keep request
// volume polite (debounced in the UI, limit=5).

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

/**
 * Search for places matching a query.
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{name: string, displayName: string, lat: number, lon: number}>>}
 */
export async function searchPlaces(query, signal) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    addressdetails: '0',
  })
  const res = await fetch(`${NOMINATIM_BASE}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Place search failed (${res.status})`)
  const data = await res.json()
  return data.map((r) => ({
    name: shortName(r.display_name),
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }))
}

function shortName(displayName) {
  const parts = displayName.split(',').map((p) => p.trim())
  if (parts.length <= 2) return displayName
  // First part + the region: walk back from the country, skipping
  // postcodes and duplicates, e.g.
  // "Moab, Grand County, Utah, 84532, United States" -> "Moab, Utah"
  for (let i = parts.length - 2; i > 0; i--) {
    const p = parts[i]
    if (/\d/.test(p) || p === parts[0]) continue
    return `${parts[0]}, ${p}`
  }
  return parts[0]
}
