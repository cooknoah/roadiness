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
- **localStorage** for saved trips; share links encode the whole trip in the
  URL hash (`src/lib/tripUtils.js`)

## Features

- **Stops** — search places, add stops, drag-to-reorder (or arrow buttons),
  per-leg distance and drive time
- **Suggest** — the trip drafts itself: rest/meal breaks every ~2.5 driving
  hours and overnight stops at your daily limit, each with real nearby
  places (Eat / See / Sleep via the Overpass API) you can add with one tap;
  added places slot into the correct position on the route
- **Days** — set max driving hours per day; the trip auto-splits into days,
  flagging legs longer than the limit
- **Costs** — fuel (MPG × gas price), lodging per night, food per day, with a
  receipt-style total
- **Trips** — save trips locally, load or delete them, copy a share link

## Notes

The OSRM demo server and Nominatim are free public services with fair-use
policies — fine for personal use, but swap in a hosted routing provider
before any real traffic.
