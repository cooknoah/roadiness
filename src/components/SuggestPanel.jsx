import { useState } from 'react'

export default function SuggestPanel({ status, iconicStops, hasRoute, stopCount, addedIds, onAddPoi, onRetry }) {
  const [expandedId, setExpandedId] = useState(null)
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
                  {poi.image && (
                    <img
                      className="poi-photo"
                      src={poi.image}
                      alt={poi.name}
                      loading="lazy"
                    />
                  )}
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
