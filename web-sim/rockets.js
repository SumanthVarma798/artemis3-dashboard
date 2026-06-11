// Rocket Hangar — fetch the SpaceX rocket list, match each vehicle to a local
// glTF asset, and show it in <model-viewer> alongside the parsed API spec text.
//
// Workflow (per spec):
//   1. Fetch rockets from https://api.spacexdata.com/v4/rockets
//   2. Match the rocket's normalized name/id to assets/models/<key>/scene.gltf
//   3. Load the local glTF into <model-viewer> next to the parsed API data
//
// The SpaceX API is frequently offline (Cloudflare 522), so a bundled fallback
// list is used when the fetch fails. Blue Origin vehicles are always appended
// (SpaceX's API has no Blue Origin data, and Blue Origin has no public API).
const RocketHangar = (() => {

  const SPACEX_API = 'https://api.spacexdata.com/v4/rockets';
  const MODEL_BASE = 'assets/models';

  // Normalized key → asset folder name (Falcon 9 → falcon9)
  function normalizeKey(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // ── Bundled fallback specs (real figures) ───────────────────────────────────
  const BUNDLED = [
    {
      key: 'falcon9', name: 'Falcon 9', company: 'SpaceX', flag: '🇺🇸',
      height: 70, diameter: 3.7, mass: 549054, stages: 2, boosters: 0,
      first_flight: '2010-06-04', success_pct: 99, active: true,
      role: 'Workhorse orbital launcher · reusable first stage',
      desc: 'The first orbital-class reusable rocket. Its booster lands and re-flies, slashing launch cost and enabling rapid Starlink and crew cadence.',
    },
    {
      key: 'falconheavy', name: 'Falcon Heavy', company: 'SpaceX', flag: '🇺🇸',
      height: 70, diameter: 12.2, mass: 1420788, stages: 2, boosters: 2,
      first_flight: '2018-02-06', success_pct: 100, active: true,
      role: 'Heavy-lift · three Falcon 9 cores',
      desc: 'Three Falcon 9 first stages strapped together — 27 Merlin engines at liftoff. Among the most capable operational rockets in the world.',
    },
    {
      key: 'starship', name: 'Starship', company: 'SpaceX', flag: '🇺🇸',
      height: 121, diameter: 9, mass: 5000000, stages: 2, boosters: 0,
      first_flight: '2023-04-20', success_pct: 40, active: true,
      role: 'Super-heavy · fully reusable · Artemis III HLS',
      desc: 'The largest rocket ever built. The Starship HLS variant is NASA’s Artemis III lunar lander — it carries the crew from NRHO down to the south pole and back.',
    },
    {
      key: 'falcon1', name: 'Falcon 1', company: 'SpaceX', flag: '🇺🇸',
      height: 22.25, diameter: 1.68, mass: 30146, stages: 2, boosters: 0,
      first_flight: '2006-03-24', success_pct: 40, active: false,
      role: 'Retired · first privately-built orbital rocket',
      desc: 'SpaceX’s first rocket. Its fourth flight in 2008 was the first privately-developed liquid-fuel launcher to reach orbit — the company’s survival hung on it.',
    },
    {
      key: 'newglenn', name: 'New Glenn', company: 'Blue Origin', flag: '🇺🇸',
      height: 98, diameter: 7, mass: 1450000, stages: 2, boosters: 0,
      first_flight: '2025-01-16', success_pct: 50, active: true,
      role: 'Heavy-lift · reusable first stage · BE-4 engines',
      desc: 'Blue Origin’s orbital rocket, named for John Glenn. Seven BE-4 engines burning methalox; the first stage lands on a sea-based platform for reuse.',
    },
    {
      key: 'newshepard', name: 'New Shepard', company: 'Blue Origin', flag: '🇺🇸',
      height: 18, diameter: 3.7, mass: 75000, stages: 1, boosters: 0,
      first_flight: '2015-04-29', success_pct: 95, active: true,
      role: 'Suborbital · crewed space tourism',
      desc: 'A reusable suborbital vehicle named for Alan Shepard. Carries tourists and research payloads past the Kármán line and returns under parachutes.',
    },
    {
      key: 'bluemoon', name: 'Blue Moon', company: 'Blue Origin', flag: '🇺🇸',
      height: 16, diameter: 7, mass: 45000, stages: 1, boosters: 0,
      first_flight: 'TBD', success_pct: null, active: true,
      role: 'Lunar lander · Artemis V · BE-7 engine',
      desc: 'Blue Origin’s hydrogen-fueled lunar lander, selected by NASA for Artemis V. The BE-7 burns liquid hydrogen and oxygen — the most efficient chemical propellant pairing.',
    },
  ];

  // ── Data loading ─────────────────────────────────────────────────────────────

  function bundledList() {
    return [
      ...BUNDLED.filter(r => r.company === 'SpaceX'),
      ...BUNDLED.filter(r => r.company === 'Blue Origin'),
    ];
  }

  // Try the live SpaceX API (fast timeout); returns null if unreachable/down
  async function fetchSpacexLive() {
    try {
      const res = await fetch(SPACEX_API, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const api = await res.json();
      if (!Array.isArray(api) || !api.length) return null;
      return api.map(r => ({
        key:          normalizeKey(r.name),
        name:         r.name,
        company:      r.company || 'SpaceX',
        flag:         '🇺🇸',
        height:       r.height?.meters ?? null,
        diameter:     r.diameter?.meters ?? null,
        mass:         r.mass?.kg ?? null,
        stages:       r.stages ?? null,
        boosters:     r.boosters ?? 0,
        first_flight: r.first_flight ?? null,
        success_pct:  r.success_rate_pct ?? null,
        active:       r.active ?? null,
        role:         r.type ? `${r.type} · ${r.country}` : '',
        desc:         r.description || '',
        live:         true,
      }));
    } catch { return null; }
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  let rockets  = [];
  let current  = 0;
  let built    = false;
  let manifest = null; // array of vehicle keys that have a local glTF (manifest.json)

  async function loadManifest() {
    if (manifest) return manifest;
    try {
      const res = await fetch(`${MODEL_BASE}/manifest.json`, { cache: 'no-cache' });
      manifest = res.ok ? await res.json() : [];
    } catch { manifest = []; }
    return manifest;
  }

  function build() {
    if (built) return;
    built = true;

    const btn = document.createElement('button');
    btn.id = 'rocket-open-btn';
    btn.textContent = '⬢ ROCKET HANGAR';
    btn.onclick = open;
    document.body.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.id = 'rocket-overlay';
    overlay.innerHTML = `
      <div class="rh-header">
        <span class="rh-logo">⬢ ROCKET HANGAR · <span>LIVE VEHICLE DATABASE</span></span>
        <span class="rh-source" id="rh-source">—</span>
        <button class="rh-close" id="rh-close">✕</button>
      </div>
      <div class="rh-body">
        <div class="rh-list" id="rh-list"></div>
        <div class="rh-stage">
          <div class="rh-viewer" id="rh-viewer"></div>
        </div>
        <div class="rh-specs" id="rh-specs"></div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('rh-close').onclick = close;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) close();
    });
  }

  let enriched = false;

  function open() {
    build();
    document.getElementById('rocket-overlay').classList.add('active');

    // Render instantly from bundled specs — never block the UI on the API
    if (!rockets.length) {
      rockets = bundledList();
      document.getElementById('rh-source').textContent = 'bundled specs';
      renderList();
    }
    select(current);

    // Load the model manifest, then refresh the current view so models appear
    loadManifest().then(() => select(current));

    // Enrich SpaceX entries from the live API in the background (once)
    if (!enriched) {
      enriched = true;
      fetchSpacexLive().then(live => {
        if (!live) {
          document.getElementById('rh-source').textContent = 'bundled specs (API offline)';
          return;
        }
        const currentKey = rockets[current]?.key;
        rockets = [...live, ...BUNDLED.filter(r => r.company === 'Blue Origin')];
        document.getElementById('rh-source').textContent = 'SpaceX API v4 · live + bundled';
        const newIdx = Math.max(0, rockets.findIndex(r => r.key === currentKey));
        current = newIdx;
        renderList();
        select(current);
      });
    }
  }

  function close() {
    document.getElementById('rocket-overlay').classList.remove('active');
  }

  function renderList() {
    const el = document.getElementById('rh-list');
    el.innerHTML = rockets.map((r, i) => `
      <button class="rh-item ${r.company === 'SpaceX' ? 'sx' : 'bo'}" data-i="${i}">
        <span class="rh-item-name">${r.name}</span>
        <span class="rh-item-co">${r.flag} ${r.company}${r.active === false ? ' · retired' : ''}</span>
      </button>`).join('');
    el.querySelectorAll('.rh-item').forEach(b =>
      b.onclick = () => select(+b.dataset.i));
  }

  function fmt(n, unit) {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('en-US') + (unit ? ' ' + unit : '');
  }

  function select(i) {
    current = i;
    const r = rockets[i];
    document.querySelectorAll('.rh-item').forEach((b, j) =>
      b.classList.toggle('active', j === i));

    // Model viewer — only mount <model-viewer> when the manifest lists this
    // vehicle's key (keeps the console clean and shows a placeholder otherwise)
    const viewer = document.getElementById('rh-viewer');
    const src    = `${MODEL_BASE}/${r.key}/scene.gltf`;
    if (manifest && manifest.includes(r.key)) mountViewer(viewer, r, src);
    else                                       showPlaceholder(viewer, r, src);

    // Spec sheet (parsed API text)
    const specs = document.getElementById('rh-specs');
    const sr = r.success_pct === null || r.success_pct === undefined ? '—' : r.success_pct + '%';
    specs.innerHTML = `
      <div class="rh-spec-head">
        <div class="rh-spec-co ${r.company === 'SpaceX' ? 'sx' : 'bo'}">${r.flag} ${r.company.toUpperCase()}</div>
        <div class="rh-spec-name">${r.name}</div>
        <div class="rh-spec-role">${r.role || ''}</div>
      </div>
      <div class="rh-spec-grid">
        <div class="rh-spec"><div class="rh-k">HEIGHT</div><div class="rh-v">${fmt(r.height, 'm')}</div></div>
        <div class="rh-spec"><div class="rh-k">DIAMETER</div><div class="rh-v">${fmt(r.diameter, 'm')}</div></div>
        <div class="rh-spec"><div class="rh-k">MASS</div><div class="rh-v">${r.mass ? (r.mass/1000).toLocaleString('en-US') + ' t' : '—'}</div></div>
        <div class="rh-spec"><div class="rh-k">STAGES</div><div class="rh-v">${fmt(r.stages)}</div></div>
        <div class="rh-spec"><div class="rh-k">SUCCESS</div><div class="rh-v">${sr}</div></div>
        <div class="rh-spec"><div class="rh-k">FIRST FLIGHT</div><div class="rh-v">${r.first_flight || '—'}</div></div>
      </div>
      <div class="rh-desc">${r.desc || ''}</div>
      <div class="rh-note">3D model loads from <code>${src}</code></div>`;
  }

  function mountViewer(viewer, r, src) {
    viewer.innerHTML = `
      <model-viewer
        src="${src}"
        alt="${r.name} 3D model"
        camera-controls auto-rotate rotation-per-second="18deg"
        shadow-intensity="1" exposure="1.1"
        environment-image="neutral"
        loading="eager" reveal="auto"
        style="width:100%;height:100%;background:transparent;">
        <div slot="poster" class="rh-poster">Loading ${r.name}…</div>
      </model-viewer>`;
    viewer.querySelector('model-viewer')
      .addEventListener('error', () => showPlaceholder(viewer, r, src));
  }

  function showPlaceholder(viewer, r, src) {
    viewer.innerHTML = `
      <div class="rh-placeholder">
        <div class="rh-ph-icon">⬢</div>
        <div class="rh-ph-title">No 3D model for ${r.name} yet</div>
        <div class="rh-ph-path">Drop a glTF at<br><code>${src}</code></div>
        <div class="rh-ph-hint">See assets/models/README.md — grab one from Sketchfab,
        CGTrader, or NASA 3D Resources (mind the license).</div>
      </div>`;
  }

  // Mount the launch button as soon as the DOM is ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  return { open };
})();
