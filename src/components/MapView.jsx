import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

const USA_CENTER = [39.5, -98.35]

function stopIcon(index, total) {
  const label = index === 0 ? 'A' : index === total - 1 ? 'Z' : String(index)
  const variant = index === 0 ? 'start' : index === total - 1 ? 'end' : 'via'
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${variant}"><span>${label}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  })
}

function FitBounds({ stops, geometry }) {
  const map = useMap()
  useEffect(() => {
    if (geometry?.length) {
      map.fitBounds(L.latLngBounds(geometry), { padding: [48, 48] })
    } else if (stops.length === 1) {
      map.setView([stops[0].lat, stops[0].lon], 9)
    } else if (stops.length > 1) {
      map.fitBounds(L.latLngBounds(stops.map((s) => [s.lat, s.lon])), { padding: [48, 48] })
    }
  }, [map, stops, geometry])
  return null
}

const STAR_SVG = `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.4l6.6-.9z" fill="#e8a33c" stroke="#22301f" stroke-width="1.4" stroke-linejoin="round"/></svg>`

const starIcon = () =>
  L.divIcon({
    className: '',
    html: `<div class="map-star">${STAR_SVG}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })

export default function MapView({ stops, route, loading, suggestions = [] }) {
  return (
    <div className={`map-container ${loading ? 'map-loading' : ''}`}>
      <MapContainer center={USA_CENTER} zoom={4} className="leaflet-root" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {route?.geometry && (
          <>
            <Polyline
              positions={route.geometry}
              pathOptions={{ color: '#12372e', weight: 7, opacity: 0.35 }}
            />
            <Polyline
              positions={route.geometry}
              pathOptions={{ color: '#e8622c', weight: 4, opacity: 0.95, dashArray: '1 9', lineCap: 'round' }}
            />
          </>
        )}
        {suggestions.map((poi) => (
          <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={starIcon()}>
            <Tooltip direction="top" offset={[0, -16]}>
              {poi.name} — {poi.kind}
            </Tooltip>
          </Marker>
        ))}
        {stops.map((stop, i) => (
          <Marker key={stop.id} position={[stop.lat, stop.lon]} icon={stopIcon(i, stops.length)}>
            <Tooltip direction="top" offset={[0, -38]}>{stop.name}</Tooltip>
          </Marker>
        ))}
        <FitBounds stops={stops} geometry={route?.geometry} />
      </MapContainer>
      {loading && <div className="map-routing-badge">finding the road…</div>}
    </div>
  )
}
