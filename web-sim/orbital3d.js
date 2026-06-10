// Three.js orbital visualization — Earth/Moon/Orion with enhanced graphics
const Orbital3D = (() => {
  let renderer, scene, camera, animFrame;
  let earthMesh, earthAtmo, moonMesh, orionMesh, starshipMesh;
  let orionTrail, trajectoryLine;
  let moonAngle   = 0.4;
  let cameraAngle = 0;

  const state = {
    orionDistMoon:   null,
    orionDistEarth:  null,
    orionVelocity:   null,
    missionPhase:    'TLI COMPLETE',
    lastUpdate:      null,
    transitProgress: 0.38,
  };

  const EARTH_R  = 0.55;
  const MOON_R   = 0.20;
  const ORBIT_R  = 5.5;
  const TRAIL_LEN = 120;
  const trailPositions = [];

  // ── Procedural canvas textures ──────────────────────────────────────────────

  function makeEarthTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');

    // Ocean
    ctx.fillStyle = '#0a2a5c';
    ctx.fillRect(0, 0, 512, 256);

    // Ocean variation
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 512; x += 4) {
        const n = Math.sin(x * 0.08) * Math.cos(y * 0.12) * 0.5 + 0.5;
        const a = n * 0.15;
        ctx.fillStyle = `rgba(20,80,160,${a})`;
        ctx.fillRect(x, y, 4, 1);
      }
    }

    // Continents (approximate shapes)
    ctx.fillStyle = '#2d5a27';
    // North America
    roundRect(ctx, 52, 40,  90, 80);
    // South America
    roundRect(ctx, 88, 130, 50, 80);
    // Europe
    roundRect(ctx, 220, 38, 40, 50);
    // Africa
    roundRect(ctx, 218, 88, 52, 100);
    // Asia
    roundRect(ctx, 260, 20, 130, 90);
    // Australia
    roundRect(ctx, 360, 150, 55, 40);
    // Antarctica
    ctx.fillStyle = '#ddeeff';
    ctx.fillRect(0, 220, 512, 36);

    // Ice caps
    ctx.fillStyle = '#ddeeff';
    ctx.fillRect(0, 0, 512, 14);

    // Cloud layer
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 60; i++) {
      const cx2 = Math.random() * 512, cy2 = Math.random() * 256;
      const rr = Math.random() * 30 + 10;
      ctx.beginPath(); ctx.ellipse(cx2, cy2, rr, rr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    return new THREE.CanvasTexture(c);
  }

  function roundRect(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
  }

  function makeMoonTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');

    // Base: dark grey
    ctx.fillStyle = '#888070';
    ctx.fillRect(0, 0, 512, 256);

    // Noise variation
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 512, y = Math.random() * 256;
      const s = Math.random() * 3;
      const v = Math.floor(Math.random() * 40) - 20;
      ctx.fillStyle = `rgba(${130+v},${120+v},${110+v},0.3)`;
      ctx.fillRect(x, y, s, s);
    }

    // Maria (dark basaltic plains)
    ctx.fillStyle = 'rgba(60,56,52,0.6)';
    ctx.beginPath(); ctx.ellipse(120, 90, 65, 45, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(290, 110, 50, 35, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(200, 60, 40, 25, 0.1, 0, Math.PI * 2); ctx.fill();

    // Craters
    const craters = [
      [80, 150, 22], [190, 180, 18], [350, 80, 25], [420, 160, 15],
      [160, 120, 12], [300, 200, 20], [60, 60, 14], [440, 100, 10],
      [250, 140, 8], [370, 200, 16],
    ];
    craters.forEach(([cx2, cy2, r]) => {
      // Shadow
      const g = ctx.createRadialGradient(cx2, cy2, r * 0.5, cx2, cy2, r);
      g.addColorStop(0, 'rgba(30,28,24,0.85)');
      g.addColorStop(0.7, 'rgba(50,46,40,0.5)');
      g.addColorStop(1, 'rgba(100,95,85,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2); ctx.fill();
      // Rim highlight
      ctx.strokeStyle = 'rgba(200,195,185,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx2 - r * 0.15, cy2 - r * 0.15, r, Math.PI, Math.PI * 1.6);
      ctx.stroke();
    });

    return new THREE.CanvasTexture(c);
  }

  function makeGlowSprite(color, size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    const r = (color >> 16) & 0xff, gr = (color >> 8) & 0xff, b = color & 0xff;
    g.addColorStop(0,   `rgba(${r},${gr},${b},0.9)`);
    g.addColorStop(0.3, `rgba(${r},${gr},${b},0.4)`);
    g.addColorStop(1,   `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  // ── Scene init ───────────────────────────────────────────────────────────────

  function init() {
    const canvas = document.getElementById('orbital-canvas');

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;

    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.01, 300);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, 0);

    buildStarfield();
    buildLights();
    buildEarth();
    buildMoon();
    buildOrbitRing();
    buildSpacecraft();
    buildTrail();
    buildTrajectoryArc();

    resize();
    window.addEventListener('resize', resize);
    animate();
  }

  function buildStarfield() {
    const geo    = new THREE.BufferGeometry();
    const verts  = [];
    const colors = [];
    const starColors = [
      [1.0, 1.0, 1.0], [0.85, 0.92, 1.0], [1.0, 0.96, 0.85],
      [0.95, 0.85, 1.0], [0.8, 0.9, 1.0],
    ];
    for (let i = 0; i < 2800; i++) {
      const r = 100 + Math.random() * 30;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      verts.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
      const c = starColors[Math.floor(Math.random() * starColors.length)];
      const bright = 0.4 + Math.random() * 0.6;
      colors.push(c[0] * bright, c[1] * bright, c[2] * bright);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.12, vertexColors: true, transparent: true, opacity: 0.9,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(geo, mat));
  }

  function buildLights() {
    // Deep space ambient (cold blue-black)
    scene.add(new THREE.AmbientLight(0x0a1a2e, 2.0));
    // Sun (warm white, from far right)
    const sun = new THREE.DirectionalLight(0xfff8e8, 3.5);
    sun.position.set(25, 8, 5);
    scene.add(sun);
    // Subtle fill from opposite side (reflected light)
    const fill = new THREE.DirectionalLight(0x1a3a6a, 0.4);
    fill.position.set(-10, -4, -8);
    scene.add(fill);
  }

  function buildEarth() {
    // Main sphere
    const geo = new THREE.SphereGeometry(EARTH_R, 48, 48);
    const mat = new THREE.MeshPhongMaterial({
      map:      makeEarthTexture(),
      specular: 0x224466,
      shininess: 25,
      emissive: 0x001122,
    });
    earthMesh = new THREE.Mesh(geo, mat);
    scene.add(earthMesh);

    // Atmosphere glow (outer shell, additive)
    const atmoGeo = new THREE.SphereGeometry(EARTH_R * 1.08, 32, 32);
    const atmoMat = new THREE.MeshPhongMaterial({
      color: 0x2255aa,
      transparent: true,
      opacity: 0.18,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    earthAtmo = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(earthAtmo);

    // Rim glow sprite (billboard)
    const rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0x3399ff, 256),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    rimSprite.scale.set(EARTH_R * 3.2, EARTH_R * 3.2, 1);
    earthMesh.add(rimSprite);
  }

  function buildMoon() {
    const geo = new THREE.SphereGeometry(MOON_R, 40, 40);
    const mat = new THREE.MeshPhongMaterial({
      map: makeMoonTexture(),
      emissive: 0x0a0906,
      shininess: 5,
    });
    moonMesh = new THREE.Mesh(geo, mat);
    scene.add(moonMesh);

    // Subtle moonlight rim
    const rimSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0xaa9977, 128),
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    rimSprite.scale.set(MOON_R * 3.0, MOON_R * 3.0, 1);
    moonMesh.add(rimSprite);
  }

  function buildOrbitRing() {
    const geo = new THREE.TorusGeometry(ORBIT_R, 0.008, 4, 160);
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a3050, transparent: true, opacity: 0.6 });
    scene.add(new THREE.Mesh(geo, mat));
  }

  function buildSpacecraft() {
    // Orion capsule (cone + cylinder)
    const orionGroup = new THREE.Group();
    const cmGeo = new THREE.ConeGeometry(0.055, 0.13, 8);
    const smGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.09, 8);
    const craft = new THREE.MeshPhongMaterial({ color: 0x00ffcc, emissive: 0x003322 });
    const cm = new THREE.Mesh(cmGeo, craft);
    cm.position.y = 0.11;
    const sm = new THREE.Mesh(smGeo, new THREE.MeshPhongMaterial({ color: 0x888888, emissive: 0x111111 }));
    orionGroup.add(cm, sm);

    // Glow billboard
    const glowSpr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0x00ffcc),
      transparent: true, opacity: 0.7,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glowSpr.scale.set(0.5, 0.5, 1);
    orionGroup.add(glowSpr);

    orionMesh = orionGroup;
    scene.add(orionMesh);

    // Starship HLS (elongated cylinder near moon)
    const shipGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8);
    const noseGeo = new THREE.ConeGeometry(0.04, 0.09, 8);
    const shipMat = new THREE.MeshPhongMaterial({ color: 0xffaa00, emissive: 0x331800 });
    const body    = new THREE.Mesh(bodyGeo, shipMat);
    const nose    = new THREE.Mesh(noseGeo, shipMat);
    nose.position.y = 0.155;
    shipGroup.add(body, nose);

    const shipGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite(0xff8800),
      transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    shipGlow.scale.set(0.45, 0.45, 1);
    shipGroup.add(shipGlow);

    starshipMesh = shipGroup;
    scene.add(starshipMesh);
  }

  function buildTrail() {
    const geo  = new THREE.BufferGeometry();
    const pts  = new Float32Array(TRAIL_LEN * 3);
    const clrs = new Float32Array(TRAIL_LEN * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(clrs, 3));
    geo.setDrawRange(0, 0);
    orionTrail = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85, linewidth: 1,
    }));
    scene.add(orionTrail);
  }

  function buildTrajectoryArc() {
    if (trajectoryLine) scene.remove(trajectoryLine);
    const pts = [];
    for (let t = 0; t <= 1; t += 0.008) {
      const p = orionPosition(t);
      pts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: 0x1a4060, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.55,
    });
    trajectoryLine = new THREE.Line(geo, mat);
    trajectoryLine.computeLineDistances();
    scene.add(trajectoryLine);
  }

  function orionPosition(t) {
    const mx = Math.cos(moonAngle) * ORBIT_R;
    const mz = Math.sin(moonAngle) * ORBIT_R;
    const cx = mx * 0.25;
    const cy = 1.8;
    const cz = mz * 0.25 + ORBIT_R * 0.45;
    const u  = 1 - t;
    return {
      x: u*u*0 + 2*u*t*cx + t*t*mx,
      y: u*u*0 + 2*u*t*cy + t*t*0,
      z: u*u*0 + 2*u*t*cz + t*t*mz,
    };
  }

  // ── Animation loop ───────────────────────────────────────────────────────────

  function animate() {
    animFrame = requestAnimationFrame(animate);
    const now = Date.now();

    moonAngle += 0.0008;
    moonMesh.position.set(Math.cos(moonAngle) * ORBIT_R, 0, Math.sin(moonAngle) * ORBIT_R);
    moonMesh.rotation.y += 0.001;
    earthMesh.rotation.y += 0.0025;
    earthAtmo.rotation.y -= 0.0008; // clouds drift slightly

    buildTrajectoryArc();

    // Orion position
    const op = orionPosition(state.transitProgress);
    orionMesh.position.set(op.x, op.y, op.z);
    orionMesh.rotation.y = now * 0.0005;

    // Starship NRHO orbit near moon
    const shipA     = moonAngle * 9 + 2.1;
    const shipOrb   = MOON_R + 0.42;
    const nrhoTilt  = Math.sin(shipA * 0.5) * 0.3;
    starshipMesh.position.set(
      moonMesh.position.x + Math.cos(shipA) * shipOrb,
      nrhoTilt,
      moonMesh.position.z + Math.sin(shipA) * shipOrb,
    );
    starshipMesh.rotation.y = now * 0.0006;

    // Gradient trail (green → teal → dark)
    trailPositions.push({ x: op.x, y: op.y, z: op.z });
    if (trailPositions.length > TRAIL_LEN) trailPositions.shift();

    const posBuf = orionTrail.geometry.attributes.position;
    const clrBuf = orionTrail.geometry.attributes.color;
    const len    = trailPositions.length;
    for (let i = 0; i < len; i++) {
      const p   = trailPositions[i];
      const frac = i / len;
      posBuf.setXYZ(i, p.x, p.y, p.z);
      // Gradient: head = cyan-green, tail = dark teal
      clrBuf.setXYZ(i, 0 + frac * 0.05, frac * 0.9, frac * 0.7);
    }
    posBuf.needsUpdate = true;
    clrBuf.needsUpdate = true;
    orionTrail.geometry.setDrawRange(0, len);

    // Camera slow orbit + gentle vertical oscillation
    cameraAngle += 0.00025;
    camera.position.x = Math.sin(cameraAngle) * 11;
    camera.position.z = Math.cos(cameraAngle) * 11;
    camera.position.y = 4.5 + Math.sin(cameraAngle * 0.6) * 1.8;
    camera.lookAt(2, 0.3, 0);

    renderer.render(scene, camera);
    updateTelemetryDisplay();
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
