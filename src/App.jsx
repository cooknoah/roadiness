import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView.jsx'
import SearchBox from './components/SearchBox.jsx'
import StopList from './components/StopList.jsx'
import SuggestPanel from './components/SuggestPanel.jsx'
import Itinerary from './components/Itinerary.jsx'
import Costs from './components/Costs.jsx'
import TripsPanel from './components/TripsPanel.jsx'
import { fetchRoute, formatDistance, formatDuration } from './lib/routing.js'
import { decodeTripFromHash, insertIndexFor, makeId, splitIntoDays } from './lib/tripUtils.js'
import { fetchIconicStops } from './lib/suggestions.js'
import { IconCompass } from './components/icons.jsx'

const DEFAULT_SETTINGS = {
  maxHours: 6,
  mpg: 28,
  gasPrice: 3.5,
  lodgingPerNight: 120,
  foodPerDay: 45,
}

const TABS = [
  { id: 'stops', label: 'Stops' },
  { id: 'suggest', label: 'Suggest' },
  { id: 'days', label: 'Days' },
  { id: 'costs', label: 'Costs' },
  { id: 'trips', label: 'Trips' },
]

export default function App() {
  const [tripName, setTripName] = useState('My Road Trip')
  const [stops, setStops] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [route, setRoute] = useState(null)
  const [routeStatus, setRouteStatus] = useState('idle') // idle | loading | error
  const [routeError, setRouteError] = useState('')
  const [tab, setTab] = useState('stops')
  const routeRequestRef = useRef(0)
  const [iconic, setIconic] = useState({ status: 'idle', list: [] })
  const [iconicTick, setIconicTick] = useState(0)
  const iconicKeyRef = useRef(null)

  // Load a shared trip from the URL hash on first mount.
  useEffect(() => {
    const shared = decodeTripFromHash(window.location.hash)
    if (shared && shared.stops.length) {
      setTripName(shared.name)
      setStops(shared.stops)
      if (shared.settings) setSettings({ ...DEFAULT_SETTINGS, ...shared.settings })
    }
  }, [])

  // Re-route whenever stops change (debounced, stale responses discarded).
  useEffect(() => {
    if (stops.length < 2) {
      setRoute(null)
      setRouteStatus('idle')
      return
    }
    const requestId = ++routeRequestRef.current
    setRouteStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const result = await fetchRoute(stops)
        if (routeRequestRef.current !== requestId) return
        setRoute(result)
        setRouteStatus('idle')
        setRouteError('')
      } catch (err) {
        if (routeRequestRef.current !== requestId) return
        setRoute(null)
        setRouteStatus('error')
        setRouteError(err.message)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [stops])

  // Fetch iconic sights when the Suggest tab is open. Keyed by endpoints +
  // coarse route length so adding an on-route sight doesn't refetch, but a
  // genuinely different route does.
  useEffect(() => {
    if (tab !== 'suggest' || !route || stops.length < 2) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    const key = `${first.lat},${first.lon}|${last.lat},${last.lon}|${Math.round(route.distanceMeters / 50000)}`
    if (iconicKeyRef.current === key) return
    iconicKeyRef.current = key
    const controller = new AbortController()
    setIconic({ status: 'loading', list: [] })
    fetchIconicStops(route, stops, controller.signal)
      .then((list) => setIconic({ status: 'ready', list }))
      .catch((err) => {
        if (err.name === 'AbortError') {
          iconicKeyRef.current = null
          return
        }
        iconicKeyRef.current = null
        setIconic({ status: 'error', list: [] })
      })
    return () => controller.abort()
  }, [tab, route, stops, iconicTick])

  const retryIconic = useCallback(() => {
    iconicKeyRef.current = null
    setIconicTick((n) => n + 1)
  }, [])

  const addStop = useCallback((place) => {
    setStops((prev) => [
      ...prev,
      { id: makeId(), name: place.name, lat: place.lat, lon: place.lon },
    ])
  }, [])

  const removeStop = useCallback((id) => {
    setStops((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const moveStop = useCallback((id, dir) => {
    setStops((prev) => {
      const i = prev.findIndex((s) => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }, [])

  const reorderStop = useCallback((from, to) => {
    setStops((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length)
        return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  // Add a suggested place, slotted between whichever existing stops it
  // falls closest to along the route.
  const addPoi = useCallback((poi) => {
    setStops((prev) => {
      const idx = insertIndexFor([poi.lat, poi.lon], prev)
      const next = [...prev]
      next.splice(idx, 0, {
        id: makeId(),
        name: poi.name,
        lat: poi.lat,
        lon: poi.lon,
        poiId: poi.id,
      })
      return next
    })
  }, [])

  const loadTrip = useCallback((trip) => {
    setTripName(trip.name)
    setStops(trip.stops.map((s) => ({ ...s, id: s.id || makeId() })))
    if (trip.settings) setSettings({ ...DEFAULT_SETTINGS, ...trip.settings })
    setTab('stops')
  }, [])

  const days = route ? splitIntoDays(stops, route.legs, settings.maxHours) : []

  const addedPoiIds = useMemo(
    () => new Set(stops.map((s) => s.poiId).filter(Boolean)),
    [stops],
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="masthead">
          <div className="masthead-badge">
            <span className="badge-route">RT</span>
            <span className="badge-num">66</span>
          </div>
          <div>
            <h1 className="wordmark">Roadiness</h1>
            <p className="tagline">plan the drive, love the detours</p>
          </div>
        </header>

        <input
          className="trip-name"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          placeholder="Name this trip"
          aria-label="Trip name"
        />

        {route && (
          <div className="trip-summary">
            <div className="summary-stat">
              <span className="stat-value">{formatDistance(route.distanceMeters)}</span>
              <span className="stat-label">total</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="stat-value">{formatDuration(route.durationSeconds)}</span>
              <span className="stat-label">driving</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="stat-value">{days.length || '—'}</span>
              <span className="stat-label">{days.length === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        )}

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="panel">
          {tab === 'stops' && (
            <>
              <SearchBox onSelect={addStop} />
              {routeStatus === 'error' && (
                <p className="route-error">{routeError}</p>
              )}
              <StopList
                stops={stops}
                route={route}
                loading={routeStatus === 'loading'}
                onRemove={removeStop}
                onMove={moveStop}
                onReorder={reorderStop}
              />
              {stops.length >= 2 && (
                <button className="btn suggest-cta" onClick={() => setTab('suggest')}>
                  <IconCompass /> Suggest my trip
                </button>
              )}
            </>
          )}
          {tab === 'suggest' && (
            <SuggestPanel
              status={iconic.status}
              iconicStops={iconic.list}
              hasRoute={!!route}
              stopCount={stops.length}
              addedIds={addedPoiIds}
              onAddPoi={addPoi}
              onRetry={retryIconic}
            />
          )}
          {tab === 'days' && (
            <Itinerary
              days={days}
              hasRoute={!!route}
              stopCount={stops.length}
              maxHours={settings.maxHours}
              onMaxHoursChange={(v) => setSettings((s) => ({ ...s, maxHours: v }))}
            />
          )}
          {tab === 'costs' && (
            <Costs
              route={route}
              dayCount={days.length}
              settings={settings}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            />
          )}
          {tab === 'trips' && (
            <TripsPanel
              tripName={tripName}
              stops={stops}
              settings={settings}
              onLoad={loadTrip}
            />
          )}
        </div>
      </aside>

      <main className="map-wrap">
        <MapView
          stops={stops}
          route={route}
          loading={routeStatus === 'loading'}
          suggestions={
            tab === 'suggest' && iconic.status === 'ready'
              ? iconic.list.filter((p) => !addedPoiIds.has(p.id))
              : []
          }
        />
      </main>
    </div>
  )
}
