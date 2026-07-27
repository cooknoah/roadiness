export default function SuggestPanel({ status, iconicStops, hasRoute, stopCount, addedIds, onAddPoi, onRetry }) {
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
        {remaining.map((poi) => (
          <li key={poi.id} className="poi-row">
            <span className="poi-info">
              <span className="poi-name">{poi.name}</span>
              <span className="poi-detail">
                {poi.kind}
                {' · '}
                {poi.offMiles < 0.6 ? 'right on route' : `${poi.offMiles.toFixed(1)} mi off route`}
              </span>
            </span>
            <button
              className="poi-add"
              onClick={() => onAddPoi(poi)}
              aria-label={`Add ${poi.name} to trip`}
            >
              +
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
