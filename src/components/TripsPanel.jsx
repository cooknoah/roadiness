import { useState } from 'react'
import { loadSavedTrips, saveTrip, deleteTrip } from '../lib/storage.js'
import { encodeTripToHash } from '../lib/tripUtils.js'

export default function TripsPanel({ tripName, stops, settings, onLoad }) {
  const [saved, setSaved] = useState(loadSavedTrips)
  const [notice, setNotice] = useState('')

  function flash(msg) {
    setNotice(msg)
    setTimeout(() => setNotice(''), 2500)
  }

  function handleSave() {
    if (!stops.length) return flash('Add some stops first')
    setSaved(saveTrip({ name: tripName, stops, settings }))
    flash(`Saved “${tripName}”`)
  }

  async function handleShare() {
    if (!stops.length) return flash('Add some stops first')
    const url = `${window.location.origin}${window.location.pathname}${encodeTripToHash({ name: tripName, stops, settings })}`
    try {
      await navigator.clipboard.writeText(url)
      flash('Share link copied to clipboard')
    } catch {
      window.prompt('Copy this share link:', url)
    }
  }

  function handleDelete(name) {
    setSaved(deleteTrip(name))
  }

  return (
    <div className="trips-panel">
      <div className="trip-actions">
        <button className="btn primary" onClick={handleSave}>
          Save trip
        </button>
        <button className="btn" onClick={handleShare}>
          Copy share link
        </button>
      </div>
      {notice && <p className="notice">{notice}</p>}

      <h3 className="section-heading">Saved trips</h3>
      {!saved.length ? (
        <div className="empty-state">
          <div className="empty-road" aria-hidden="true" />
          <p>No saved trips yet. Plan one and hit save.</p>
        </div>
      ) : (
        <ul className="saved-list">
          {saved.map((t) => (
            <li key={t.name} className="saved-item">
              <button className="saved-load" onClick={() => onLoad(t)} title="Load this trip">
                <span className="saved-name">{t.name}</span>
                <span className="saved-meta">
                  {t.stops.length} stops
                  {t.savedAt ? ` · ${new Date(t.savedAt).toLocaleDateString()}` : ''}
                </span>
              </button>
              <button
                className="icon-btn remove"
                onClick={() => handleDelete(t.name)}
                aria-label={`Delete ${t.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
