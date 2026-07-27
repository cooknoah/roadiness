import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/geocode.js'

export default function SearchBox({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const abortRef = useRef(null)

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([])
      setOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setSearching(true)
      try {
        const found = await searchPlaces(query.trim(), controller.signal)
        setResults(found)
        setOpen(true)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setResults([])
          setOpen(false)
        }
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  function pick(place) {
    onSelect(place)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="searchbox">
      <div className="search-input-wrap">
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a stop — city, park, address…"
          aria-label="Search for a place"
          onFocus={() => results.length && setOpen(true)}
        />
        {searching && <span className="search-spinner" aria-hidden="true" />}
      </div>
      {open && results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button className="search-result" onClick={() => pick(r)}>
                <span className="result-name">{r.name}</span>
                <span className="result-detail">{r.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
