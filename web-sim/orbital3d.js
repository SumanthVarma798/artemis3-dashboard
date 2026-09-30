// Three.js orbital stage. Two schematic scenes, both labeled "not to scale" in the UI:
//   a3  Artemis III: Orion docks with a Blue Origin test vehicle and a Starship test article in
//       a ~430 km, 33 degree Earth orbit (NET June 2027). Plan source: NASA via Wikipedia, checked 2026-09-30.
//   a2  Artemis II replay: the crewed lunar flyby of April 1-11, 2026 on its free-return path.
//
// Planet textures are self-hosted Solar System Scope maps (CC BY 4.0).
const Orbital3D = (() => {
  let renderer, scene, camera, animFrame, skybox, leoGroup, leoRing, moonRing;
  let earthMesh, earthAtmo, earthLights, earthClouds, moonMesh;
  let orionMesh, starshipMesh, blueMesh;
  let replayCurve, replayLine, orionTrail;
  let tooltipEl, hintEl, captionEl;
  let mode = 'a3';

  const TEX    = 'assets/textures/';
  const loader = new THREE.TextureLoader();
  function texColor(url) { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function texData(url)  { return loader.load(url); }

  const EARTH_R   = 0.55;
  const MOON_R    = 0.20;
  const MOON_DIST = 5.5;           // scene units; 1 unit is roughly 69,900 km Earth-Moon distance
  const LEO_R     = EARTH_R * 1.5; // exaggerated so vehicles are visible (real: 1.07 Earth radii)
  const LEO_INCL  = THREE.MathUtils.degToRad(33);
  const TRAIL_LEN = 160;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = { moonKm: null, moonSource: null };

  // ── Camera (spherical orbit around a target) ───────────────────────────────
  const PRESETS = {
    a3: { center: new THREE.Vector3(0, 0, 0),       theta: 0.7, phi: 1.18, radius: 3.7,  near: 2.3 },
    a2: { center: new THREE.Vector3(3.0, 0, 0), theta: Math.PI / 2, phi: 0.78, radius: 9.6, near: 4.6 }, // above the orbital plane so the loop reads clearly
  };
  const cam = {
    target: PRESETS.a3.center.clone(),
    theta: PRESETS.a3.theta, phi: PRESETS.a3.phi,
    radius: PRESETS.a3.radius, targetRadius: PRESETS.a3.radius,
    dragging: false, lastIdle: 0, followId: null,
  };

  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2(-2, -2);
  let pickables   = [];
  let hoveredRoot = null;

  let paused = false, simClock = 0, lastFrame = performance.now();

  // ── Tooltip copy (zoom-aware, per mode) ────────────────────────────────────
  const INFO = {
    earth: () => mode === 'a3'
      ? { title: 'Earth orbit', tag: 'Where Artemis III stays', accent: '#7fb0e8', lines: [
          'About 430 km up, inclined 33°',
          'Three launches in one mission: Blue Origin, SLS and Starship',
          'Close to Earth on purpose: if a docking goes wrong, the crew can come home fast' ]}
      : { title: 'Earth', tag: 'Departure and return', accent: '#7fb0e8', lines: [
          'Launched from Kennedy LC-39B on Apr 1, 2026',
          'Splashed down off San Diego after 9 days',
          'Farthest from here: 406,771 km' ]},
    moon: () => ({ title: 'The Moon', tag: 'Flyby target', accent: '#cdbf9f', lines: [
      'Orion passed 6,545 km above the far side',
      'The crew saw Earthset from behind the Moon',
      'No landing on this mission. That comes on Artemis IV, planned for 2028' ]}),
    orion: () => ({ title: 'Orion', tag: 'Crew vehicle', accent: '#e8895a', lines: [
      mode === 'a3' ? 'Carries four astronauts on Artemis III' : 'Named Integrity by the Artemis II crew',
      'Lockheed Martin capsule, ESA and Airbus service module',
      'Zoom in for parts' ]}),
    'orion-cm': () => ({ title: 'Crew module', tag: 'The capsule', accent: '#eef2f6', lines: [
      'Pressurized cabin, 5.0 m wide',
      mode === 'a3' ? 'Flies with an upgraded heat shield' : 'Heat shield reached about 2,760 °C on reentry',
      'The only piece that comes home' ]}),
    'orion-sm': () => ({ title: 'European Service Module', tag: 'Propulsion and power', accent: '#aab4bd', lines: [
      'Built by Airbus for ESA',
      'Air, water, power and the main engine',
      'Jettisoned before reentry' ]}),
    'orion-solar': () => ({ title: 'Solar array wing', tag: 'Power', accent: '#7f95ee', lines: [
      'Four wings, about 11 kW in total', 'Each one rotates to track the Sun' ]}),
    starship: () => ({ title: 'Starship test article', tag: 'SpaceX', accent: '#ff9d3c', lines: [
      'A Starship V3 vehicle with a docking mechanism',
      'No crew cabin: the astronauts stay in Orion',
      'The landing version is about 52 m tall' ]}),
    'hls-body': () => ({ title: 'Stainless hull', tag: 'Structure and tanks', accent: '#cfd6dc', lines: [
      '300-series stainless steel', 'Liquid methane and liquid oxygen tanks' ]}),
    'hls-thruster': () => ({ title: 'Landing thrusters', tag: 'Soft landing', accent: '#ffce6b', lines: ['Not flown on this test article'] }),
    'hls-legs':     () => ({ title: 'Landing legs', tag: 'Touchdown', accent: '#9aa4ad', lines: ['Not flown on this test article'] }),
    'hls-solar':    () => ({ title: 'Solar panels', tag: 'Power', accent: '#7f95ee', lines: ['Not flown on this test article'] }),
    blue: () => ({ title: 'Blue Origin test vehicle', tag: 'Launches first', accent: '#8fb6dc', lines: [
      'A test version of the Blue Moon Mark 2 lander',
      'Crew module with working life support',
      'Stays in orbit up to 90 days' ]}),
    'blue-body': () => ({ title: 'Crew module', tag: 'Life support on', accent: '#dfe6ee', lines: [
      'Same cabin as the Blue Moon Mark 2 lander',
      'The Artemis III crew enters it and tests the AxEMU suit interface' ]}),
    'blue-dock': () => ({ title: 'Docking port', tag: 'Orion connects here', accent: '#9fb3c6', lines: [
      'Orion flies the joined stack for about 2 days' ]}),
    'blue-engine': () => ({ title: 'Propulsion', tag: 'Test version', accent: '#7c8794', lines: [
      'Reported to use storable propellants on this test version',
      'The flight lander burns hydrogen and oxygen' ]}),
  };

  // ── Procedural helpers ─────────────────────────────────────────────────────
  function makeGlowSprite(color, size = 128) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const r = (color >> 16) & 0xff, gr = (color >> 8) & 0xff, b = color & 0xff;
    g.addColorStop(0, `rgba(${r},${gr},${b},0.9)`);
    g.addColorStop(0.3, `rgba(${r},${gr},${b},0.4)`);
    g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  function makeSteelTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 4;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    [[0, '#6a7178'], [0.18, '#c4ccd2'], [0.3, '#ffffff'], [0.42, '#aeb6bc'], [0.62, '#cdd4da'], [0.8, '#7c838a'], [1, '#6a7178']]
      .forEach(([o, col]) => g.addColorStop(o, col));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 4);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; return tex;
  }

  function makeSolarTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 48;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#16236e'; ctx.fillRect(0, 0, 128, 48);
    ctx.fillStyle = '#243aa6';
    for (let x = 2; x < 128; x += 16) ctx.fillRect(x, 2, 12, 44);
    ctx.strokeStyle = '#b8902f'; ctx.lineWidth = 1;
    for (let x = 0; x <= 128; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 48); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(128, 24); ctx.stroke();
    return new THREE.CanvasTexture(c);
  }

  const smooth = t => t * t * (3 - 2 * t);
  const clamp01 = t => Math.max(0, Math.min(1, t));
  // Piecewise smooth interpolation over [[time, value], ...]
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
        return v0 + (v1 - v0) * smooth(clamp01((t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  }

  // ── Init ───────────────────────────────────────────────────────────────────
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
    buildLeo();
    buildOrion();
    buildStarship();
    buildBlue();
    buildReplay();

    buildOverlay();
    setupInteraction();
    setupModeTabs();
    applyMode('a3', true);

    const view = document.getElementById('stage-view');
    if (window.ResizeObserver && view) new ResizeObserver(resize).observe(view);
    window.addEventListener('resize', resize);
    resize();
    animate();
  }

  function buildSkybox() {
    const mat = new THREE.MeshBasicMaterial({
      map: texColor(TEX + 'stars_milky_way.jpg'), side: THREE.BackSide, color: 0xc2c9da, depthWrite: false,
    });
    skybox = new THREE.Mesh(new THREE.SphereGeometry(800, 60, 40), mat);
    scene.add(skybox);
  }

  function buildStarfield() {
    const geo = new THREE.BufferGeometry();
    const verts = [], colors = [];
    const palette = [[1, 1, 1], [0.85, 0.92, 1], [1, 0.96, 0.85], [0.8, 0.9, 1]];
    for (let i = 0; i < 900; i++) {
      const r = 120 + Math.random() * 60, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      verts.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
      const c = palette[Math.floor(Math.random() * palette.length)], b = 0.5 + Math.random() * 0.5;
      colors.push(c[0] * b, c[1] * b, c[2] * b);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true })));
  }

  function buildLights() {
    scene.add(new THREE.AmbientLight(0x1a2233, 2.2));
    const sun = new THREE.DirectionalLight(0xfff6e6, 3.6);
    sun.position.set(25, 8, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x2a3f66, 0.45);
    fill.position.set(-10, -4, -8);
    scene.add(fill);
  }

  function buildEarth() {
    earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 96, 96),
      new THREE.MeshPhongMaterial({ map: texColor(TEX + 'earth_day.jpg'), specular: 0x2a3a4a, shininess: 14 })
    );
    earthMesh.userData = { root: 'earth', part: 'earth' };
    scene.add(earthMesh);

    earthLights = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.001, 96, 96),
      new THREE.MeshBasicMaterial({ map: texColor(TEX + 'earth_night.jpg'), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false })
    );
    earthMesh.add(earthLights);

    earthClouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.02, 96, 96),
      new THREE.MeshPhongMaterial({ alphaMap: texColor(TEX + 'earth_clouds.jpg'), color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, shininess: 5 })
    );
    scene.add(earthClouds);

    earthAtmo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.08, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0x2255aa, transparent: true, opacity: 0.15, depthWrite: false })
    );
    scene.add(earthAtmo);

    const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowSprite(0x3399ff, 256), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    rim.scale.set(EARTH_R * 3.2, EARTH_R * 3.2, 1);
    earthMesh.add(rim);
  }

  function buildMoon() {
    moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R, 64, 64),
      new THREE.MeshPhongMaterial({ map: texColor(TEX + 'moon.jpg'), bumpMap: texData(TEX + 'moon.jpg'), bumpScale: 0.005, emissive: 0x0a0907, shininess: 3 })
    );
    moonMesh.userData = { root: 'moon', part: 'moon' };
    moonMesh.position.set(MOON_DIST, 0, 0);
    scene.add(moonMesh);

    const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowSprite(0xaa9977, 128), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
    rim.scale.set(MOON_R * 3.0, MOON_R * 3.0, 1);
    moonMesh.add(rim);

    moonRing = new THREE.Mesh(
      new THREE.TorusGeometry(MOON_DIST, 0.004, 6, 220).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3a4a66, transparent: true, opacity: 0.6 })
    );
    scene.add(moonRing);
  }

  // Low Earth orbit: a tilted ring. Vehicles are children of leoGroup, positioned in its local XZ plane.
  function buildLeo() {
    leoGroup = new THREE.Group();
    leoGroup.rotation.x = LEO_INCL;
    leoRing = new THREE.Mesh(
      new THREE.TorusGeometry(LEO_R, 0.005, 8, 200).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe8895a, transparent: true, opacity: 0.55 })
    );
    leoGroup.add(leoRing);
    scene.add(leoGroup);
  }

  // ── Vehicles ───────────────────────────────────────────────────────────────
  const tag = (m, root, part) => { m.userData = { root, part }; return m; };

  function buildOrion() {
    const g = new THREE.Group();
    g.userData = { root: 'orion', popable: true, base: 1 };
    const mark = (m, part) => tag(m, 'orion', part);

    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.10, 16), new THREE.MeshPhongMaterial({ color: 0x9aa0a6, specular: 0x555555, shininess: 40, emissive: 0x0a0c0f }));
    g.add(mark(sm, 'orion-sm'));
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.04, 12), new THREE.MeshPhongMaterial({ color: 0x3a3a3a, shininess: 10 }));
    noz.position.y = -0.07; g.add(mark(noz, 'orion-sm'));
    const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.014, 16), new THREE.MeshPhongMaterial({ color: 0x6b4a26, specular: 0x221100, shininess: 8, emissive: 0x140a04 }));
    hs.position.y = 0.058; g.add(mark(hs, 'orion-cm'));
    const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.05, 0.075, 16), new THREE.MeshPhongMaterial({ color: 0xe6eaee, specular: 0x99a0a8, shininess: 70, emissive: 0x0c0e10 }));
    cm.position.y = 0.103; g.add(mark(cm, 'orion-cm'));
    const dock = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.02, 12), new THREE.MeshPhongMaterial({ color: 0x888f96, shininess: 30 }));
    dock.position.y = 0.15; g.add(mark(dock, 'orion-cm'));

    const solarMat = new THREE.MeshPhongMaterial({ map: makeSolarTexture(), color: 0x4060ff, specular: 0x222244, shininess: 80, emissive: 0x060818, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + Math.PI / 4;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.004, 0.05), solarMat);
      wing.position.set(Math.cos(ang) * 0.13, 0, Math.sin(ang) * 0.13);
      wing.rotation.y = -ang;
      g.add(mark(wing, 'orion-solar'));
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowSprite(0xe8895a), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(0.42, 0.42, 1);
    g.add(glow);

    orionMesh = g;
    scene.add(orionMesh);
  }

  // Starship V3 test article. Landing legs, thruster ring and solar panels belong to the landing version
  // and are hidden (kept in the model so a future landing scene can show them).
  function buildStarship() {
    const g = new THREE.Group();
    g.userData = { root: 'starship', popable: true, base: 1 };
    const mark = (m, part) => tag(m, 'starship', part);
    const steel = new THREE.MeshPhongMaterial({ map: makeSteelTexture(), color: 0xc6ced4, specular: 0xffffff, shininess: 95, emissive: 0x05080a });

    g.add(mark(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.052, 0.34, 24), steel), 'hls-body'));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 24), steel);
    nose.position.y = 0.225; g.add(mark(nose, 'hls-body'));
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.04, 24), new THREE.MeshPhongMaterial({ color: 0x3c3c40, shininess: 20 }));
    skirt.position.y = -0.18; g.add(mark(skirt, 'hls-body'));

    const hidden = [];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.012, 8, 24).rotateX(Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x555a60, specular: 0x888888, shininess: 40, emissive: 0x100800 }));
    ring.position.y = 0.05; g.add(mark(ring, 'hls-thruster')); hidden.push(ring);

    const legMat = new THREE.MeshPhongMaterial({ color: 0x8a9098, shininess: 30 });
    for (let i = 0; i < 6; i++) {
      const ang = i * Math.PI / 3;
      const top = new THREE.Vector3(Math.cos(ang) * 0.045, -0.10, Math.sin(ang) * 0.045);
      const bot = new THREE.Vector3(Math.cos(ang) * 0.12, -0.21, Math.sin(ang) * 0.12);
      const dir = bot.clone().sub(top), len = dir.length();
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.007, len, 0.007), legMat);
      leg.position.copy(top).add(bot).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      g.add(mark(leg, 'hls-legs')); hidden.push(leg);
    }
    const solarMat = new THREE.MeshPhongMaterial({ map: makeSolarTexture(), color: 0x4060ff, shininess: 70, emissive: 0x060818, side: THREE.DoubleSide });
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.06), solarMat);
      p.position.set(Math.cos(i * Math.PI) * 0.062, 0.12, Math.sin(i * Math.PI) * 0.062);
      g.add(mark(p, 'hls-solar')); hidden.push(p);
    }
    hidden.forEach(m => { m.visible = false; });

    // Docking collar on the nose, so the test article reads as a docking target
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.03, 16), new THREE.MeshPhongMaterial({ color: 0x9aa2aa, shininess: 40 }));
    collar.position.y = 0.3; g.add(mark(collar, 'hls-body'));

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowSprite(0xff8800), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(0.5, 0.5, 1);
    g.add(glow);

    starshipMesh = g;
    scene.add(starshipMesh);
  }

  // Blue Origin lander test vehicle (Blue Moon Mark 1.5 class): white crew module over a storable-propellant stage.
  function buildBlue() {
    const g = new THREE.Group();
    g.userData = { root: 'blue', popable: true, base: 1 };
    const mark = (m, part) => tag(m, 'blue', part);
    const hull = new THREE.MeshPhongMaterial({ color: 0xdfe6ee, specular: 0x8a94a0, shininess: 55, emissive: 0x06080a });
    const band = new THREE.MeshPhongMaterial({ color: 0x6b8fb3, specular: 0x334455, shininess: 40 });

    const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 28), band);
    stage.position.y = -0.06; g.add(mark(stage, 'blue-engine'));
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 16, 1, true), new THREE.MeshPhongMaterial({ color: 0x343a42, side: THREE.DoubleSide, shininess: 20 }));
    bell.position.y = -0.145; bell.rotation.x = Math.PI; g.add(mark(bell, 'blue-engine'));
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.14, 28), hull);
    cab.position.y = 0.07; g.add(mark(cab, 'blue-body'));
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.06, 28), hull);
    cone.position.y = 0.17; g.add(mark(cone, 'blue-body'));
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.025, 16), new THREE.MeshPhongMaterial({ color: 0x8b98a6, shininess: 35 }));
    port.position.y = 0.2; g.add(mark(port, 'blue-dock'));
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.0725, 0.004, 8, 40).rotateX(Math.PI / 2), band);
    stripe.position.y = 0.03; g.add(mark(stripe, 'blue-body'));

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowSprite(0x6ea8ff), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(0.46, 0.46, 1);
    g.add(glow);

    blueMesh = g;
    leoGroup.add(blueMesh);
  }

  // ── Artemis II replay: free-return path, built once ───────────────────────
  // Schematic. The Moon is held still so the loop closes; real geometry is in a rotating frame.
  let replayMaxNorm = 1, outNorms = [];
  function buildReplay() {
    const pts = [
      [0.66, 0.00, 0.10], [1.35, 0.08, 0.95], [2.7, 0.12, 1.75], [4.3, 0.10, 1.55],
      [5.35, 0.05, 0.95], [6.15, 0.00, 0.0],
      [5.35, -0.05, -0.95], [4.3, -0.10, -1.55], [2.7, -0.12, -1.75], [1.35, -0.08, -0.95], [0.66, 0.0, -0.10],
    ].map(p => new THREE.Vector3(...p));
    replayCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);

    const samples = replayCurve.getSpacedPoints(400);
    replayMaxNorm = Math.max(...samples.map(p => p.length()));
    // Distance from Earth along the outbound half, used to place Orion where the mission clock says it is
    outNorms = Array.from({ length: 201 }, (_, i) => replayCurve.getPointAt(i / 400).length() / replayMaxNorm);
    replayLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(samples),
      new THREE.LineDashedMaterial({ color: 0xe8895a, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.75 })
    );
    replayLine.computeLineDistances();
    scene.add(replayLine);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    geo.setDrawRange(0, 0);
    orionTrail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
    scene.add(orionTrail);
  }

  // ── Mode handling ──────────────────────────────────────────────────────────
  const LEGEND = {
    a3: [['#7fb0e8', 'Earth'], ['#e8895a', 'Orion'], ['#8fb6dc', 'Blue Origin test vehicle'], ['#cfd6dc', 'Starship test article']],
    a2: [['#7fb0e8', 'Earth'], ['#cdbf9f', 'Moon'], ['#e8895a', 'Orion and flight path']],
  };
  const TELEM_LABELS = {
    a3: ['Altitude', 'Inclination', 'Docked to', 'Sequence'],
    a2: ['Distance from Earth', 'Mission elapsed', 'Record distance', 'Phase'],
  };

  function setupModeTabs() {
    document.querySelectorAll('#mode-tabs .mode-tab').forEach(btn => {
      btn.addEventListener('click', () => { if (btn.dataset.mode !== mode) applyMode(btn.dataset.mode); });
    });
  }

  function applyMode(next, immediate = false) {
    mode = next;
    const a3 = mode === 'a3';

    document.querySelectorAll('#mode-tabs .mode-tab').forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
    });

    // Visibility
    leoGroup.visible = a3;
    starshipMesh.visible = a3; blueMesh.visible = a3;
    moonMesh.visible = !a3; moonRing.visible = !a3;
    replayLine.visible = !a3; orionTrail.visible = !a3;
    (a3 ? leoGroup : scene).add(orionMesh);
    trail.length = 0;
    if (a3) { orionMesh.userData.base = 0.55; starshipMesh.userData.base = 0.55; blueMesh.userData.base = 0.55; }
    else    { orionMesh.userData.base = 1.0; }
    pickables = a3 ? [earthMesh, orionMesh, starshipMesh, blueMesh] : [earthMesh, moonMesh, orionMesh];

    // Camera
    const p = PRESETS[mode];
    cam.followId = null; cam.targetRadius = p.radius; cam.theta = p.theta; cam.phi = p.phi;
    if (immediate) { cam.radius = p.radius; cam.target.copy(p.center); }
    simClock = 0; lastStep = -1; telemTick = 5; // refresh the readouts on the next frame
    if (captionEl) { captionEl.dataset.r = ''; captionEl.innerHTML = ''; }

    // UI
    const leg = document.getElementById('orbital-legend');
    if (leg) leg.innerHTML = LEGEND[mode].map(([c, t]) => `<span class="legend-item"><span class="leg-dot" style="background:${c}"></span>${t}</span>`).join('');
    TELEM_LABELS[mode].forEach((t, i) => { const el = document.getElementById('tl-l' + (i + 1)); if (el) el.textContent = t; });
    const st = document.getElementById('orion-state');
    if (st) st.textContent = a3 ? 'Schematic, not to scale' : 'Schematic replay, Apr 1 to 11, 2026';
    if (!a3) announceStep(null);

    if (!immediate) {
      const cv = renderer.domElement;
      if (cv.animate && !reduceMotion.matches) cv.animate([{ opacity: 0.15, transform: 'scale(1.015)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(0.16,1,0.3,1)' });
    }
  }

  // ── Artemis III docking sequence ───────────────────────────────────────────
  const SEQ = 48; // seconds per loop
  const W = 2 * Math.PI / 40; // shared angular rate (rad/s), visual only
  const DOCK_BLUE = 0.23, DOCK_SS = 0.27, SS_AT = -1.35;

  const SEQ_STEPS = [
    [0,  1, 'A Blue Origin lander test vehicle launches first and waits in orbit.'],
    [6,  2, 'SLS and Orion launch with four crew and settle into a 430 km orbit.'],
    [9,  3, 'Orion closes in on the Blue Origin vehicle.'],
    [13, 4, 'Docked for about 2 days. The crew tests its systems and the AxEMU spacesuit interface.'],
    [22, 5, 'Starship V3 launches. Its test article has a docking port but no crew cabin.'],
    [26, 6, 'Orion undocks and flies to Starship, then docks for about 1 day. The crew stays in Orion.'],
    [43, 7, 'Orion leaves orbit and re-enters on an upgraded heat shield.'],
    [46, 8, 'Splashdown in the Pacific off San Diego, about two weeks after launch.'],
  ];

  let lastStep = -1;
  let dockedTo = 'Nobody yet';
  let stepNow = 1;

  function announceStep(step) {
    window.dispatchEvent(new CustomEvent('stage:step', { detail: { step } }));
  }

  function setCaption(step, text) {
    if (!captionEl) return;
    captionEl.innerHTML = step ? `<span class="sc-step">Step ${step} of 8</span>${text}` : (text || '');
  }

  function updateLeo(dt) {
    const t = (simClock / 1000) % SEQ;
    const th = (simClock / 1000) * W;

    const place = (mesh, off, rOff = 0, scale = 1) => {
      const a = th + off, r = LEO_R + rOff;
      mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const tan = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      mesh.userData.appear = scale;
    };

    // Blue Origin vehicle is the reference; it fades in at the start
    place(blueMesh, 0, 0, smooth(clamp01(t / 1.2)) * (1 - smooth(clamp01((t - 47.2) / 0.8))));

    // Orion: arrives ahead of Blue, docks, undocks, transfers over the top, docks with Starship, deorbits
    const orionOff = track([[0, 1.5], [6, 1.5], [9, 1.05], [13, 0.5], [18, DOCK_BLUE], [25.5, DOCK_BLUE], [28, 0.75],
      [31, 0.2], [33.5, -0.6], [36.5, SS_AT + DOCK_SS], [42.5, SS_AT + DOCK_SS], [46, SS_AT + DOCK_SS + 0.5]], t);
    const orionR = track([[0, 0], [25.5, 0], [27.5, 0.17], [34, 0.17], [36.5, 0], [43, 0], [47, -LEO_R + EARTH_R * 1.02]], t);
    const orionAppear = smooth(clamp01((t - 6) / 1.4)) * (1 - smooth(clamp01((t - 45.5) / 2)));
    place(orionMesh, orionOff, orionR, orionAppear);

    // Starship test article waits behind Blue; appears at step 5
    const ssAppear = smooth(clamp01((t - 22) / 1.6)) * (1 - smooth(clamp01((t - 47.2) / 0.8)));
    place(starshipMesh, SS_AT, 0, ssAppear);

    // Status derived from the geometry
    const near = (a, b) => Math.abs(a - b) < 0.012;
    dockedTo = near(orionOff, DOCK_BLUE) && orionAppear > 0.9 ? 'Blue Origin'
             : near(orionOff, SS_AT + DOCK_SS) && orionAppear > 0.9 ? 'Starship' : 'Nothing';

    let step = 1, text = SEQ_STEPS[0][2];
    for (const [ts, n, tx] of SEQ_STEPS) if (t >= ts) { step = n; text = tx; }
    stepNow = step;
    if (step !== lastStep) { lastStep = step; setCaption(step, text); announceStep(step); }
  }

  // ── Artemis II replay ──────────────────────────────────────────────────────
  const REPLAY = 44; // seconds per loop, about 9.06 mission days
  const MISSION_DAYS = 9 + 1.5 / 24; // Apr 1 22:35 UTC to Apr 11 00:07 UTC
  const FLYBY_AT = (5 + 0.4 / 24) / MISSION_DAYS;
  const trail = [];
  const REPLAY_STEPS = [
    [0.00, 'Launch from Kennedy on Apr 1. Orion spends its first day in a high Earth orbit checking out life support.'],
    [0.11, 'Flight day 2: a 5 minute 49 second burn sends Orion toward the Moon. It is the only main engine burn of the mission.'],
    [0.20, 'Coasting outbound. The crew photographs the full Earth, a first since Apollo.'],
    [0.51, 'Flight day 6: Orion swings behind the Moon, 6,545 km above the far side, and loses contact for about 40 minutes.'],
    [0.60, 'Free return: the Moon\'s gravity bends the path back to Earth with no engine burn needed.'],
    [0.96, 'Splashdown in the Pacific off San Diego on Apr 10, local time.'],
  ];

  // Approximate distance from Earth against mission day, anchored on the published numbers: a high Earth orbit
  // (apogee about 71,000 km) for the first day, closest approach to the Moon at 5 d 0 h 25 m where Orion was
  // 406,771 km out, then a free-return coast that speeds up toward Earth. Shape between anchors is schematic.
  const MAX_KM = 406771;
  function distKmAt(day) {
    if (day < 1.1) return 71000 * smooth(day / 1.1);
    const fd = 5 + 0.4 / 24;
    if (day < fd) return 71000 + (MAX_KM - 71000) * (1 - Math.pow(1 - (day - 1.1) / (fd - 1.1), 1.7));
    return MAX_KM * (1 - Math.pow((day - fd) / (MISSION_DAYS - fd), 1.8));
  }
  // Curve parameter whose distance from Earth matches f (0..1) on the outbound half
  function outU(f) {
    let i = outNorms.findIndex(n => n >= f);
    if (i <= 0) return 0;
    const a = outNorms[i - 1], b = outNorms[i], t = b > a ? (f - a) / (b - a) : 0;
    return ((i - 1) + t) / 400;
  }

  function updateReplay() {
    const loop = ((simClock / 1000) % REPLAY) / REPLAY;
    const day = loop * MISSION_DAYS, distKm = distKmAt(day);
    const uo = outU(Math.min(1, distKm / MAX_KM));
    const u = day < FLYBY_AT * MISSION_DAYS ? uo : 1 - uo;
    const pos = replayCurve.getPointAt(u);
    const pos2 = replayCurve.getPointAt(Math.min(0.999, u + 0.004));
    orionMesh.position.copy(pos);
    orionMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos2.clone().sub(pos).normalize());
    orionMesh.userData.appear = smooth(clamp01(loop / 0.02)) * (1 - smooth(clamp01((loop - 0.985) / 0.015)));

    if (!paused) { trail.push(pos.clone()); if (trail.length > TRAIL_LEN) trail.shift(); }
    const posBuf = orionTrail.geometry.attributes.position, clrBuf = orionTrail.geometry.attributes.color;
    trail.forEach((p, i) => { const f = i / trail.length; posBuf.setXYZ(i, p.x, p.y, p.z); clrBuf.setXYZ(i, 0.3 + f * 0.65, 0.2 + f * 0.35, 0.1 + f * 0.2); });
    posBuf.needsUpdate = true; clrBuf.needsUpdate = true; orionTrail.geometry.setDrawRange(0, trail.length);

    let text = REPLAY_STEPS[0][1];
    for (const [ts, tx] of REPLAY_STEPS) if (loop >= ts) text = tx;
    if (captionEl && captionEl.dataset.r !== text) { captionEl.dataset.r = text; setCaption(null, text); }

    return { loop, distKm, day };
  }

  // ── Overlay + interaction ──────────────────────────────────────────────────
  function buildOverlay() {
    const view = document.getElementById('stage-view');
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'orbital-tooltip'; tooltipEl.className = 'orbital-tooltip hidden'; tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.style.left = tooltipEl.style.top = '-9999px'; // parked until the first pointer move
    document.body.appendChild(tooltipEl);

    hintEl = document.createElement('div');
    hintEl.id = 'orbital-hint'; hintEl.className = 'orbital-hint';
    view.appendChild(hintEl);
    captionEl = document.getElementById('stage-caption');

    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'orbital-pause'; pauseBtn.className = 'orbital-pause'; pauseBtn.type = 'button';
    pauseBtn.innerHTML = '<i class="ph ph-pause" aria-hidden="true"></i><span class="op-label">Pause</span>';
    pauseBtn.title = 'Freeze the scene so you can hover objects';
    pauseBtn.onclick = togglePause;
    view.appendChild(pauseBtn);
  }

  function togglePause() {
    paused = !paused;
    const btn = document.getElementById('orbital-pause');
    if (!btn) return;
    btn.classList.toggle('paused', paused);
    btn.querySelector('.ph').className = 'ph ' + (paused ? 'ph-play' : 'ph-pause');
    btn.querySelector('.op-label').textContent = paused ? 'Play' : 'Pause';
  }

  function setupInteraction() {
    const dom = renderer.domElement;
    let lastX = 0, lastY = 0, moved = 0;

    dom.addEventListener('pointerdown', e => {
      cam.dragging = true; cam.lastIdle = Date.now(); moved = 0;
      lastX = e.clientX; lastY = e.clientY; dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', e => {
      const rect = dom.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      let lx = e.clientX + 16, ly = e.clientY + 16;
      if (lx + 270 > window.innerWidth)  lx = e.clientX - 286;
      if (ly + 170 > window.innerHeight) ly = e.clientY - 178;
      tooltipEl.style.left = lx + 'px'; tooltipEl.style.top = ly + 'px';
      if (cam.dragging) {
        moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
        cam.theta -= (e.clientX - lastX) * 0.006;
        cam.phi = Math.max(0.18, Math.min(Math.PI - 0.18, cam.phi - (e.clientY - lastY) * 0.006));
        lastX = e.clientX; lastY = e.clientY; cam.lastIdle = Date.now();
      }
    });
    const endDrag = e => { cam.dragging = false; try { dom.releasePointerCapture(e.pointerId); } catch {} };
    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointercancel', endDrag);
    dom.addEventListener('pointerleave', () => pointer.set(-2, -2));

    dom.addEventListener('wheel', e => {
      e.preventDefault();
      cam.targetRadius = Math.max(1.2, Math.min(30, cam.targetRadius * (1 + Math.sign(e.deltaY) * 0.08)));
      cam.lastIdle = Date.now();
    }, { passive: false });

    dom.addEventListener('click', () => {
      if (moved > 6) return; // a drag, not a click
      const p = PRESETS[mode];
      if (hoveredRoot) { cam.followId = hoveredRoot; cam.targetRadius = hoveredRoot === 'earth' ? p.radius * 0.8 : hoveredRoot === 'moon' ? 3.0 : (mode === 'a3' ? 1.3 : 2.4); }
      else { cam.followId = null; cam.targetRadius = p.radius; }
      cam.lastIdle = Date.now();
    });
    dom.style.cursor = 'grab';
  }

  function objectPosition(id) {
    const m = { earth: earthMesh, moon: moonMesh, orion: orionMesh, starship: starshipMesh, blue: blueMesh }[id];
    if (!m) return PRESETS[mode].center;
    return m.parent === scene ? m.position : m.getWorldPosition(new THREE.Vector3());
  }

  function deepVisible(o) { for (let n = o; n; n = n.parent) if (n.visible === false) return false; return true; }

  function updateHover() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables.filter(deepVisible), true);
    let root = null, part = null;
    for (const h of hits) {
      if (h.object.userData?.root && deepVisible(h.object) && (h.object.userData.part === undefined || h.object.visible)) {
        root = h.object.userData.root; part = h.object.userData.part || root; break;
      }
    }
    hoveredRoot = root;
    renderer.domElement.style.cursor = root ? 'pointer' : (cam.dragging ? 'grabbing' : 'grab');
    if (!root) { tooltipEl.classList.add('hidden'); return; }

    const near = cam.radius < PRESETS[mode].near;
    let key = root;
    if (near && part && INFO[part]) key = part;
    const info = (INFO[key] || INFO[root])();
    tooltipEl.innerHTML =
      `<div class="ot-tag" style="color:${info.accent}">${info.tag}</div>` +
      `<div class="ot-title">${info.title}</div>` +
      info.lines.map(l => `<div class="ot-line">${l}</div>`).join('') +
      (near ? '' : '<div class="ot-hint">Scroll in for part detail</div>');
    tooltipEl.classList.remove('hidden');
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────
  function animate() {
    animFrame = requestAnimationFrame(animate);
    const real = performance.now(), dt = real - lastFrame;
    lastFrame = real;
    if (!paused) simClock += dt;

    if (!paused) {
      earthMesh.rotation.y += 0.0022;
      if (earthClouds) earthClouds.rotation.y += 0.003;
      earthAtmo.rotation.y -= 0.0008;
      moonMesh.rotation.y += 0.0008;
      skybox.rotation.y += 0.00002;
    }

    let replay = null;
    if (mode === 'a3') updateLeo(dt); else replay = updateReplay();

    // Hover pop + appear scale
    [orionMesh, starshipMesh, blueMesh].forEach(g => {
      if (!g.visible) return;
      const hov = hoveredRoot === g.userData.root ? 1.16 : 1;
      const want = g.userData.base * hov * (g.userData.appear ?? 1);
      const s = g.scale.x + (want - g.scale.x) * 0.2;
      g.scale.setScalar(Math.max(0.0001, s));
    });

    // Camera
    const follow = cam.followId ? objectPosition(cam.followId) : PRESETS[mode].center;
    cam.target.lerp(follow, 0.06);
    cam.radius += (cam.targetRadius - cam.radius) * 0.1;
    if (!cam.dragging && !paused && !reduceMotion.matches && Date.now() - cam.lastIdle > 4000) cam.theta += 0.0007;
    camera.position.set(
      cam.target.x + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta),
      cam.target.y + cam.radius * Math.cos(cam.phi),
      cam.target.z + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta)
    );
    camera.lookAt(cam.target);

    updateHover();
    updateHint();
    renderer.render(scene, camera);
    updateTelemetry(replay);
  }

  function updateHint() {
    if (!hintEl) return;
    let txt;
    if (paused) txt = 'Paused. Hover anything, drag and zoom still work.';
    else if (cam.followId) txt = `Following ${cam.followId === 'blue' ? 'the Blue Origin vehicle' : cam.followId}. Click empty space to release.`;
    else if (cam.radius < PRESETS[mode].near) txt = 'Hover a part for detail. Scroll out to zoom back.';
    else txt = 'Drag to rotate, scroll to zoom, click a body to follow.';
    if (hintEl.textContent !== txt) hintEl.textContent = txt;
  }

  let telemTick = 5; // first frame updates immediately
  function setVal(id, txt) { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; }
  function updateTelemetry(replay) {
    if (++telemTick % 6) return;
    if (mode === 'a3') {
      setVal('tl-v1', '~430 km'); setVal('tl-v2', '33°');
      setVal('tl-v3', dockedTo); setVal('tl-v4', `${stepNow} of 8`);
    } else if (replay) {
      setVal('tl-v1', Math.round(replay.distKm).toLocaleString('en-US') + ' km');
      const d = Math.floor(replay.day), h = Math.floor((replay.day - d) * 24);
      setVal('tl-v2', `${d}d ${String(h).padStart(2, '0')}h`);
      setVal('tl-v3', '406,771 km');
      const l = replay.loop;
      setVal('tl-v4', l < 0.11 ? 'Earth orbit' : l < 0.51 ? 'Outbound' : l < 0.6 ? 'Lunar flyby' : l < 0.96 ? 'Returning' : 'Splashdown');
    }
  }

  function resize() {
    const view = document.getElementById('stage-view');
    if (!view || !renderer) return;
    const w = Math.max(view.clientWidth, 2), h = Math.max(view.clientHeight, 2);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Live Moon distance comes from app.js (JPL Horizons for Pro users, a low-precision model otherwise)
  function setEphemeris(data) { Object.assign(state, data); }

  return { init, resize, setEphemeris, get mode() { return mode; } };
})();
