import { useEffect, useRef, useState } from 'react'
import { fetchPlacePhotos, wikiTitleFromUrl } from '../lib/suggestions.js'

export default function SuggestPanel({ status, iconicStops, hasRoute, stopCount, addedIds, onAddPoi, onRetry }) {
  const [expandedId, setExpandedId] = useState(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const photoCacheRef = useRef(new Map()) // poi.id -> string[] of photo urls
  const [, bump] = useState(0)

  useEffect(() => setPhotoIdx(0), [expandedId])

  // Lazily fetch up to 3 photos for the expanded place, once.
  useEffect(() => {
    const poi = iconicStops.find((p) => p.id === expandedId)
    if (!poi || photoCacheRef.current.has(poi.id)) return
    const fallback = poi.image ? [poi.image] : []
    const title = wikiTitleFromUrl(poi.wikiUrl)
    if (!title) {
      photoCacheRef.current.set(poi.id, fallback)
      return
    }
    const controller = new AbortController()
    fetchPlacePhotos(title, controller.signal)
      .then((photos) => {
        photoCacheRef.current.set(poi.id, photos.length ? photos : fallback)
        bump((n) => n + 1)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        photoCacheRef.current.set(poi.id, fallback)
        bump((n) => n + 1)
      })
    return () => controller.abort()
  }, [expandedId, iconicStops])
  if (!hasRoute) {
    return (
      <div className="empty-state">
        <div className="empty-road" aria-hidden="true" />
        <p>
          {stopCount < 2
            ? 'Add a start and destination on the Stops tab — Roadiness will surface the iconic sights along the way.'
            : 'Waiting on the route…'}
        </p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="empty-state">
        <div className="empty-road" aria-hidden="true" />
        <p className="break-loading">scouting the route for the good stuff…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="break-error">
        <p className="route-error">
          Couldn't load sights right now — the free places service gets busy.
        </p>
        <button className="btn retry-btn" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  const remaining = iconicStops.filter((poi) => !addedIds.has(poi.id))

  if (!remaining.length) {
    return (
      <div className="empty-state">
        <div className="empty-road" aria-hidden="true" />
        <p>
          {iconicStops.length
            ? "You've added every big sight we found. Enjoy the drive!"
            : 'No famous sights within reach of this route — sometimes the road itself is the destination.'}
        </p>
      </div>
    )
  }

  return (
    <div className="suggest-panel">
      <p className="suggest-intro">
        The iconic sights along your route, in driving order. Add the ones worth the
        detour — the route redraws around them.
      </p>
      <ul className="poi-list">
        {remaining.map((poi) => {
          const open = expandedId === poi.id
          return (
            <li key={poi.id} className={`poi-row expandable ${open ? 'open' : ''}`}>
              <div className="poi-row-top">
                <button
                  className="poi-toggle"
                  onClick={() => setExpandedId(open ? null : poi.id)}
                  aria-expanded={open}
                >
                  <span className="poi-info">
                    <span className="poi-name">{poi.name}</span>
                    <span className="poi-detail">
                      {poi.kind}
                      {' · '}
                      {poi.offMiles < 0.6
                        ? 'right on route'
                        : `${poi.offMiles.toFixed(1)} mi off route`}
                    </span>
                  </span>
                  <span className="poi-chevron" aria-hidden="true">
                    {open ? '▾' : '▸'}
                  </span>
                </button>
                <button
                  className="poi-add"
                  onClick={() => onAddPoi(poi)}
                  aria-label={`Add ${poi.name} to trip`}
                >
                  +
                </button>
              </div>
              {open && (
                <div className="poi-expand">
                  <PhotoCarousel
                    photos={photoCacheRef.current.get(poi.id) ?? (poi.image ? [poi.image] : [])}
                    name={poi.name}
                    idx={photoIdx}
                    onStep={(dir) => setPhotoIdx((n) => n + dir)}
                  />
                  <div className="poi-links">
                    {poi.website && (
                      <a
                        className="btn poi-link"
                        href={poi.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Official site
                      </a>
                    )}
                    {poi.wikiUrl && (
                      <a
                        className="btn poi-link"
                        href={poi.wikiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Wikipedia
                      </a>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PhotoCarousel({ photos, name, idx, onStep }) {
  if (!photos.length) return null
  const current = ((idx % photos.length) + photos.length) % photos.length
  return (
    <div className="poi-carousel">
      <img
        className="poi-photo"
        src={photos[current]}
        alt={`${name} — photo ${current + 1} of ${photos.length}`}
        loading="lazy"
        onClick={() => photos.length > 1 && onStep(1)}
      />
      {photos.length > 1 && (
        <>
          <button
            className="carousel-arrow left"
            onClick={() => onStep(-1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            className="carousel-arrow right"
            onClick={() => onStep(1)}
            aria-label="Next photo"
          >
            ›
          </button>
          <div className="carousel-dots" aria-hidden="true">
            {photos.map((_, i) => (
              <span key={i} className={`dot ${i === current ? 'active' : ''}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
