# Artemis III · Personal Mission Control Dashboard

A NASA-engineer-style personal dashboard for the Artemis III mission, built with vanilla JS + Three.js.

## Live Data Sources

| Panel | Source | Refresh |
|---|---|---|
| 3D Orbital Trajectory | JPL Horizons API (public) | Every 5 min |
| Deep Space Network | NASA DSN Now (eyes.nasa.gov) | Every 30 sec |
| Comm Windows | Generated from DSN geometry | Every 60 sec |
| Mission Timeline | NASA published schedule | Static + elapsed |
| T-minus Countdown | NET launch date (2026-Q3) | Live 1-sec tick |

## Quick Start

```bash
cd web-sim
python3 -m http.server 8080
# open http://localhost:8080
```

## API Key

Click ⚙ in the top-right corner to enter your NASA API key from [api.nasa.gov](https://api.nasa.gov).  
`DEMO_KEY` works but has a 30 req/hour limit. JPL Horizons needs no key.

## Configuration

To set the actual launch date once announced, edit `app.js`:

```js
const LAUNCH_DATE = new Date('2026-09-01T00:00:00Z'); // set actual T-0
```

## Stack

- **Three.js** — 3D Earth/Moon/Orion orbital visualization
- **JPL Horizons API** — real lunar distance + ephemeris
- **NASA DSN Now XML** — live dish tracking data
- No build step, no dependencies to install.
