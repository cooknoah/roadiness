# Roadiness

*Plan the drive, love the detours.*

A road trip planner: search for stops, see your route on the map with drive
time per leg, split the trip into days, estimate costs, and save or share
trips — all in the browser with no accounts or API keys.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173.

## Stack

- **React + Vite** — SPA, deployable as a static site (`npm run build`)
- **Leaflet + OpenStreetMap** tiles for the map
- **OSRM** (public demo server) for driving routes — wrapped in
  `src/lib/routing.js` so the provider can be swapped (Mapbox/Google) later
- **Nominatim** for place search (`src/lib/geocode.js`)
- **Wikipedia + Wikidata APIs** for iconic-stop suggestions
  (`src/lib/suggestions.js`)
- **localStorage** for saved trips; share links encode the whole trip in the
  URL hash (`src/lib/tripUtils.js`)

## Features

- **Launch page** — type just a start and destination; a minivan animation
  plays while the route and iconic-stop suggestions generate, then you land
  in the planner with the trip named and the Suggest tab open
- **Stops** — search places, add stops, drag-to-reorder (or arrow buttons),
  per-leg distance and drive time
- **Suggest** — surfaces the genuinely iconic sights along your route, in
  driving order: national/state parks and monuments from Wikidata (ranked
  by language-edition count) plus famous roadside landmarks from Wikipedia
  geosearch (ranked by pageviews). One tap adds a sight, slotted into the
  correct position on the route; suggestions show as gold stars on the map
- **Days** — set max driving hours per day; the trip auto-splits into days,
  flagging legs longer than the limit
- **Costs** — fuel (MPG × gas price), lodging per night, food per day, with a
  receipt-style total
- **Trips** — save trips locally, load or delete them, copy a share link

## Notes

The OSRM demo server and Nominatim are free public services with fair-use
policies — fine for personal use, but swap in a hosted routing provider
before any real traffic.
