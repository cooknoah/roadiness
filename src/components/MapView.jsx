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

function breakIcon(kind) {
  return L.divIcon({
    className: '',
    html: `<div class="map-break ${kind}">${kind === 'overnight' ? '🌙' : '☕'}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

export default function MapView({ stops, route, loading, breaks = [] }) {
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
        {breaks.map((br) => (
          <Marker key={br.id} position={[br.lat, br.lon]} icon={breakIcon(br.kind)}>
            <Tooltip direction="top" offset={[0, -16]}>
              {br.kind === 'overnight' ? 'Overnight stop' : 'Stretch & eat'} — Day {br.day},{' '}
              {br.clockLabel}
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
