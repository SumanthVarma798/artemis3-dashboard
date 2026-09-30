// Rocket Hangar: 3D vehicle viewer with a spec sheet.
//
// Specs are bundled and checked against NASA, SpaceX, Blue Origin and Wikipedia vehicle pages on 2026-09-30.
// They are deliberately not merged from the r-spacex API: that API is unmaintained and returns older numbers
// (for example a pre-V3 Starship) that would overwrite the current ones.
//
// 3D models are CC-BY-4.0 from Sketchfab. Attribution is shown in the UI and kept in
// assets/models/<key>/license.txt. A vehicle without a model still shows its spec sheet.
const RocketHangar = (() => {

  const MODEL_BASE = 'assets/models';
  const CHECKED = 'Sep 30, 2026';
  const GROUPS = [['NASA', 'na'], ['SpaceX', 'sx'], ['Blue Origin', 'bo']];

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

  const S = (k, v) => ({ k, v });
  const VEHICLES = [
    // NASA
    { key: 'sls', name: 'Space Launch System', company: 'NASA', kind: 'Rocket',
      role: 'Launches Orion. Flown twice: Artemis I and II.',
      specs: [S('Height', '98 m'), S('Diameter', '8.4 m'), S('Liftoff mass', '2,610 t'), S('Thrust', '39 MN'), S('To the Moon', '27 t'), S('First flight', 'Nov 16, 2022')],
      desc: 'NASA\'s deep-space rocket. It carried the crewed Artemis II flyby in April 2026 and flies next on Artemis III, a 2027 Earth-orbit docking test, with a spacer in place of the upper stage. NASA cancelled the larger Block 1B and Block 2 versions in February 2026 to standardize on Block 1.' },
    { key: 'orion', name: 'Orion', company: 'NASA', kind: 'Capsule',
      role: 'Crew vehicle for every Artemis mission',
      specs: [S('Crew', '4'), S('Diameter', '5.03 m'), S('Pressurized', '19.6 m³'), S('Power', '11 kW'), S('Design life', '21 days'), S('Flights', '3')],
      desc: 'Lockheed Martin builds the capsule and Airbus builds the European Service Module for ESA. Orion flew uncrewed on EFT-1 in 2014 and Artemis I in 2022, then carried four astronauts around the Moon on Artemis II as Integrity. On Artemis III it becomes the docking vehicle for the landers.' },

    // SpaceX
    { key: 'starship', name: 'Starship', company: 'SpaceX', kind: 'Rocket',
      role: 'Fully reusable super-heavy launcher. HLS lander variant.',
      specs: [S('Stack height', '124 m (V3)'), S('Diameter', '9 m'), S('Stack mass', '5,000 t'), S('Stages', '2'), S('First orbit', 'Sep 28, 2026'), S('First flight', 'Apr 20, 2023')],
      desc: 'The largest rocket ever built. Flight 14 on September 28, 2026 was its first orbital mission. A Starship test article flies on Artemis III and docks with Orion; the landing version, Starship HLS, is about 52 m tall and designed to put roughly 100 tonnes on the Moon.' },
    { key: 'superheavy', name: 'Super Heavy', company: 'SpaceX', kind: 'Booster',
      role: 'Starship first stage',
      specs: [S('Height', '71 m'), S('Diameter', '9 m'), S('Engines', '33 × Raptor'), S('Propellant', 'Methane, oxygen'), S('Gross mass', '3,675 t'), S('First flight', 'Apr 20, 2023')],
      desc: 'The Starship booster. It flies back to the launch site to be caught by the tower\'s arms instead of landing on legs.' },
    { key: 'raptor', name: 'Raptor 3', company: 'SpaceX', kind: 'Engine',
      role: 'Full-flow staged-combustion engine',
      specs: [S('Thrust', '280 tf'), S('Cycle', 'Full-flow'), S('Propellant', 'Methane, oxygen'), S('Powers', 'Starship')],
      desc: 'The engine behind Starship and Super Heavy. Full-flow staged combustion runs at very high chamber pressure, which is why it is so efficient.' },
    { key: 'falcon9', name: 'Falcon 9', company: 'SpaceX', kind: 'Rocket',
      role: 'Workhorse orbital launcher with a reusable first stage',
      specs: [S('Height', '70 m'), S('Diameter', '3.7 m'), S('Liftoff mass', '549 t'), S('Stages', '2'), S('First flight', 'Jun 4, 2010')],
      desc: 'The first orbital-class rocket to reuse its first stage. Its boosters land and re-fly, which cut launch costs and made frequent crew and Starlink launches routine.' },
    { key: 'falconheavy', name: 'Falcon Heavy', company: 'SpaceX', kind: 'Rocket',
      role: 'Heavy lift built from three Falcon 9 cores',
      specs: [S('Height', '70 m'), S('Width', '12.2 m'), S('Liftoff mass', '1,421 t'), S('Engines', '27 × Merlin'), S('First flight', 'Feb 6, 2018')],
      desc: 'Three Falcon 9 first stages side by side, 27 Merlin engines at liftoff. The two side boosters usually return to land together.' },

    // Blue Origin
    { key: 'newglenn', name: 'New Glenn', company: 'Blue Origin', kind: 'Rocket',
      role: 'Heavy lift with a reusable first stage',
      specs: [S('Height', '98 m'), S('Diameter', '7 m'), S('Engines', '7 × BE-4'), S('To low orbit', '45 t'), S('To the Moon', '7 t'), S('First flight', 'Jan 16, 2025')],
      desc: 'Named for John Glenn. Blue Origin plans to launch its Blue Moon landers on it, starting with the uncrewed Mark 1 pathfinder. The first stage lands on a sea-based platform to be reused.' },
    { key: 'bluemoon', name: 'Blue Moon', company: 'Blue Origin', kind: 'Lander',
      role: 'Crewed lunar lander, one of two NASA is developing',
      specs: [S('Mark 2 height', '16 m'), S('Engines', '3 × BE-7'), S('Propellant', 'Hydrogen, oxygen'), S('Surface stay', 'Up to 30 days'), S('Mark 1 pathfinder', 'Targeted 2027')],
      desc: 'A test version of the Mark 2 docks with Orion on Artemis III. A smaller uncrewed cargo lander, Mark 1, flies first as a pathfinder. If Blue Moon is ready before Starship HLS, it could fly the Artemis IV landing in early 2028.' },
    { key: 'be4', name: 'BE-4', company: 'Blue Origin', kind: 'Engine',
      role: 'Methane staged-combustion engine',
      specs: [S('Thrust', '2.4 MN'), S('Cycle', 'Oxidizer-rich staged'), S('Propellant', 'Methane, oxygen'), S('Flies on', 'New Glenn, Vulcan')],
      desc: 'Seven of them power New Glenn\'s first stage, and two power United Launch Alliance\'s Vulcan Centaur.' },
  ];
  VEHICLES.forEach(v => { if (CREDITS[v.key]) v.credit = CREDITS[v.key]; });

  let current = 0, built = false, manifest = null, lastFocus = null, overlay = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  async function loadManifest() {
    if (manifest) return manifest;
    try { const r = await fetch(`${MODEL_BASE}/manifest.json`, { cache: 'no-cache' }); manifest = r.ok ? await r.json() : []; }
    catch { manifest = []; }
    return manifest;
  }

  function build() {
    if (built) return;
    built = true;

    const btn = document.createElement('button');
    btn.id = 'rocket-open-btn'; btn.className = 'tb-exhibit'; btn.type = 'button';
    btn.innerHTML = '<i class="ph ph-rocket-launch" aria-hidden="true"></i><span class="tb-label">Hangar</span>';
    btn.onclick = open;
    ($('exhibit-nav') || document.body).appendChild(btn);

    overlay = document.createElement('div');
    overlay.id = 'rocket-overlay';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Rocket hangar'); overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <header class="rh-header">
        <span class="rh-logo">Rocket hangar</span>
        <span class="rh-source">Specs checked ${CHECKED}</span>
        <button class="rh-close" id="rh-close" type="button" aria-label="Close hangar"><i class="ph ph-x" aria-hidden="true"></i></button>
      </header>
      <div class="rh-body">
        <nav class="rh-list" id="rh-list" aria-label="Vehicles"></nav>
        <div class="rh-stage"><div class="rh-viewer" id="rh-viewer"></div><div class="rh-hint" id="rh-hint"></div></div>
        <aside class="rh-specs" id="rh-specs" aria-live="polite"></aside>
      </div>`;
    document.body.appendChild(overlay);

    $('rh-close').onclick = close;
    overlay.addEventListener('keydown', onKey);
    renderList();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...overlay.querySelectorAll('button:not([disabled]), model-viewer')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest?.('.rh-list')) {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1, n = VEHICLES.length;
      const next = (current + d + n) % n;
      select(next); overlay.querySelector(`.rh-item[data-i="${next}"]`)?.focus();
    }
  }

  function open() {
    build();
    lastFocus = document.activeElement;
    overlay.classList.add('active'); overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    loadManifest().then(() => select(current, true));
    select(current, true);
    setTimeout(() => overlay.querySelector(`.rh-item[data-i="${current}"]`)?.focus({ preventScroll: true }), 60);
  }

  function close() {
    overlay.classList.remove('active'); overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    $('rh-viewer').innerHTML = '';
    lastFocus?.focus?.({ preventScroll: true });
  }

  function renderList() {
    $('rh-list').innerHTML = GROUPS.map(([co, cls]) => `
      <div class="rh-group ${cls}">
        <div class="rh-group-name">${co}</div>
        ${VEHICLES.map((v, i) => v.company === co ? `
          <button class="rh-item" type="button" data-i="${i}">
            <span class="rh-item-name">${esc(v.name)}</span>
            <span class="rh-item-kind">${esc(v.kind)}</span>
          </button>` : '').join('')}
      </div>`).join('');
    overlay.querySelectorAll('.rh-item').forEach(b => b.onclick = () => select(+b.dataset.i));
  }

  function select(i, instant) {
    const first = !overlay.dataset.ready; overlay.dataset.ready = '1';
    current = i;
    const v = VEHICLES[i];
    overlay.querySelectorAll('.rh-item').forEach(b => {
      const on = +b.dataset.i === i; b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });

    const viewer = $('rh-viewer'), src = `${MODEL_BASE}/${v.key}/scene.gltf`;
    const hasModel = manifest && manifest.includes(v.key);
    if (hasModel) mount(viewer, v, src); else noModel(viewer, v, manifest !== null);
    $('rh-hint').textContent = hasModel ? 'Drag to rotate. Scroll to zoom.' : '';

    const credit = v.credit
      ? `<div class="rh-credit">3D model "${esc(v.credit.title)}" by <a href="${v.credit.url}" target="_blank" rel="noopener">${esc(v.credit.author)}</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></div>`
      : '';
    const specs = $('rh-specs');
    specs.innerHTML = `
      <div class="rh-spec-head">
        <div class="rh-spec-co ${GROUPS.find(g => g[0] === v.company)[1]}">${esc(v.company)}</div>
        <h2 class="rh-spec-name">${esc(v.name)}</h2>
        <div class="rh-spec-role">${esc(v.role)}</div>
      </div>
      <dl class="rh-spec-grid">
        ${v.specs.map(s => `<div class="rh-spec"><dt class="rh-k">${esc(s.k)}</dt><dd class="rh-v">${esc(s.v)}</dd></div>`).join('')}
      </dl>
      <p class="rh-desc">${esc(v.desc)}</p>
      ${credit}`;
    if (!instant && !reduce.matches) {
      specs.classList.remove('swap'); void specs.offsetWidth; specs.classList.add('swap');
      viewer.classList.remove('swap'); void viewer.offsetWidth; viewer.classList.add('swap');
    }
  }

  function mount(viewer, v, src) {
    viewer.innerHTML = `
      <model-viewer src="${src}" alt="3D model of ${esc(v.name)}"
        camera-controls ${reduce.matches ? '' : 'auto-rotate rotation-per-second="18deg"'} interaction-prompt="none"
        shadow-intensity="1.1" exposure="1.15" environment-image="neutral" loading="eager" reveal="auto"
        style="width:100%;height:100%;background:transparent;">
        <div slot="poster" class="rh-poster">Loading ${esc(v.name)}</div>
        <div slot="progress-bar"></div>
      </model-viewer>`;
    viewer.querySelector('model-viewer').addEventListener('error', () => noModel(viewer, v, true));
  }

  function noModel(viewer, v, known) {
    viewer.innerHTML = known
      ? `<div class="rh-placeholder"><div class="rh-ph-title">No 3D model for ${esc(v.name)} yet</div><div class="rh-ph-hint">The spec sheet is still accurate.</div></div>`
      : `<div class="rh-poster">Loading</div>`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  return { open };
})();
