import { useEffect, useRef, useState } from 'react'
import { fetchBreakSuggestions, reverseLabel } from '../lib/suggestions.js'
import { formatDuration } from '../lib/routing.js'

const CATEGORIES = [
  { id: 'eat', label: 'Eat', icon: '🍴' },
  { id: 'see', label: 'See', icon: '📷' },
  { id: 'sleep', label: 'Sleep', icon: '🛏' },
]

export default function SuggestPanel({ breaks, hasRoute, stopCount, addedIds, onAddPoi }) {
  const [expandedId, setExpandedId] = useState(null)
  const [activeCat, setActiveCat] = useState('eat')
  const cacheRef = useRef(new Map()) // break key -> {status, label, pois, error}
  const [, forceRender] = useState(0)

  // Auto-expand the first break when suggestions first appear.
  useEffect(() => {
    if (breaks.length && !expandedId) {
      setExpandedId(breaks[0].id)
      setActiveCat(breaks[0].kind === 'overnight' ? 'sleep' : 'eat')
    }
  }, [breaks, expandedId])

  useEffect(() => {
    const br = breaks.find((b) => b.id === expandedId)
    if (!br) return
    const key = cacheKey(br)
    if (cacheRef.current.has(key)) return
    const controller = new AbortController()
    cacheRef.current.set(key, { status: 'loading' })
    forceRender((n) => n + 1)
    ;(async () => {
      try {
        const [label, pois] = await Promise.all([
          reverseLabel(br.lat, br.lon, controller.signal).catch(() => ''),
          fetchBreakSuggestions(br.lat, br.lon, controller.signal),
        ])
        cacheRef.current.set(key, { status: 'ready', label, pois })
      } catch (err) {
        if (err.name === 'AbortError') {
          cacheRef.current.delete(key)
          return
        }
        cacheRef.current.set(key, { status: 'error', error: err.message })
      }
      forceRender((n) => n + 1)
    })()
    return () => controller.abort()
  }, [expandedId, breaks])

  if (!hasRoute) {
    return (
      <div className="empty-state">
        <div className="empty-road" aria-hidden="true" />
        <p>
          {stopCount < 2
            ? 'Add a start and destination on the Stops tab — Roadiness will draft the whole trip: where to break, where to eat, where to sleep.'
            : 'Waiting on the route…'}
        </p>
      </div>
    )
  }

  if (!breaks.length) {
    return (
      <div className="empty-state">
        <div className="empty-road" aria-hidden="true" />
        <p>Short hop — no breaks needed. Straight shot!</p>
      </div>
    )
  }

  return (
    <div className="suggest-panel">
      <p className="suggest-intro">
        Here's a draft plan for the drive. Open a break to see real places nearby —
        add the ones you like and the route redraws around them.
      </p>
      <ol className="break-list">
        {breaks.map((br) => {
          const open = expandedId === br.id
          const entry = cacheRef.current.get(cacheKey(br))
          return (
            <li key={br.id} className={`break-card ${br.kind} ${open ? 'open' : ''}`}>
              <button
                className="break-header"
                onClick={() => {
                  setExpandedId(open ? null : br.id)
                  if (!open) setActiveCat(br.kind === 'overnight' ? 'sleep' : 'eat')
                }}
                aria-expanded={open}
              >
                <span className="break-kind-icon" aria-hidden="true">
                  {br.kind === 'overnight' ? '🌙' : '☕'}
                </span>
                <span className="break-title-wrap">
                  <span className="break-title">
                    {br.kind === 'overnight' ? 'Overnight stop' : 'Stretch & eat'}
                  </span>
                  <span className="break-sub">
                    Day {br.day} · {br.clockLabel} · {formatDuration(br.tHours * 3600)} in
                    {entry?.label ? ` · near ${entry.label}` : ''}
                  </span>
                </span>
                <span className="break-chevron" aria-hidden="true">
                  {open ? '▾' : '▸'}
                </span>
              </button>

              {open && (
                <div className="break-body">
                  {(!entry || entry.status === 'loading') && (
                    <p className="break-loading">scouting the area…</p>
                  )}
                  {entry?.status === 'error' && (
                    <p className="route-error">⚠ Couldn't load places: {entry.error}</p>
                  )}
                  {entry?.status === 'ready' && (
                    <>
                      <div className="cat-chips" role="tablist">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c.id}
                            role="tab"
                            aria-selected={activeCat === c.id}
                            className={`chip ${activeCat === c.id ? 'active' : ''}`}
                            onClick={() => setActiveCat(c.id)}
                          >
                            {c.icon} {c.label}
                            <span className="chip-count">{entry.pois[c.id].length}</span>
                          </button>
                        ))}
                      </div>
                      {entry.pois[activeCat].length === 0 ? (
                        <p className="break-loading">nothing found nearby — remote country out here</p>
                      ) : (
                        <ul className="poi-list">
                          {entry.pois[activeCat].map((poi) => {
                            const added = addedIds.has(poi.id)
                            return (
                              <li key={poi.id} className="poi-row">
                                <span className="poi-info">
                                  <span className="poi-name">
                                    {poi.name}
                                    {poi.notable && (
                                      <span className="poi-star" title="Notable spot">★</span>
                                    )}
                                  </span>
                                  <span className="poi-detail">
                                    {poi.detail}
                                    {' · '}
                                    {poi.offMiles < 0.6
                                      ? 'right on route'
                                      : `${poi.offMiles.toFixed(1)} mi off route`}
                                  </span>
                                </span>
                                <button
                                  className={`poi-add ${added ? 'added' : ''}`}
                                  disabled={added}
                                  onClick={() => onAddPoi(poi)}
                                  aria-label={added ? `${poi.name} added` : `Add ${poi.name} to trip`}
                                >
                                  {added ? '✓' : '+'}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function cacheKey(br) {
  return `${br.lat},${br.lon}`
}
