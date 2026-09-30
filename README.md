# Artemis Mission Control

### **[→ Launch Dashboard](https://sumanthvarma798.github.io/artemis3-dashboard/)**

An unofficial dashboard for NASA's Artemis program: where the program stands, the Artemis III flight plan, a 3D view of the mission, live Deep Space Network tracking, a rocket hangar and an eight-chapter story.

*Facts last checked September 30, 2026.*

---

## Where Artemis stands

In December 1972 Gene Cernan climbed back into the Apollo 17 lunar module and became the last person to stand on the Moon. More than half a century later, Artemis is taking people back in steps.

| Mission | Status |
|---------|--------|
| **Artemis I** · Nov 2022 | Uncrewed flight around the Moon. |
| **Artemis II** · Apr 1 to 11, 2026 | Flown. Wiseman, Glover, Koch and Hansen flew around the Moon on Orion *Integrity*, passed 6,545 km above the far side and reached 406,771 km from Earth, a human distance record. |
| **Artemis III** · NET June 2027 | **An Earth-orbit docking test, not a landing.** Orion docks with a Blue Origin and a SpaceX lander test article in a 430 km orbit. Reported about 90 days behind schedule. |
| **Artemis IV** · early 2028 | Planned first crewed landing, on whichever lander is ready: Starship HLS or Blue Moon. |
| **Artemis V** · late 2028 | Planned second landing and the first work on a surface base. |

In February 2026 NASA moved the first landing from Artemis III to Artemis IV and cancelled SLS Block 1B and Block 2. In March 2026 it cancelled the Lunar Gateway station to focus on a base on the surface.

### Artemis III flight plan

```
Before Orion   Blue Origin lander test vehicle launches and waits in orbit (up to 90 days)
Launch day     SLS lifts Orion and four crew from LC-39B (spacer instead of an upper stage)
First hours    Orion settles into a 430 km, 33° orbit
About 2 days   Dock with the Blue Origin vehicle; crew tests systems and the AxEMU spacesuit interface
During that    Starship V3 launches (docking port, no crew cabin)
About 1 day    Undock, fly to Starship and dock; crew stays in Orion
About 2 weeks  Deorbit, entry on an upgraded heat shield, splashdown off San Diego
```

**Crew:** Randy Bresnik (commander), Luca Parmitano (ESA, pilot), Frank Rubio and Andre Douglas (mission specialists). Backup: Bob Hines.

---

## What is in the dashboard

| Area | What it does |
|------|--------------|
| **3D stage** | Two schematic scenes: the Artemis III docking sequence in Earth orbit, and a replay of the Artemis II flyby. Drag, zoom, hover parts. Captions and the flight plan stay in sync. |
| **Where the program stands** | The mission ladder, launch target, crew and stack details. |
| **Flight plan and hardware readiness** | Eight plan steps and the SLS, Orion and lander milestones that gate launch. |
| **Deep Space Network** | Live dish tracking from DSN Now for Goldstone, Madrid and Canberra. |
| **Launch providers** | Latest and next SpaceX and Blue Origin launches from Launch Library 2. |
| **Roman Space Telescope** | The first test image from Roman's Wide Field Instrument. |
| **Story** | Eight chapters, each over a NASA photograph, with animated diagrams and 3D models. |
| **Hangar** | 3D models and spec sheets for SLS, Orion, Starship, Super Heavy, Raptor, Falcon, New Glenn, Blue Moon and BE-4. |

Sign in for free. Pro adds live JPL Horizons data through your own NASA API key (free from [api.nasa.gov](https://api.nasa.gov)). The Moon distance in the status bar is computed from a low-precision lunar model when you are not on Pro, and matches JPL to within about 10 km.

### Keeping the facts current

Mission facts live in three files. Update them when NASA moves a date:

- `web-sim/mission.js` for the ladder, facts, flight plan and readiness list (and `LAUNCH_NET` for the countdown)
- `web-sim/story.js` for the eight chapters and their numbers
- `web-sim/rockets.js` for the vehicle specs

The 3D docking sequence is in `web-sim/orbital3d.js`.

---

## Tech stack

| Layer | What |
|-------|------|
| Frontend | Vanilla JS, HTML and CSS. No build step, no npm. |
| Type and icons | [Geist](https://vercel.com/font) and Geist Mono (self-hosted), [Phosphor Icons](https://phosphoricons.com) |
| 3D | [Three.js](https://threejs.org/) for the stage, [model-viewer](https://modelviewer.dev/) for vehicles |
| Ephemeris | [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) (Pro) or a built-in lunar model |
| DSN tracking | [DSN Now](https://eyes.nasa.gov/dsn/dsn.html) XML feed, fetched directly |
| Imagery | [NASA Image and Video Library](https://images.nasa.gov) |
| Auth and DB | [Supabase](https://supabase.com/): email auth, RLS, per-user key vault |
| API proxy | Supabase Edge Functions (Deno), so NASA keys never reach the browser |
| Hosting | GitHub Pages |

Motion is transform and opacity only, and every animation stops under `prefers-reduced-motion`. The interface is dark only.

---

## Running locally

```bash
cd web-sim
python3 -m http.server 8181
# open http://localhost:8181
```

No npm. No build. No dependencies to install.

---

## Security architecture

NASA API keys are stored in a Supabase vault, **scoped per user**. They never reach the browser. All keyed NASA calls are proxied through a Supabase Edge Function authenticated with the user's JWT.

```
Browser ──[JWT]──► Edge Function ──[user's key from vault]──► api.nasa.gov
                                                            ──► JPL Horizons
                                                            ──► DSN Now
```

---

## Credits

- **Planetary and star-field textures**: [Solar System Scope](https://www.solarsystemscope.com/textures/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **3D rocket models**: individual CC BY 4.0 artists on [Sketchfab](https://sketchfab.com) (credited in the app and in `web-sim/assets/models/*/license.txt`).
- **Photography**: [NASA Image and Video Library](https://images.nasa.gov). Credits are shown under each Story chapter. The Starship HLS concept is courtesy of SpaceX and the Blue Moon concept is courtesy of Blue Origin.
- **Roman Space Telescope test image**: NASA, via the [NASA Science Roman blog](https://science.nasa.gov/blogs/roman/).
- **Ephemeris and tracking**: JPL Horizons, DSN Now, The Space Devs Launch Library 2.
- **Fonts and icons**: Geist (SIL OFL), Phosphor Icons (MIT).

---

MIT License (project code only; third-party assets retain their own licenses)
