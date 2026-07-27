// Iconic-stops engine, powered by Wikipedia: geosearch finds notable
// places near sample points along the route, then pageview counts rank
// them by how famous they actually are. Only genuinely significant
// places make the cut.

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const WDQS_API = 'https://query.wikidata.org/sparql'

const SEARCH_RADIUS_M = 10000 // geosearch max
const SAMPLE_SPACING_M = 16000 // one geosearch per ~10 mi of route
const MAX_SAMPLE_POINTS = 90
const MIN_VIEWS = 2500 // pageviews over 30 days to count as "iconic"
const MIN_PARK_SITELINKS = 8 // language editions for a park to count
const PARK_REACH_METERS = 50000 // parks are worth a bigger detour (~31 mi)
const MAX_RESULTS = 25

// Wikipedia pages that are places but not road-trip stops. Geography and
// settlement words are anchored to the start of the description so that
// "Waterfall on the Snoqualmie River in Washington" or "Museum in Kansas
// City" don't get caught by substring matches.
const BORING_DESC =
  /^(city|town|village|hamlet|suburb|neighborhood|census|unincorporated|county|region|metropolitan|megapolitan|u\.s\.|interstate|state (route|highway)|highway|river|creek|stream|valley|mountain range|hills?\b|loam)|accident|crash|disaster|massacre|murder|shooting|wildfire|flood|natural event|school|university|college|radio station|shopping mall|airport|company|headquarters|mansion|residence/i

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

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// One query for every US national park / national monument / state park on
// Wikidata, with sitelink counts (how many language editions = how famous).
// Their page coordinates sit at park centroids, which geosearch can't reach.
async function fetchParks(signal) {
  const sparql = `SELECT ?item ?itemLabel ?classLabel ?coord ?sitelinks ?image ?website ?article WHERE {
  VALUES ?class { wd:Q46169 wd:Q34918903 wd:Q893775 wd:Q1093410 }
  ?item wdt:P31 ?class; wdt:P625 ?coord; wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= ${MIN_PARK_SITELINKS})
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
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
        image: b.image?.value
          ? `${b.image.value.replace(/^http:/, 'https:')}?width=480`
          : null,
        website: b.website?.value || null,
        wikiUrl: b.article?.value || null,
      }
    })
    .filter((p) => p && p.name && !/^Q\d+$/.test(p.name))
}

/**
 * Find iconic stops along a routed trip.
 * @returns {Promise<Array<{id, name, kind, lat, lon, offMiles, alongFrac, score}>>}
 */
export async function fetchIconicStops(route, stops, signal) {
  const sampleCount = Math.min(
    MAX_SAMPLE_POINTS,
    Math.max(8, Math.ceil(route.distanceMeters / SAMPLE_SPACING_M)),
  )
  const searchPts = downsample(route.geometry, sampleCount)
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
          gslimit: '50',
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

  // 2a. Descriptions for everyone (cheap, 50 titles per request) — drop the
  // boring pages and NRHP filler before paying for pageviews.
  const withDesc = []
  await inChunks(chunk([...candidates.values()], 50), 5, async (batch) => {
    const data = await wikiGet(
      {
        action: 'query',
        prop: 'description|pageimages',
        piprop: 'thumbnail',
        pithumbsize: '480',
        pilimit: '50',
        titles: batch.map((c) => c.title).join('|'),
      },
      signal,
    )
    const byTitle = new Map(Object.values(data.query?.pages || {}).map((p) => [p.title, p]))
    for (const c of batch) {
      const page = byTitle.get(c.title)
      const d = page?.description ?? ''
      if (d && BORING_DESC.test(d)) continue
      if (/^united states historic place$/i.test(d)) continue // minor NRHP entries
      withDesc.push({ ...c, description: d, image: page?.thumbnail?.source || null })
    }
  })

  // 2b. Pageviews to rank by fame. The API only fills ~11 pages per request
  // no matter how many titles you send, so ask in small batches.
  const enriched = []
  await inChunks(chunk(withDesc, 10), 5, async (batch) => {
    const data = await wikiGet(
      {
        action: 'query',
        prop: 'pageviews',
        pvipdays: '30',
        titles: batch.map((c) => c.title).join('|'),
      },
      signal,
    )
    const pages = Object.values(data.query?.pages || {})
    for (const page of pages) {
      const cand = batch.find((c) => c.title === page.title)
      if (!cand) continue
      const views = Object.values(page.pageviews || {}).reduce((s, v) => s + (v || 0), 0)
      enriched.push({ ...cand, views })
    }
  })

  // 3. Keep the famous, non-boring ones that aren't already stops.
  const results = []
  const nameKeys = new Set()
  // Already visiting: physically close to a stop, or the stop IS the place
  // (e.g. destination "Yellowstone National Park" vs the park's own entry,
  // whose centroid can sit 25+ miles from the entrance coordinates).
  const alreadyVisiting = (name, lat, lon) =>
    stops.some((s) => {
      if (haversineMeters([s.lat, s.lon], [lat, lon]) < 3200) return true
      const a = s.name.toLowerCase()
      const b = name.toLowerCase()
      return a.includes(b) || b.includes(a)
    })

  // Parks first — they're the headliners and win name collisions.
  for (const park of await parksPromise) {
    const { offMeters, alongFrac } = nearestOnRoute(park.lat, park.lon)
    if (offMeters > PARK_REACH_METERS) continue
    if (alreadyVisiting(park.name, park.lat, park.lon)) continue
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
      image: park.image,
      wikiUrl: park.wikiUrl,
      website: park.website,
    })
  }

  for (const c of enriched) {
    if (c.views < MIN_VIEWS) continue
    if (c.description && BORING_DESC.test(c.description)) continue
    if (nameKeys.has(c.title.toLowerCase())) continue
    if (alreadyVisiting(c.title, c.lat, c.lon)) continue

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
      image: c.image,
      wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}`,
      website: null,
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
