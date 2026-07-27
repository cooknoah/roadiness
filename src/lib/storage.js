const KEY = 'roadiness.trips.v1'

export function loadSavedTrips() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveTrip(trip) {
  const list = loadSavedTrips()
  const existing = list.findIndex((t) => t.name === trip.name)
  const record = { ...trip, savedAt: Date.now() }
  if (existing >= 0) list[existing] = record
  else list.unshift(record)
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}

export function deleteTrip(name) {
  const list = loadSavedTrips().filter((t) => t.name !== name)
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}
