import { useEffect, useState } from 'react'
import SearchBox from './SearchBox.jsx'

export default function Launch({ onStart, onSkip }) {
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)

  return (
    <div className="launch">
      <div className="launch-card">
        <div className="masthead-badge launch-badge">
          <span className="badge-route">RT</span>
          <span className="badge-num">66</span>
        </div>
        <h1 className="wordmark launch-wordmark">Roadiness</h1>
        <p className="tagline launch-tagline">plan the drive, love the detours</p>

        <div className="launch-fields">
          <div className="launch-field">
            <span className="launch-label">From</span>
            <SearchBox
              onSelect={setFrom}
              retainSelection
              large
              placeholder="Where does the story start?"
            />
          </div>
          <div className="launch-field">
            <span className="launch-label">To</span>
            <SearchBox
              onSelect={setTo}
              retainSelection
              large
              placeholder="Where are you headed?"
            />
          </div>
        </div>

        <button
          className="btn primary launch-go"
          disabled={!from || !to}
          onClick={() => onStart(from, to)}
        >
          Plan my trip
        </button>

        <button className="launch-skip" onClick={onSkip}>
          or jump straight to the planner
        </button>
      </div>
      <div className="launch-road" aria-hidden="true" />
    </div>
  )
}

const MESSAGES = [
  'Plotting the route…',
  'Checking the map twice…',
  'Scouting the iconic stops…',
  'Packing the cooler…',
  'Rolling the windows down…',
]

export function GeneratingOverlay() {
  const [msg, setMsg] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setMsg((n) => n + 1), 1400)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="generating" role="status">
      <div className="van-scene" aria-hidden="true">
        <svg className="van" viewBox="0 0 140 74">
          {/* body — tall boxy minivan profile */}
          <path
            d="M12 58 V22 q0-8 8-8 h74 q6 0 9.5 4.5 L116 34 q12 2 12 10 v8 q0 6-6 6 H18 q-6 0-6-6z"
            fill="#1d4d3b"
            stroke="#22301f"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* rear side window */}
          <rect
            x="22"
            y="20"
            width="26"
            height="15"
            rx="2"
            fill="#fdf9ef"
            stroke="#22301f"
            strokeWidth="2"
          />
          {/* mid side window */}
          <rect
            x="54"
            y="20"
            width="26"
            height="15"
            rx="2"
            fill="#fdf9ef"
            stroke="#22301f"
            strokeWidth="2"
          />
          {/* windshield */}
          <path
            d="M86 20 h8 q4 0 6.5 3 L110 35 H86 z"
            fill="#fdf9ef"
            stroke="#22301f"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* trim stripe */}
          <rect x="14" y="42" width="112" height="4" rx="2" fill="#e8a33c" opacity="0.9" />
          {/* lights */}
          <rect x="121" y="48" width="7" height="5" rx="2" fill="#e8a33c" />
          <rect x="12" y="48" width="5" height="5" rx="2" fill="#c94f1e" />
          {/* wheels */}
          <g className="wheel" style={{ transformOrigin: '40px 60px' }}>
            <circle cx="40" cy="60" r="10" fill="#22301f" />
            <circle cx="40" cy="60" r="4" fill="#fdf9ef" />
            <line x1="40" y1="51" x2="40" y2="69" stroke="#fdf9ef" strokeWidth="1.6" />
            <line x1="31" y1="60" x2="49" y2="60" stroke="#fdf9ef" strokeWidth="1.6" />
          </g>
          <g className="wheel" style={{ transformOrigin: '102px 60px' }}>
            <circle cx="102" cy="60" r="10" fill="#22301f" />
            <circle cx="102" cy="60" r="4" fill="#fdf9ef" />
            <line x1="102" y1="51" x2="102" y2="69" stroke="#fdf9ef" strokeWidth="1.6" />
            <line x1="93" y1="60" x2="111" y2="60" stroke="#fdf9ef" strokeWidth="1.6" />
          </g>
        </svg>
        <div className="road-strip" />
      </div>
      <p className="generating-title">Generating your trip</p>
      <p className="generating-msg">{MESSAGES[msg % MESSAGES.length]}</p>
    </div>
  )
}
