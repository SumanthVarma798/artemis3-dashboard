// Three.js orbital visualization — interactive Earth/Moon/Orion/Starship HLS
const Orbital3D = (() => {
  let renderer, scene, camera, animFrame;
  let earthMesh, earthAtmo, earthLights, moonMesh, orionMesh, starshipMesh;
  let orionTrail, trajectoryLine, nrhoGroup;
  let tooltipEl, hintEl;
  let moonAngle = 0.4;

  const CDN    = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/';
  // NASA Blue Marble / Black Marble imagery (CORS-enabled via jsdelivr)
  const NASA   = 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/';
  const loader = new THREE.TextureLoader();

  function texColor(url) { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function texData(url)  { return loader.load(url); }

  const state = {
    orionDistMoon:   null,
    orionDistEarth:  null,
    orionVelocity:   null,
    missionPhase:    'TLI COMPLETE',
    lastUpdate:      null,
    transitProgress: 0.38,
  };

  const EARTH_R   = 0.55;
  const MOON_R    = 0.20;
  const ORBIT_R   = 5.5;
  const TRAIL_LEN = 120;
  const trailPositions = [];

  // ── Camera control state (spherical orbit) ──────────────────────────────────
  const cam = {
    target:       new THREE.Vector3(2.4, 0.1, 0.6),
    theta:        0.6,            // azimuth
    phi:          1.02,           // polar from +Y
    radius:       11,
    targetRadius: 11,
    dragging:     false,
    lastIdle:     0,              // ts of last user interaction
    followId:     null,          // object being framed
  };
  const DEFAULT_CENTER = new THREE.Vector3(2.4, 0.1, 0.6);
  const NEAR_THRESH    = 4.6;     // radius below which we show part-level detail

  // ── Raycast / hover state ───────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2(-2, -2);
  let pickables   = [];
  let hoveredRoot = null;

  // ── Playback ────────────────────────────────────────────────────────────────
  let paused    = false;
  let simClock  = 0;            // advances only while playing (drives motion)
  let lastFrame = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let skybox    = null;

  // Tycho all-sky star catalog map (NASA-derived), CORS-safe via jsdelivr
  const STARMAP = 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/night-sky.png';

  // ── Component metadata (zoom-aware tooltips) ────────────────────────────────
  const INFO = {
    earth: () => ({ title: 'EARTH', tag: 'DEPARTURE', accent: '#3399ff', lines: [
      'Launch · Kennedy Space Center, LC-39B',
      'TLI burn flings Orion Moonward at 10.8 km/s',
      'Crew returns here at mission end — splashdown',
    ]}),
    moon: () => ({ title: 'THE MOON', tag: 'DESTINATION', accent: '#cdbf9f', lines: [
      '384,400 km average distance',
      'Target: Shackleton Crater rim, 89.5°S',
      'Orion holds in NRHO while HLS descends',
    ]}),
    orion: () => ({ title: 'ORION', tag: 'CREW VEHICLE', accent: '#00ffcc', lines: [
      `Phase · ${state.missionPhase}`,
      state.orionVelocity != null ? `Velocity · ${state.orionVelocity.toFixed(2)} km/s` : 'Velocity · —',
      state.orionDistMoon  != null ? `To Moon · ${(state.orionDistMoon/1000).toFixed(0)} Mm` : 'Crew · 4',
      'Lockheed Martin + ESA · zoom in for parts',
    ]}),
    'orion-cm': () => ({ title: 'CREW MODULE', tag: 'THE CAPSULE', accent: '#eef2f6', lines: [
      'Pressurized cabin · 4 astronauts',
      'Apollo-style gumdrop · 5.0 m wide',
      'AVCOAT heat shield — 2,760 °C on reentry',
      'The only piece that comes home',
    ]}),
    'orion-sm': () => ({ title: 'EUROPEAN SERVICE MODULE', tag: 'PROPULSION', accent: '#aab4bd', lines: [
      'Main engine + 32 thrusters',
      'Power, water, air & propellant',
      'Built by Airbus · jettisoned before reentry',
    ]}),
    'orion-solar': () => ({ title: 'SOLAR ARRAY WING', tag: 'POWER', accent: '#3b5bdb', lines: [
      '4 wings · 11.2 kW total',
      'Each rotates to track the Sun',
    ]}),
    starship: () => ({ title: 'STARSHIP HLS', tag: 'HUMAN LANDING SYSTEM', accent: '#ff9d3c', lines: [
      'SpaceX lunar lander · Artemis III',
      'Carries 2 crew to the surface & back',
      'Pre-positioned in NRHO, awaiting Orion',
      '~50 m tall · bare stainless steel',
    ]}),
    'hls-body': () => ({ title: 'STAINLESS HULL', tag: 'STRUCTURE & TANKS', accent: '#cfd6dc', lines: [
      '300-series stainless steel airframe',
      'Liquid methane + liquid oxygen tanks',
      'No reentry flaps — lunar surface only',
    ]}),
    'hls-thruster': () => ({ title: 'HIGH-MOUNT THRUSTERS', tag: 'SOFT LANDING', accent: '#ffce6b', lines: [
      'Mid-body engines fire for final descent',
      'Keeps the exhaust off the regolith',
    ]}),
    'hls-legs': () => ({ title: 'LANDING LEGS', tag: 'TOUCHDOWN', accent: '#9aa4ad', lines: [
      'Wide deployable stance',
      'Spreads load on soft lunar soil',
    ]}),
    'hls-solar': () => ({ title: 'SOLAR PANELS', tag: 'POWER', accent: '#3b5bdb', lines: [
      'Body-mounted arrays near the nose',
      'Recharge during the long NRHO wait',
    ]}),
  };

  // ── Procedural helpers ──────────────────────────────────────────────────────

  function makeGlowSprite(color, size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    const r = (color >> 16) & 0xff, gr = (color >> 8) & 0xff, b = color & 0xff;
    g.addColorStop(0,   `rgba(${r},${gr},${b},0.9)`);
    g.addColorStop(0.3, `rgba(${r},${gr},${b},0.4)`);
    g.addColorStop(1,   `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  // Brushed-steel highlight band (wraps the cylinder for a sunlit-metal look)
  function makeSteelTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 4;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0.00, '#6a7178');
    g.addColorStop(0.18, '#c4ccd2');
    g.addColorStop(0.30, '#ffffff');
    g.addColorStop(0.42, '#aeb6bc');
    g.addColorStop(0.62, '#cdd4da');
    g.addColorStop(0.80, '#7c838a');
    g.addColorStop(1.00, '#6a7178');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  // Solar-cell texture (blue cells with gold grid)
  function makeSolarTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 48;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#16236e'; ctx.fillRect(0, 0, 128, 48);
    ctx.fillStyle = '#243aa6';
    for (let x = 2; x < 128; x += 16) ctx.fillRect(x, 2, 12, 44);
    ctx.strokeStyle = '#b8902f'; ctx.lineWidth = 1;
    for (let x = 0; x <= 128; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 48); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(128, 24); ctx.stroke();
    return new THREE.CanvasTexture(c);
  }

  // ── Scene init ───────────────────────────────────────────────────────────────

  function init() {
    const canvas = document.getElementById('orbital-canvas');

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);

    buildSkybox();
    buildStarfield();
    buildLights();
    buildEarth();
    buildMoon();
    buildOrbitRing();
    buildOrion();
    buildStarship();
    buildNRHO();
    buildTrail();
    buildTrajectoryArc();

    pickables = [earthMesh, moonMesh, orionMesh, starshipMesh];

    buildOverlay();
    setupInteraction();
    resize();
    window.addEventListener('resize', resize);
    animate();
  }

  // Celestial sphere — the scene sits inside a giant sphere whose inner wall is
  // lined with an all-sky star map (rendered from the inside via BackSide).
  function buildSkybox() {
    const tex = texColor(STARMAP);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      color: 0xcdd4e6,   // slight tone-down so it reads as a backdrop, not foreground
      depthWrite: false,
    });
    skybox = new THREE.Mesh(new THREE.SphereGeometry(800, 60, 40), mat);
    scene.add(skybox);
  }

  // A sparse layer of brighter foreground stars in front of the star map (depth)
  function buildStarfield() {
    const geo = new THREE.BufferGeometry();
    const verts = [], colors = [];
    const palette = [[1,1,1],[0.85,0.92,1],[1,0.96,0.85],[0.95,0.85,1],[0.8,0.9,1]];
    for (let i = 0; i < 900; i++) {
      const r = 120 + Math.random() * 60;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      verts.push(r*Math.sin(p)*Math.cos(t), r*Math.cos(p), r*Math.sin(p)*Math.sin(t));
      const c = palette[Math.floor(Math.random()*palette.length)];
      const b = 0.5 + Math.random()*0.5;
      colors.push(c[0]*b, c[1]*b, c[2]*b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true,
    })));
  }

  function buildLights() {
    scene.add(new THREE.AmbientLight(0x0a1a2e, 2.0));
    const sun = new THREE.DirectionalLight(0xfff8e8, 3.5);
    sun.position.set(25, 8, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x1a3a6a, 0.4);
    fill.position.set(-10, -4, -8);
    scene.add(fill);
  }

  function buildEarth() {
    // NASA Blue Marble day map + topology relief + ocean-mask specular
    const earthMat = new THREE.MeshPhongMaterial({
      map:         texColor(NASA + 'earth-blue-marble.jpg'),
      bumpMap:     texData(NASA + 'earth-topology.png'),
      bumpScale:   0.018,
      specularMap: texData(NASA + 'earth-water.png'),
      specular:    0x2a4a6a,
      shininess:   16,
    });
    earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 96), earthMat);
    earthMesh.userData = { root: 'earth', part: 'earth' };
    scene.add(earthMesh);

    // NASA Black Marble city lights on the night side
    earthLights = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.001, 96, 96),
      new THREE.MeshBasicMaterial({
        map: texColor(NASA + 'earth-night.jpg'),
        blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85, depthWrite: false,
      })
    );
    earthMesh.add(earthLights);

    earthAtmo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.08, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0x2255aa, transparent: true, opacity: 0.15, depthWrite: false })
    );
    scene.add(earthAtmo);

    const rim = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0x3399ff, 256), transparent: true, opacity: 0.35,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    rim.scale.set(EARTH_R * 3.2, EARTH_R * 3.2, 1);
    earthMesh.add(rim);
  }

  function buildMoon() {
    // NASA/USGS lunar mosaic; topology doubles as a subtle bump for crater relief
    moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R, 64, 64),
      new THREE.MeshPhongMaterial({
        map:       texColor(CDN + 'moon_1024.jpg'),
        bumpMap:   texData(CDN + 'moon_1024.jpg'),
        bumpScale: 0.004,
        emissive:  0x0a0907, shininess: 3,
      })
    );
    moonMesh.userData = { root: 'moon', part: 'moon' };
    scene.add(moonMesh);

    const rim = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0xaa9977, 128), transparent: true, opacity: 0.18,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    rim.scale.set(MOON_R * 3.0, MOON_R * 3.0, 1);
    moonMesh.add(rim);
  }

  function buildOrbitRing() {
    scene.add(new THREE.Mesh(
      new THREE.TorusGeometry(ORBIT_R, 0.006, 6, 200).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x355a8c, transparent: true, opacity: 0.7 })
    ));
  }

  // ── Orion: Crew Module + European Service Module + 4 solar wings ────────────
  function buildOrion() {
    const g = new THREE.Group();
    g.userData = { root: 'orion', popable: true };

    const mark = (m, part) => { m.userData = { root: 'orion', part }; return m; };

    // Service Module (body)
    const sm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.10, 16),
      new THREE.MeshPhongMaterial({ color: 0x9aa0a6, specular: 0x555555, shininess: 40, emissive: 0x0a0c0f })
    );
    sm.position.y = 0; g.add(mark(sm, 'orion-sm'));

    // SM engine nozzle
    const noz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.03, 0.04, 12),
      new THREE.MeshPhongMaterial({ color: 0x3a3a3a, shininess: 10 })
    );
    noz.position.y = -0.07; g.add(mark(noz, 'orion-sm'));

    // Heat shield (dark bronze disc under the capsule)
    const hs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.046, 0.014, 16),
      new THREE.MeshPhongMaterial({ color: 0x6b4a26, specular: 0x221100, shininess: 8, emissive: 0x140a04 })
    );
    hs.position.y = 0.058; g.add(mark(hs, 'orion-cm'));

    // Crew Module (gumdrop — wide bottom, narrow top)
    const cm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.05, 0.075, 16),
      new THREE.MeshPhongMaterial({ color: 0xe6eaee, specular: 0x99a0a8, shininess: 70, emissive: 0x0c0e10 })
    );
    cm.position.y = 0.103; g.add(mark(cm, 'orion-cm'));

    // Docking adapter (tiny top nub)
    const dock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.02, 12),
      new THREE.MeshPhongMaterial({ color: 0x888f96, shininess: 30 })
    );
    dock.position.y = 0.15; g.add(mark(dock, 'orion-cm'));

    // 4 solar array wings in an X
    const solarMat = new THREE.MeshPhongMaterial({
      map: makeSolarTexture(), color: 0x4060ff, specular: 0x222244,
      shininess: 80, emissive: 0x060818, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 4; i++) {
      const ang  = i * Math.PI / 2 + Math.PI / 4;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.004, 0.05), solarMat);
      wing.position.set(Math.cos(ang) * 0.13, 0, Math.sin(ang) * 0.13);
      wing.rotation.y = -ang;
      g.add(mark(wing, 'orion-solar'));
    }

    // Soft glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0x00ffcc), transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(0.42, 0.42, 1);
    g.add(glow);

    orionMesh = g;
    scene.add(orionMesh);
  }

  // ── Starship HLS: stainless body, nose, thruster ring, legs, solar ──────────
  function buildStarship() {
    const g = new THREE.Group();
    g.userData = { root: 'starship', popable: true };
    const mark = (m, part) => { m.userData = { root: 'starship', part }; return m; };

    const steel = new THREE.MeshPhongMaterial({
      map: makeSteelTexture(), color: 0xc6ced4, specular: 0xffffff, shininess: 95, emissive: 0x05080a,
    });

    // Main hull
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.052, 0.34, 24), steel);
    g.add(mark(body, 'hls-body'));

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 24), steel);
    nose.position.y = 0.225; g.add(mark(nose, 'hls-body'));

    // Engine skirt (darker bottom)
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.056, 0.04, 24),
      new THREE.MeshPhongMaterial({ color: 0x3c3c40, shininess: 20 })
    );
    skirt.position.y = -0.18; g.add(mark(skirt, 'hls-body'));

    // High-mount landing thruster ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.054, 0.012, 8, 24).rotateX(Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: 0x555a60, specular: 0x888888, shininess: 40, emissive: 0x100800 })
    );
    ring.position.y = 0.05; g.add(mark(ring, 'hls-thruster'));

    // Landing legs (6, splayed out)
    const legMat = new THREE.MeshPhongMaterial({ color: 0x8a9098, shininess: 30 });
    for (let i = 0; i < 6; i++) {
      const ang = i * Math.PI / 3;
      const top = new THREE.Vector3(Math.cos(ang) * 0.045, -0.10, Math.sin(ang) * 0.045);
      const bot = new THREE.Vector3(Math.cos(ang) * 0.12,  -0.21, Math.sin(ang) * 0.12);
      const dir = bot.clone().sub(top);
      const len = dir.length();
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.007, len, 0.007), legMat);
      leg.position.copy(top).add(bot).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      g.add(mark(leg, 'hls-legs'));
    }

    // Body-mounted solar panels near the nose
    const solarMat = new THREE.MeshPhongMaterial({
      map: makeSolarTexture(), color: 0x4060ff, shininess: 70, emissive: 0x060818, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 2; i++) {
      const ang   = i * Math.PI;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.06), solarMat);
      panel.position.set(Math.cos(ang) * 0.062, 0.12, Math.sin(ang) * 0.062);
      g.add(mark(panel, 'hls-solar'));
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0xff8800), transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(0.5, 0.5, 1);
    g.add(glow);

    starshipMesh = g;
    scene.add(starshipMesh);
  }

  // ── NRHO halo orbit (drawn relative to the Moon) ────────────────────────────
  function nrhoLocal(a) {
    const rx = 0.42, ry = 1.16, cy = 0.78; // nearly-polar, perilune near south pole
    return new THREE.Vector3(Math.sin(a) * rx, cy + Math.cos(a) * ry, Math.cos(a) * rx * 0.55);
  }

  function buildNRHO() {
    nrhoGroup = new THREE.Group();
    const pts = [];
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) pts.push(nrhoLocal(a));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: 0x66ccff, dashSize: 0.14, gapSize: 0.07, transparent: true, opacity: 0.9 })
    );
    line.computeLineDistances();
    nrhoGroup.add(line);
    // Soft additive halo so the orbit reads clearly against the Moon
    const halo = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x3aa0ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending })
    );
    nrhoGroup.add(halo);
    scene.add(nrhoGroup);
  }

  function buildTrail() {
    const geo  = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    geo.setDrawRange(0, 0);
    orionTrail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
    scene.add(orionTrail);
  }

  function buildTrajectoryArc() {
    if (trajectoryLine) scene.remove(trajectoryLine);
    const pts = [];
    for (let t = 0; t <= 1; t += 0.008) {
      const p = orionPosition(t);
      pts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: 0x4db8ff, dashSize: 0.16, gapSize: 0.10, transparent: true, opacity: 0.92 })
    );
    trajectoryLine.computeLineDistances();
    scene.add(trajectoryLine);
  }

  // Trans-lunar transfer arc Earth → Moon (curves out tangentially, arcs to Moon)
  function orionPosition(t) {
    const mx = Math.cos(moonAngle) * ORBIT_R;
    const mz = Math.sin(moonAngle) * ORBIT_R;
    const cx = mx * 0.25, cy = 1.8, cz = mz * 0.25 + ORBIT_R * 0.45;
    const u  = 1 - t;
    return {
      x: 2*u*t*cx + t*t*mx,
      y: 2*u*t*cy,
      z: 2*u*t*cz + t*t*mz,
    };
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  function buildOverlay() {
    const panel = document.getElementById('panel-orbital');
    // Tooltip is fixed-positioned on <body> so it tracks the cursor in viewport
    // coordinates regardless of ancestor layout/positioning.
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'orbital-tooltip';
    tooltipEl.className = 'orbital-tooltip hidden';
    document.body.appendChild(tooltipEl);

    hintEl = document.createElement('div');
    hintEl.id = 'orbital-hint';
    hintEl.className = 'orbital-hint';
    hintEl.textContent = 'drag to rotate · scroll to zoom · hover for details';
    panel.appendChild(hintEl);

    // Pause / play toggle — freezes all motion so tooltips are easy to hover
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'orbital-pause';
    pauseBtn.className = 'orbital-pause';
    pauseBtn.innerHTML = '<span class="op-icon">❚❚</span><span class="op-label">PAUSE</span>';
    pauseBtn.title = 'Pause animation — freeze the scene to hover objects';
    pauseBtn.onclick = togglePause;
    panel.appendChild(pauseBtn);
  }

  function togglePause() {
    paused = !paused;
    const btn = document.getElementById('orbital-pause');
    if (btn) {
      btn.classList.toggle('paused', paused);
      btn.querySelector('.op-icon').textContent  = paused ? '►' : '❚❚';
      btn.querySelector('.op-label').textContent = paused ? 'PLAY' : 'PAUSE';
    }
  }

  function setupInteraction() {
    const dom = renderer.domElement;
    let lastX = 0, lastY = 0;

    dom.addEventListener('pointerdown', (e) => {
      cam.dragging = true; cam.lastIdle = Date.now();
      lastX = e.clientX; lastY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });

    dom.addEventListener('pointermove', (e) => {
      const rect = dom.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      // Tooltip is fixed → use viewport coords, clamped to the window
      let lx = e.clientX + 16;
      let ly = e.clientY + 16;
      if (lx + 250 > window.innerWidth)  lx = e.clientX - 266;
      if (ly + 160 > window.innerHeight) ly = e.clientY - 168;
      tooltipEl.style.left = lx + 'px';
      tooltipEl.style.top  = ly + 'px';

      if (cam.dragging) {
        cam.theta -= (e.clientX - lastX) * 0.006;
        cam.phi    = Math.max(0.18, Math.min(Math.PI - 0.18, cam.phi - (e.clientY - lastY) * 0.006));
        lastX = e.clientX; lastY = e.clientY; cam.lastIdle = Date.now();
      }
    });

    const endDrag = (e) => { cam.dragging = false; try { dom.releasePointerCapture(e.pointerId); } catch {} };
    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointercancel', endDrag);
    dom.addEventListener('pointerleave', () => { pointer.set(-2, -2); });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      cam.targetRadius = Math.max(1.4, Math.min(30, cam.targetRadius * (1 + Math.sign(e.deltaY) * 0.08)));
      cam.lastIdle = Date.now();
    }, { passive: false });

    // Click to frame an object; click empty space to release
    dom.addEventListener('click', () => {
      if (hoveredRoot) {
        cam.followId     = hoveredRoot;
        cam.targetRadius = hoveredRoot === 'earth' ? 3.4 : hoveredRoot === 'moon' ? 3.0 : 2.5;
      } else {
        cam.followId     = null;
        cam.targetRadius = 11;
      }
      cam.lastIdle = Date.now();
    });
    dom.style.cursor = 'grab';
  }

  function objectPosition(id) {
    if (id === 'earth')    return earthMesh.position;
    if (id === 'moon')     return moonMesh.position;
    if (id === 'orion')    return orionMesh.position;
    if (id === 'starship') return starshipMesh.position;
    return DEFAULT_CENTER;
  }

  function updateHover() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    let root = null, part = null;
    for (const h of hits) {
      if (h.object.userData && h.object.userData.root) {
        root = h.object.userData.root;
        part = h.object.userData.part || root;
        break;
      }
    }

    hoveredRoot = root;
    renderer.domElement.style.cursor = root ? 'pointer' : (cam.dragging ? 'grabbing' : 'grab');

    if (!root) { tooltipEl.classList.add('hidden'); return; }

    // Zoom-aware: when zoomed in close, show the specific part; else the whole vehicle
    const near = cam.radius < NEAR_THRESH;
    let key = root;
    if (near && part && INFO[part]) key = part;
    const info = (INFO[key] || INFO[root])();

    tooltipEl.innerHTML =
      `<div class="ot-tag" style="color:${info.accent}">${info.tag}</div>` +
      `<div class="ot-title">${info.title}</div>` +
      info.lines.filter(Boolean).map(l => `<div class="ot-line">${l}</div>`).join('') +
      (near ? '' : `<div class="ot-hint">scroll in for component detail</div>`);
    tooltipEl.classList.remove('hidden');
  }

  // ── Animation loop ───────────────────────────────────────────────────────────

  function animate() {
    animFrame = requestAnimationFrame(animate);
    const real = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt   = real - lastFrame;
    lastFrame  = real;
    if (!paused) simClock += dt;   // motion is driven by simClock, frozen on pause

    // Bodies (orbital + spin advance only while playing)
    if (!paused) {
      moonAngle += 0.0008;
      moonMesh.rotation.y += 0.001;
      earthMesh.rotation.y += 0.0025;
      earthAtmo.rotation.y -= 0.0008;
      if (skybox) skybox.rotation.y += 0.00002;
    }
    moonMesh.position.set(Math.cos(moonAngle) * ORBIT_R, 0, Math.sin(moonAngle) * ORBIT_R);
    nrhoGroup.position.copy(moonMesh.position);

    buildTrajectoryArc();

    // Orion — position + orient nose along the trajectory tangent
    const op  = orionPosition(state.transitProgress);
    const op2 = orionPosition(Math.min(0.999, state.transitProgress + 0.01));
    const opPos  = new THREE.Vector3(op.x, op.y, op.z);
    const tangent = new THREE.Vector3(op2.x - op.x, op2.y - op.y, op2.z - op.z).normalize();
    orionMesh.position.copy(opPos);
    orionMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

    // Starship — rides the NRHO halo, nose pointing radially out from the Moon
    const shipPhase = simClock * 0.00018;
    const shipLocal = nrhoLocal(shipPhase);
    const shipPos   = moonMesh.position.clone().add(shipLocal);
    starshipMesh.position.copy(shipPos);
    const radial = shipLocal.clone().normalize();
    starshipMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);

    // Hover-pop scale for spacecraft
    [orionMesh, starshipMesh].forEach(g => {
      const want = (hoveredRoot === g.userData.root) ? 1.18 : 1.0;
      const s = g.scale.x + (want - g.scale.x) * 0.18;
      g.scale.setScalar(s);
    });

    // Trail (frozen while paused)
    if (!paused) {
      trailPositions.push(opPos.clone());
      if (trailPositions.length > TRAIL_LEN) trailPositions.shift();
    }
    const posBuf = orionTrail.geometry.attributes.position;
    const clrBuf = orionTrail.geometry.attributes.color;
    const len = trailPositions.length;
    for (let i = 0; i < len; i++) {
      const p = trailPositions[i], frac = i / len;
      posBuf.setXYZ(i, p.x, p.y, p.z);
      clrBuf.setXYZ(i, frac * 0.05, frac * 0.9, frac * 0.7);
    }
    posBuf.needsUpdate = true; clrBuf.needsUpdate = true;
    orionTrail.geometry.setDrawRange(0, len);

    // Camera: follow target, smooth zoom, idle auto-rotate
    const desired = cam.followId ? objectPosition(cam.followId) : DEFAULT_CENTER;
    cam.target.lerp(desired, 0.06);
    cam.radius += (cam.targetRadius - cam.radius) * 0.10;
    if (!cam.dragging && !paused && (Date.now() - cam.lastIdle) > 4000) cam.theta += 0.0008;

    camera.position.set(
      cam.target.x + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta),
      cam.target.y + cam.radius * Math.cos(cam.phi),
      cam.target.z + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta)
    );
    camera.lookAt(cam.target);

    updateHover();
    updateHint();

    renderer.render(scene, camera);
    updateTelemetryDisplay();
  }

  function updateHint() {
    if (!hintEl) return;
    if (paused) {
      hintEl.textContent = 'PAUSED · scene frozen — hover any object freely · drag & zoom still work';
    } else if (cam.followId) {
      const name = { earth: 'EARTH', moon: 'MOON', orion: 'ORION', starship: 'STARSHIP HLS' }[cam.followId];
      hintEl.textContent = `following ${name} · click empty space to release`;
    } else if (cam.radius < NEAR_THRESH) {
      hintEl.textContent = 'hover a component for part detail · scroll out to zoom back';
    } else {
      hintEl.textContent = 'drag to rotate · scroll to zoom · click a body to follow';
    }
  }

  function updateTelemetryDisplay() {
    const dm = document.getElementById('tl-dist-moon');
    const de = document.getElementById('tl-dist-earth');
    const vl = document.getElementById('tl-vel');
    const ph = document.getElementById('tl-phase');
    if (dm && state.orionDistMoon !== null) {
      dm.textContent = (state.orionDistMoon  / 1000).toFixed(0) + ' Mm';
      de.textContent = (state.orionDistEarth / 1000).toFixed(0) + ' Mm';
      vl.textContent = state.orionVelocity.toFixed(2) + ' km/s';
    }
    if (ph) ph.textContent = state.missionPhase;
  }

  function resize() {
    const panel  = document.getElementById('panel-orbital');
    const canvas = document.getElementById('orbital-canvas');
    if (!panel || !canvas || !renderer) return;
    const legendH = 28, telemH = 48, headerH = 37;
    const w = panel.clientWidth;
    const h = Math.max(panel.clientHeight - legendH - telemH - headerH, 120);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function updateFromHorizons(data) {
    Object.assign(state, data);
    if (data.orionDistEarth && data.orionDistMoon) {
      const total = data.orionDistEarth + data.orionDistMoon;
      state.transitProgress = Math.max(0.05, Math.min(0.95, data.orionDistEarth / total));
    }
    document.getElementById('orion-state').textContent =
      `Horizons · ${new Date().toISOString().substring(11, 19)} UTC`;
  }

  return { init, updateFromHorizons, resize };
})();
