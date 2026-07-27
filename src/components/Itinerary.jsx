import { formatDistance, formatDuration } from '../lib/routing.js'

export default function Itinerary({ days, hasRoute, stopCount, maxHours, onMaxHoursChange }) {
  return (
    <div className="itinerary">
      <label className="setting-row slider-row">
        <span className="setting-label">
          Max driving per day
          <strong className="setting-value">{maxHours} hr</strong>
        </span>
        <input
          type="range"
          min="2"
          max="12"
          step="0.5"
          value={maxHours}
          onChange={(e) => onMaxHoursChange(parseFloat(e.target.value))}
        />
      </label>

      {!hasRoute && (
        <div className="empty-state">
          <div className="empty-road" aria-hidden="true" />
          <p>
            {stopCount < 2
              ? 'Add at least two stops and your days will map themselves out.'
              : 'Waiting on the route…'}
          </p>
        </div>
      )}

      {hasRoute && (
        <ol className="day-list">
          {days.map((d) => (
            <li key={d.day} className="day-card">
              <div className="day-header">
                <span className="day-number">Day {d.day}</span>
                <span className="day-stats">
                  {formatDuration(d.durationSeconds)} · {formatDistance(d.distanceMeters)}
                </span>
              </div>
              <div className="day-route">
                <span className="day-endpoint">{d.startStop.name}</span>
                <span className="day-arrow" aria-hidden="true">⟶</span>
                <span className="day-endpoint">{d.endStop.name}</span>
              </div>
              {d.stopNames.length > 2 && (
                <p className="day-via">via {d.stopNames.slice(1, -1).join(', ')}</p>
              )}
              {d.overLimit && (
                <p className="day-warning">
                  ⚠ This single leg is longer than your daily limit — consider adding a stop
                  between these two.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
