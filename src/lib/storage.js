const KEY = 'roadiness.trips.v1'
const CURRENT_KEY = 'roadiness.current.v1'

// Working-trip autosave: the in-progress trip survives reloads, closed
// tabs, and accidental navigation without an explicit save.
export function saveCurrentTrip(trip) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(trip))
  } catch {
    // storage full/blocked — autosave is best-effort
  }
}

export function loadCurrentTrip() {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    const trip = raw ? JSON.parse(raw) : null
    return trip && Array.isArray(trip.stops) ? trip : null
  } catch {
    return null
  }
}

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
