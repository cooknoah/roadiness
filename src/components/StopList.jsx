import { useRef, useState } from 'react'
import { formatDistance, formatDuration } from '../lib/routing.js'

export default function StopList({ stops, route, loading, onRemove, onMove, onReorder }) {
  const listRef = useRef(null)
  const dragRef = useRef(null) // { from, over }
  const [drag, setDrag] = useState(null)

  if (!stops.length) {
    return (
      <div className="empty-state">
        <div className="empty-road" aria-hidden="true" />
        <p>
          Every great trip starts somewhere.
          <br />
          Search above to add your first stop.
        </p>
      </div>
    )
  }

  function indexAtY(clientY) {
    // Compare against the rows themselves, not the whole <li> (which
    // includes the leg-info strip above), so the flip point feels natural.
    const rows = listRef.current?.querySelectorAll('.stop-row') || []
    let idx = rows.length - 1
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) {
        idx = i
        break
      }
    }
    return idx
  }

  function startDrag(e, index) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { from: index, over: index }
    setDrag({ from: index, over: index })
  }

  function moveDrag(e) {
    if (!dragRef.current) return
    const over = indexAtY(e.clientY)
    if (over !== dragRef.current.over) {
      dragRef.current = { ...dragRef.current, over }
      setDrag({ ...dragRef.current })
    }
  }

  function endDrag() {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (d && d.from !== d.over) onReorder(d.from, d.over)
  }

  return (
    <ol className="stop-list" ref={listRef}>
      {stops.map((stop, i) => {
        const leg = route?.legs?.[i - 1]
        const isDragged = drag?.from === i
        const isTarget = drag && drag.over === i && drag.from !== i
        return (
          <li
            key={stop.id}
            className={`stop-item ${isDragged ? 'dragging' : ''} ${isTarget ? 'drop-target' : ''}`}
          >
            {i > 0 && (
              <div className={`leg-info ${loading ? 'dimmed' : ''}`}>
                {leg
                  ? `${formatDistance(leg.distanceMeters)} · ${formatDuration(leg.durationSeconds)}`
                  : loading
                    ? 'routing…'
                    : ''}
              </div>
            )}
            <div className="stop-row">
              <span
                className="drag-handle"
                aria-hidden="true"
                onPointerDown={(e) => startDrag(e, i)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                ⋮⋮
              </span>
              <span className={`stop-badge ${badgeClass(i, stops.length)}`}>
                {i === 0 ? 'A' : i === stops.length - 1 ? 'Z' : i}
              </span>
              <span className="stop-name" title={stop.name}>
                {stop.name}
              </span>
              <span className="stop-actions">
                <button
                  className="icon-btn"
                  onClick={() => onMove(stop.id, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${stop.name} up`}
                >
                  ↑
                </button>
                <button
                  className="icon-btn"
                  onClick={() => onMove(stop.id, 1)}
                  disabled={i === stops.length - 1}
                  aria-label={`Move ${stop.name} down`}
                >
                  ↓
                </button>
                <button
                  className="icon-btn remove"
                  onClick={() => onRemove(stop.id)}
                  aria-label={`Remove ${stop.name}`}
                >
                  ×
                </button>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function badgeClass(i, total) {
  if (i === 0) return 'start'
  if (i === total - 1) return 'end'
  return 'via'
}
