# 🌕 Artemis III Mission Control Dashboard

### **[→ Launch Dashboard](https://sumanthvarma798.github.io/artemis3-dashboard/)**

---

## Humanity is going back to the Moon.

Not for a few hours this time — to *stay*.

---

## The Last Time We Were There

In December 1972, Gene Cernan climbed back into the Apollo 17 lunar module, looked out at the barren grey landscape one last time, and became the last human to stand on another world. He said:

> *"We leave as we came, and God willing, as we shall return — with peace and hope for all mankind."*

Then the hatch closed. The ascent engine fired. And for the next **52 years**, no human being walked on the Moon.

Not because we couldn't. Because we stopped trying.

---

## Why We're Going Back

The Moon isn't just a rock in the sky. It's a **laboratory**, a **waypoint**, and potentially a **home**.

🧊 **Water ice** confirmed at the lunar south pole — water means oxygen, drinking water, and rocket fuel. A permanent base becomes possible.

☀️ **Peaks of Eternal Light** near Shackleton Crater receive near-continuous sunlight — perfect for solar power.

🚀 **Gateway to deep space** — the Moon's low gravity makes it a natural launch pad. Getting to Mars from the Moon requires a fraction of the fuel needed from Earth.

🔬 **Helium-3** — a rare fusion fuel abundant in lunar regolith, virtually absent on Earth.

The Moon is the first step to becoming a multi-planetary species. And Artemis III is the mission that starts it for real.

---

## The Artemis Program

After Apollo, NASA spent decades in low Earth orbit — the Space Shuttle, the ISS. Incredible science. But no one was going anywhere *new*.

Then in 2017, the Artemis program was born — named after Apollo's twin sister in Greek mythology, goddess of the Moon.

| Mission | What Happened |
|---------|--------------|
| **Artemis I** · Nov 2022 | Uncrewed test flight. 25 days around the Moon and back. Flawless. |
| **Artemis II** · 2025 | First crewed flight around the Moon since 1972. Four astronauts, no landing. |
| **Artemis III** · 2026 🎯 | **The landing.** First humans on the surface in 54 years. First woman and first person of color on the Moon. Target: Shackleton Crater rim, south pole. |

---

## Artemis III — What Actually Happens

```
T+0h    Launch · Kennedy Space Center, LC-39B
          SLS Block 1B lifts Orion + crew toward the Moon

T+2h    Trans-Lunar Injection
          ICPS upper stage burn — 3-day coast begins

T+4d    Lunar Orbit Insertion
          Orion enters Near-Rectilinear Halo Orbit (NRHO)

T+4d    Rendezvous with Starship HLS
          Already waiting in orbit since its own launch weeks earlier

T+5d    Powered Descent Initiation
          Starship HLS departs NRHO, descends to the surface

T+5d4h  🌕 TOUCHDOWN — Shackleton Crater Rim, 89.5°S
          First humans on the Moon since Apollo 17

T+6d    EVA 1 · South Pole Traverse
T+7d    EVA 2 · Sample Collection & Instrument Deployment

T+8d    Ascent — HLS lifts crew back to orbit, docks with Orion

T+9d    Trans-Earth Injection — heading home

T+12d   Splashdown · Pacific Ocean
```

The landing vehicle isn't the old Apollo LM. It's **SpaceX Starship** — 50 metres tall, capable of carrying more cargo than every previous lunar lander combined.

---

## This Dashboard

A real-time mission control interface tracking Artemis III from pre-launch through splashdown, built like something you'd see on the floor at Johnson Space Center.

```
┌─────────────────────────────┬──────────────────────────────┐
│                             │  DEEP SPACE NETWORK          │
│   3D ORBITAL TRAJECTORY     │  Live dish tracking —        │
│                             │  Goldstone · Madrid ·        │
│   Earth → Transfer Arc      │  Canberra                    │
│         → Moon              │                              │
│   Orion + Starship HLS      │  ARTEMIS III COMM WINDOWS    │
│   Live JPL Horizons data    │  Next 24h predicted          │
│                             │                              │
│                             │  MISSION TIMELINE            │
│                             │  11 events, live status      │
└─────────────────────────────┴──────────────────────────────┘
              T-MINUS  82:00:00:00  (and counting)
```

### Features

| Feature | Free | Pro |
|---------|:----:|:---:|
| 3D orbital visualization | static model | live JPL Horizons |
| Mission timeline | ✓ | ✓ |
| T-minus countdown | ✓ | ✓ |
| DSN comm windows | predicted | real-time XML feed |
| Live telemetry readouts | — | ✓ |

Sign up free at the dashboard. Upgrade to Pro to unlock live data with your own NASA API key (free from [api.nasa.gov](https://api.nasa.gov)).

---

## Tech Stack

| Layer | What |
|-------|------|
| Frontend | Vanilla JS + HTML/CSS — no build step, no npm |
| 3D rendering | [Three.js](https://threejs.org/) |
| Ephemeris data | [JPL Horizons API](https://ssd.jpl.nasa.gov/horizons/) |
| DSN tracking | [DSN Now](https://eyes.nasa.gov/dsn/dsn.html) XML feed |
| Auth + DB | [Supabase](https://supabase.com/) — email auth, RLS, per-user key vault |
| API proxy | Supabase Edge Functions (Deno) — NASA key never reaches the browser |
| Hosting | GitHub Pages |

---

## Running Locally

```bash
cd web-sim
python3 -m http.server 8181
# open http://localhost:8181
```

No npm. No build. No dependencies to install.

---

## Security Architecture

NASA API keys are stored in a Supabase vault, **scoped per user**. They never reach the browser — all NASA API calls are proxied through a Supabase Edge Function authenticated with the user's JWT.

```
Browser ──[JWT]──► Edge Function ──[user's key from vault]──► api.nasa.gov
                                                            ──► JPL Horizons
                                                            ──► DSN Now
```

---

*"We choose to go to the Moon in this decade and do the other things, not because they are easy, but because they are hard."*
— John F. Kennedy, 1962

---

MIT License
