// Iconic-stops engine, powered by Wikipedia: geosearch finds notable
// places near sample points along the route, then pageview counts rank
// them by how famous they actually are. Only genuinely significant
// places make the cut.

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const WDQS_API = 'https://query.wikidata.org/sparql'

const SAMPLE_POINTS = 26 // geosearch calls per route
const SEARCH_RADIUS_M = 10000 // geosearch max
const MIN_VIEWS = 6000 // pageviews over ~60 days to count as "iconic"
const MIN_PARK_SITELINKS = 8 // language editions for a park to count
const PARK_REACH_METERS = 50000 // parks are worth a bigger detour (~31 mi)
const MAX_RESULTS = 25

// Wikipedia pages that are places but not road-trip stops.
const BORING_DESC =
  /(city|town|village|census-designated|unincorporated community|county in|county seat|u\.s\. (route|highway)|interstate highway|state (route|highway)|neighborhood|suburb|airport|shopping mall|radio station|school|university|company|river in|creek in|reservoir|accident|crash|disaster|massacre|murder|shooting|wildfire|flood)/i

export function haversineMeters(a, b) {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const la1 = (a[0] * Math.PI) / 180
  const la2 = (b[0] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function downsample(geometry, maxPoints) {
  if (geometry.length <= maxPoints) return geometry
  const step = (geometry.length - 1) / (maxPoints - 1)
  const pts = []
  for (let i = 0; i < maxPoints; i++) pts.push(geometry[Math.round(i * step)])
  return pts
}

async function wikiGet(params, signal) {
  const search = new URLSearchParams({ format: 'json', origin: '*', ...params })
  const res = await fetch(`${WIKI_API}?${search}`, { signal })
  if (!res.ok) throw new Error(`Wikipedia request failed (${res.status})`)
  return res.json()
}

async function inChunks(items, size, fn) {
  const results = []
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return results
}

// One query for every US national park / national monument / state park on
// Wikidata, with sitelink counts (how many language editions = how famous).
// Their page coordinates sit at park centroids, which geosearch can't reach.
async function fetchParks(signal) {
  const sparql = `SELECT ?item ?itemLabel ?classLabel ?coord ?sitelinks WHERE {
  VALUES ?class { wd:Q46169 wd:Q34918903 wd:Q893775 wd:Q1093410 }
  ?item wdt:P31 ?class; wdt:P625 ?coord; wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= ${MIN_PARK_SITELINKS})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`
  const res = await fetch(`${WDQS_API}?format=json&query=${encodeURIComponent(sparql)}`, {
    signal,
    headers: { Accept: 'application/sparql-results+json' },
  })
  if (!res.ok) throw new Error(`Wikidata request failed (${res.status})`)
  const data = await res.json()
  return (data.results?.bindings || [])
    .map((b) => {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value || '')
      if (!m) return null
      return {
        name: b.itemLabel?.value,
        kind: parkKind(b.classLabel?.value || ''),
        lat: parseFloat(m[2]),
        lon: parseFloat(m[1]),
        sitelinks: parseInt(b.sitelinks?.value || '0', 10),
      }
    })
    .filter((p) => p && p.name && !/^Q\d+$/.test(p.name))
}

/**
 * Find iconic stops along a routed trip.
 * @returns {Promise<Array<{id, name, kind, lat, lon, offMiles, alongFrac, score}>>}
 */
export async function fetchIconicStops(route, stops, signal) {
  const searchPts = downsample(route.geometry, SAMPLE_POINTS)
  const distPts = downsample(route.geometry, 200)

  const nearestOnRoute = (lat, lon) => {
    let offMeters = Infinity
    let nearestIdx = 0
    distPts.forEach((p, i) => {
      const d = haversineMeters(p, [lat, lon])
      if (d < offMeters) {
        offMeters = d
        nearestIdx = i
      }
    })
    return { offMeters, alongFrac: nearestIdx / Math.max(1, distPts.length - 1) }
  }

  const parksPromise = fetchParks(signal).catch((err) => {
    if (err.name === 'AbortError') throw err
    return [] // parks are additive; a WDQS hiccup shouldn't sink the scan
  })

  // 1. Geosearch around each sample point (8 at a time, politely).
  const candidates = new Map() // pageid -> {title, lat, lon}
  await inChunks(searchPts, 8, async (p) => {
    try {
      const data = await wikiGet(
        {
          action: 'query',
          list: 'geosearch',
          gscoord: `${p[0]}|${p[1]}`,
          gsradius: String(SEARCH_RADIUS_M),
          gslimit: '25',
        },
        signal,
      )
      for (const g of data.query?.geosearch || []) {
        if (!candidates.has(g.pageid)) {
          candidates.set(g.pageid, { title: g.title, lat: g.lat, lon: g.lon })
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err
      // One dead sample point shouldn't sink the whole scan.
    }
  })
  if (!candidates.size) throw new Error('Wikipedia search returned nothing')

  // 2. Batch-fetch pageviews + short descriptions to rank and label them.
  const entries = [...candidates.entries()]
  const enriched = []
  for (let i = 0; i < entries.length; i += 50) {
    const batch = entries.slice(i, i + 50)
    const data = await wikiGet(
      {
        action: 'query',
        prop: 'pageviews|description',
        titles: batch.map(([, c]) => c.title).join('|'),
      },
      signal,
    )
    const pages = Object.values(data.query?.pages || {})
    for (const page of pages) {
      const cand = batch.find(([, c]) => c.title === page.title)?.[1]
      if (!cand) continue
      const views = Object.values(page.pageviews || {}).reduce((s, v) => s + (v || 0), 0)
      enriched.push({ ...cand, views, description: page.description || '' })
    }
  }

  // 3. Keep the famous, non-boring ones that aren't already stops.
  const results = []
  const nameKeys = new Set()
  const nearAStop = (lat, lon) =>
    stops.some((s) => haversineMeters([s.lat, s.lon], [lat, lon]) < 3200)

  // Parks first — they're the headliners and win name collisions.
  for (const park of await parksPromise) {
    const { offMeters, alongFrac } = nearestOnRoute(park.lat, park.lon)
    if (offMeters > PARK_REACH_METERS) continue
    if (nearAStop(park.lat, park.lon)) continue
    if (nameKeys.has(park.name.toLowerCase())) continue
    nameKeys.add(park.name.toLowerCase())
    results.push({
      id: `park-${park.name}`,
      name: park.name,
      kind: park.kind,
      lat: park.lat,
      lon: park.lon,
      offMiles: offMeters / 1609.344,
      alongFrac,
      score: park.sitelinks * 2500, // ~60 sitelinks outranks any landmark
    })
  }

  for (const c of enriched) {
    if (c.views < MIN_VIEWS) continue
    if (c.description && BORING_DESC.test(c.description)) continue
    if (nameKeys.has(c.title.toLowerCase())) continue
    if (nearAStop(c.lat, c.lon)) continue

    const { offMeters, alongFrac } = nearestOnRoute(c.lat, c.lon)
    results.push({
      id: `wp-${c.title}`,
      name: c.title,
      kind: c.description ? capitalize(c.description) : 'Landmark',
      lat: c.lat,
      lon: c.lon,
      offMiles: offMeters / 1609.344,
      alongFrac,
      score: c.views,
    })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .sort((a, b) => a.alongFrac - b.alongFrac)
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function parkKind(classLabel) {
  const l = classLabel.toLowerCase()
  if (l.includes('national park')) return 'National Park'
  if (l.includes('national monument')) return 'National Monument'
  if (l.includes('state park')) return 'State Park'
  return 'Park'
}
