// Rocket Hangar — fetch the SpaceX rocket list, match each vehicle to a local
// glTF asset, and show it in <model-viewer> alongside the parsed API spec text.
//
// Workflow (per spec):
//   1. Fetch rockets from api.spacexdata.com/v4/rockets (falls back to v5)
//   2. Match the rocket's normalized name/id to assets/models/<key>/scene.gltf
//   3. Load the local glTF into <model-viewer> next to the parsed API data
//
// The SpaceX API is frequently offline (Cloudflare 522), so a bundled fallback
// list is used when the fetch fails. NASA (SLS) and Blue Origin vehicles +
// engines are always included (those agencies have no equivalent public API).
//
// 3D models are CC-BY-4.0 from Sketchfab — attribution is shown in the UI and
// kept in each assets/models/<key>/license.txt.
const RocketHangar = (() => {

  const SPACEX_APIS = [
    'https://api.spacexdata.com/v4/rockets',
    'https://api.spacexdata.com/v5/rockets',
  ];
  const MODEL_BASE = 'assets/models';

  function normalizeKey(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // ── CC-BY-4.0 attribution for the bundled glTF models ───────────────────────
  const CREDITS = {
    falcon9:     { title: 'Falcon 9 - SpaceX',                   author: 'Stanley Creative', url: 'https://sketchfab.com/Stanley_Creative' },
    falconheavy: { title: 'SpaceX Falcon Heavy',                 author: 'SunnyChen753',     url: 'https://sketchfab.com/sunnychen753' },
    starship:    { title: 'SpaceX Starship - Spaceship',         author: 'MOJackal',         url: 'https://sketchfab.com/MOJackal' },
    superheavy:  { title: 'SpaceX Super Heavy Rocket',           author: 'andrew',           url: 'https://sketchfab.com/andrewBlenderProjects' },
    raptor:      { title: 'SpaceX Starship Raptor 3 engine',     author: 'VoitAa',           url: 'https://sketchfab.com/VoitAa' },
    newglenn:    { title: 'New Glenn (Better Version)',          author: 'Wolfpack278',      url: 'https://sketchfab.com/wolfpack278' },
    sls:         { title: 'Artemis II - Space Launch System',    author: 'RapidReality',     url: 'https://sketchfab.com/RapidReality' },
    be4:         { title: 'Blue Origin BE-4',                    author: 'MartianDays',      url: 'https://sketchfab.com/MartianDays' },
  };

  // ── Vehicle database (real figures) ─────────────────────────────────────────
  // Rockets carry numeric fields (auto-formatted); engines/custom carry `specs`.
  const BUNDLED = [
    { key: 'falcon9', name: 'Falcon 9', company: 'SpaceX', flag: '🇺🇸', kind: 'rocket',
      height: 70, diameter: 3.7, mass: 549054, stages: 2, first_flight: '2010-06-04', success_pct: 99, active: true,
      role: 'Workhorse orbital launcher · reusable first stage',
      desc: 'The first orbital-class reusable rocket. Its booster lands and re-flies, slashing launch cost and enabling rapid Starlink and crew cadence.' },

    { key: 'falconheavy', name: 'Falcon Heavy', company: 'SpaceX', flag: '🇺🇸', kind: 'rocket',
      height: 70, diameter: 12.2, mass: 1420788, stages: 2, first_flight: '2018-02-06', success_pct: 100, active: true,
      role: 'Heavy-lift · three Falcon 9 cores',
      desc: 'Three Falcon 9 first stages strapped together — 27 Merlin engines at liftoff. Among the most capable operational rockets in the world.' },

    { key: 'starship', name: 'Starship', company: 'SpaceX', flag: '🇺🇸', kind: 'rocket',
      height: 121, diameter: 9, mass: 5000000, stages: 2, first_flight: '2023-04-20', success_pct: 40, active: true,
      role: 'Super-heavy · fully reusable · Artemis III HLS',
      desc: 'The largest rocket ever built. The Starship HLS variant is NASA’s Artemis III lunar lander — it carries the crew from NRHO down to the south pole and back.' },

    { key: 'superheavy', name: 'Super Heavy', company: 'SpaceX', flag: '🇺🇸', kind: 'booster',
      role: 'Starship first stage · 33 Raptor engines',
      specs: [
        { k: 'HEIGHT', v: '71 m' }, { k: 'DIAMETER', v: '9 m' },
        { k: 'THRUST', v: '74 MN' }, { k: 'ENGINES', v: '33 × Raptor' },
        { k: 'PROPELLANT', v: 'CH₄ / LOX' }, { k: 'FIRST FLIGHT', v: '2023-04-20' },
      ],
      desc: 'The Starship booster — 33 Raptor engines producing roughly twice the liftoff thrust of the Saturn V. It flies back to the pad to be caught by the tower’s arms.' },

    { key: 'raptor', name: 'Raptor 3', company: 'SpaceX', flag: '🇺🇸', kind: 'engine',
      role: 'Full-flow staged-combustion engine',
      specs: [
        { k: 'THRUST', v: '280 tf' }, { k: 'CYCLE', v: 'Full-flow' },
        { k: 'PROPELLANT', v: 'CH₄ / LOX' }, { k: 'ISP (VAC)', v: '~350 s' },
        { k: 'DRY MASS', v: '~1,525 kg' }, { k: 'POWERS', v: 'Starship' },
      ],
      desc: 'The engine behind Starship and Super Heavy. Raptor 3 is the simplified, higher-thrust iteration — among the highest chamber-pressure rocket engines ever flown.' },

    { key: 'falcon1', name: 'Falcon 1', company: 'SpaceX', flag: '🇺🇸', kind: 'rocket',
      height: 22.25, diameter: 1.68, mass: 30146, stages: 2, first_flight: '2006-03-24', success_pct: 40, active: false,
      role: 'Retired · first privately-built orbital rocket',
      desc: 'SpaceX’s first rocket. Its fourth flight in 2008 was the first privately-developed liquid-fuel launcher to reach orbit — the company’s survival hung on it.' },

    { key: 'sls', name: 'Space Launch System', company: 'NASA', flag: '🇺🇸', kind: 'rocket',
      role: 'Super-heavy · Artemis launch vehicle',
      specs: [
        { k: 'HEIGHT', v: '98 m' }, { k: 'DIAMETER', v: '8.4 m' },
        { k: 'MASS', v: '2,600 t' }, { k: 'THRUST', v: '39.1 MN' },
        { k: 'STAGES', v: '2' }, { k: 'FIRST FLIGHT', v: '2022-11-16' },
      ],
      desc: 'NASA’s deep-space rocket. SLS lifts the Orion crew capsule toward the Moon; Block 1B with the Exploration Upper Stage will fly the Artemis III landing mission.' },

    { key: 'newglenn', name: 'New Glenn', company: 'Blue Origin', flag: '🇺🇸', kind: 'rocket',
      height: 98, diameter: 7, mass: 1450000, stages: 2, first_flight: '2025-01-16', success_pct: 50, active: true,
      role: 'Heavy-lift · reusable first stage · 7× BE-4',
      desc: 'Blue Origin’s orbital rocket, named for John Glenn. Seven BE-4 engines burning methalox; the first stage lands on a sea-based platform for reuse.' },

    { key: 'newshepard', name: 'New Shepard', company: 'Blue Origin', flag: '🇺🇸', kind: 'rocket',
      height: 18, diameter: 3.7, mass: 75000, stages: 1, first_flight: '2015-04-29', success_pct: 95, active: true,
      role: 'Suborbital · crewed space tourism',
      desc: 'A reusable suborbital vehicle named for Alan Shepard. Carries tourists and research payloads past the Kármán line and returns under parachutes.' },

    { key: 'bluemoon', name: 'Blue Moon', company: 'Blue Origin', flag: '🇺🇸', kind: 'lander',
      height: 16, diameter: 7, mass: 45000, stages: 1, first_flight: 'TBD', success_pct: null, active: true,
      role: 'Lunar lander · Artemis V · BE-7 engine',
      desc: 'Blue Origin’s hydrogen-fueled lunar lander, selected by NASA for Artemis V. The BE-7 burns liquid hydrogen and oxygen — the most efficient chemical propellant pairing.' },

    { key: 'be4', name: 'BE-4', company: 'Blue Origin', flag: '🇺🇸', kind: 'engine',
      role: 'Methalox staged-combustion engine',
      specs: [
        { k: 'THRUST', v: '2.4 MN' }, { k: 'CYCLE', v: 'Ox-rich staged' },
        { k: 'PROPELLANT', v: 'CH₄ / LOX' }, { k: 'FLIES ON', v: 'New Glenn · Vulcan' },
      ],
      desc: 'Blue Origin’s workhorse engine. Seven power New Glenn’s first stage, and it also flies on ULA’s Vulcan Centaur — the first American methalox engine in service.' },
  ];

  // Attach credits to entries that have a bundled model
  BUNDLED.forEach(r => { if (CREDITS[r.key]) r.credit = CREDITS[r.key]; });

  // ── Spec helpers ─────────────────────────────────────────────────────────────

  function rocketSpecs(r) {
    const t = (v, u) => (v === null || v === undefined) ? '—' : v.toLocaleString('en-US') + (u || '');
    return [
      { k: 'HEIGHT',       v: t(r.height, ' m') },
      { k: 'DIAMETER',     v: t(r.diameter, ' m') },
      { k: 'MASS',         v: r.mass ? (r.mass / 1000).toLocaleString('en-US') + ' t' : '—' },
      { k: 'STAGES',       v: t(r.stages) },
      { k: 'SUCCESS',      v: (r.success_pct === null || r.success_pct === undefined) ? '—' : r.success_pct + '%' },
      { k: 'FIRST FLIGHT', v: r.first_flight || '—' },
    ];
  }

  function specsFor(r) { return r.specs || rocketSpecs(r); }

  function coClass(company) {
    return company === 'SpaceX' ? 'sx' : company === 'NASA' ? 'na' : 'bo';
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  function bundledList() { return [...BUNDLED]; }

  // Try the live SpaceX API (v4 then v5, fast timeout); null if unreachable
  async function fetchSpacexLive() {
    for (const url of SPACEX_APIS) {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        const api = await res.json();
        if (!Array.isArray(api) || !api.length) continue;
        return api.map(r => ({
          key:          normalizeKey(r.name),
          height:       r.height?.meters ?? null,
          diameter:     r.diameter?.meters ?? null,
          mass:         r.mass?.kg ?? null,
          stages:       r.stages ?? null,
          first_flight: r.first_flight ?? null,
          success_pct:  r.success_rate_pct ?? null,
          active:       r.active ?? null,
          desc:         r.description || null,
        }));
      } catch { /* try next version */ }
    }
    return null;
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  let rockets  = [];
  let current  = 0;
  let built    = false;
  let enriched = false;
  let manifest = null;

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
    btn.innerHTML = '<span class="lb-glyph">⬢</span> ROCKET HANGAR';
    btn.onclick = open;
    document.body.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.id = 'rocket-overlay';
    overlay.innerHTML = `
      <div class="rh-header">
        <span class="rh-logo">⬢ ROCKET HANGAR · <span>VEHICLE DATABASE</span></span>
        <span class="rh-source" id="rh-source">—</span>
        <button class="rh-close" id="rh-close">✕</button>
      </div>
      <div class="rh-body">
        <div class="rh-list" id="rh-list"></div>
        <div class="rh-stage"><div class="rh-viewer" id="rh-viewer"></div></div>
        <div class="rh-specs" id="rh-specs"></div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('rh-close').onclick = close;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) close();
    });
  }

  function open() {
    build();
    document.getElementById('rocket-overlay').classList.add('active');

    if (!rockets.length) {
      rockets = bundledList();
      document.getElementById('rh-source').textContent = 'bundled specs';
      renderList();
    }
    select(current);

    loadManifest().then(() => select(current));

    if (!enriched) {
      enriched = true;
      fetchSpacexLive().then(live => {
        if (!live) {
          document.getElementById('rh-source').textContent = 'bundled specs · SpaceX API offline';
          return;
        }
        // Merge live numbers into matching entries; keep models, credits, extras
        const byKey = Object.fromEntries(live.map(l => [l.key, l]));
        rockets = rockets.map(r => {
          const l = byKey[r.key];
          if (!l) return r;
          return { ...r, ...Object.fromEntries(Object.entries(l).filter(([, v]) => v != null)), specs: r.specs, live: true };
        });
        document.getElementById('rh-source').textContent = 'SpaceX API · live + bundled';
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
      <button class="rh-item ${coClass(r.company)}" data-i="${i}">
        <span class="rh-item-name">${r.name}</span>
        <span class="rh-item-co">${r.flag} ${r.company}${r.kind === 'engine' ? ' · engine' : r.active === false ? ' · retired' : ''}</span>
      </button>`).join('');
    el.querySelectorAll('.rh-item').forEach(b => b.onclick = () => select(+b.dataset.i));
  }

  function select(i) {
    current = i;
    const r = rockets[i];
    document.querySelectorAll('.rh-item').forEach((b, j) => b.classList.toggle('active', j === i));

    const viewer = document.getElementById('rh-viewer');
    const src    = `${MODEL_BASE}/${r.key}/scene.gltf`;
    if (manifest && manifest.includes(r.key)) mountViewer(viewer, r, src);
    else                                       showPlaceholder(viewer, r, src);

    const specsEl = document.getElementById('rh-specs');
    const cc = coClass(r.company);
    const credit = r.credit
      ? `<div class="rh-credit">3D model: “${r.credit.title}” by
           <a href="${r.credit.url}" target="_blank" rel="noopener">${r.credit.author}</a>
           · <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC-BY-4.0</a></div>`
      : `<div class="rh-note">3D model loads from <code>${src}</code></div>`;

    specsEl.innerHTML = `
      <div class="rh-spec-head">
        <div class="rh-spec-co ${cc}">${r.flag} ${r.company.toUpperCase()}</div>
        <div class="rh-spec-name">${r.name}</div>
        <div class="rh-spec-role">${r.role || ''}</div>
      </div>
      <div class="rh-spec-grid">
        ${specsFor(r).map(s => `<div class="rh-spec"><div class="rh-k">${s.k}</div><div class="rh-v">${s.v}</div></div>`).join('')}
      </div>
      <div class="rh-desc">${r.desc || ''}</div>
      ${credit}`;
  }

  function mountViewer(viewer, r, src) {
    viewer.innerHTML = `
      <model-viewer
        src="${src}"
        alt="${r.name} 3D model"
        camera-controls auto-rotate rotation-per-second="20deg"
        interaction-prompt="none"
        shadow-intensity="1.1" exposure="1.15"
        environment-image="neutral"
        loading="eager" reveal="auto"
        style="width:100%;height:100%;background:transparent;">
        <div slot="poster" class="rh-poster">Loading ${r.name}…</div>
        <div slot="progress-bar"></div>
      </model-viewer>`;
    viewer.querySelector('model-viewer')
      .addEventListener('error', () => showPlaceholder(viewer, r, src));
  }

  function showPlaceholder(viewer, r, src) {
    viewer.innerHTML = `
      <div class="rh-placeholder">
        <div class="rh-ph-icon">⬢</div>
        <div class="rh-ph-title">No 3D model for ${r.name} yet</div>
        <div class="rh-ph-path">Add a glTF at<br><code>${src}</code><br>and list <code>"${r.key}"</code> in manifest.json</div>
        <div class="rh-ph-hint">See assets/models/README.md — grab one from Sketchfab,
        CGTrader, or NASA 3D Resources (mind the license).</div>
      </div>`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  return { open };
})();
