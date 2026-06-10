// Three.js orbital visualization — Earth/Moon system with Orion trajectory
const Orbital3D = (() => {
  let renderer, scene, camera, animFrame;
  let earthMesh, moonMesh, orionMesh, starshipMesh;
  let orionTrail, trajectoryLine;
  let orionAngle = 0;       // current position along transfer arc (0..1)
  let moonAngle  = 0;       // moon orbital angle

  // Horizons data (updated by data layer)
  const state = {
    orionDistMoon:  null,  // km
    orionDistEarth: null,  // km
    orionVelocity:  null,  // km/s
    missionPhase:   'TLI COMPLETE',
    lastUpdate:     null,
    // normalized position 0..1 along transit arc
    transitProgress: 0.38,
  };

  const EARTH_R  = 0.5;
  const MOON_R   = 0.18;
  const ORBIT_R  = 5.5;   // moon orbit radius (scene units)
  const TRAIL_LEN = 80;

  const trailPositions = [];

  function init() {
    const canvas = document.getElementById('orbital-canvas');
    const panel  = document.getElementById('panel-orbital');

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, 0);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 1800; i++) {
      starVerts.push((Math.random() - 0.5) * 120);
      starVerts.push((Math.random() - 0.5) * 120);
      starVerts.push((Math.random() - 0.5) * 120);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 })));

    // Ambient + directional light
    scene.add(new THREE.AmbientLight(0x112244, 1.2));
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5);
    sun.position.set(20, 8, 10);
    scene.add(sun);

    // Earth
    const earthGeo = new THREE.SphereGeometry(EARTH_R, 32, 32);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x1a4a8a, emissive: 0x001133, specular: 0x224488, shininess: 40,
    });
    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    // simple continents overlay
    const cloudGeo = new THREE.SphereGeometry(EARTH_R * 1.02, 32, 32);
    const cloudMat = new THREE.MeshPhongMaterial({ color: 0x2255aa, transparent: true, opacity: 0.25, wireframe: true });
    earthMesh.add(new THREE.Mesh(cloudGeo, cloudMat));
    scene.add(earthMesh);

    // Moon orbit ring
    const ringGeo = new THREE.TorusGeometry(ORBIT_R, 0.008, 4, 120);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e3050, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Mesh(ringGeo, ringMat));

    // Moon
    const moonGeo = new THREE.SphereGeometry(MOON_R, 24, 24);
    const moonMat = new THREE.MeshPhongMaterial({ color: 0x888888, emissive: 0x111111 });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    scene.add(moonMesh);

    // Orion capsule (simple glowing sphere)
    const orionGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const orionMat = new THREE.MeshPhongMaterial({ color: 0x00ffcc, emissive: 0x004433 });
    orionMesh = new THREE.Mesh(orionGeo, orionMat);
    scene.add(orionMesh);

    // Starship HLS (slightly different color, near moon)
    const shipGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const shipMat = new THREE.MeshPhongMaterial({ color: 0xffaa00, emissive: 0x332200 });
    starshipMesh = new THREE.Mesh(shipGeo, shipMat);
    scene.add(starshipMesh);

    // Orion trail
    const trailGeo = new THREE.BufferGeometry();
    const trailPts = new Float32Array(TRAIL_LEN * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.5, linewidth: 1 });
    orionTrail = new THREE.Line(trailGeo, trailMat);
    scene.add(orionTrail);

    // Future trajectory arc (dashed look via many short segments)
    buildTrajectoryArc();

    // Labels (HTML overlay — simpler than sprites)
    resize();
    window.addEventListener('resize', resize);

    animate();
  }

  function buildTrajectoryArc() {
    const pts = [];
    for (let t = 0; t <= 1; t += 0.01) {
      const pos = orionPosition(t);
      pts.push(new THREE.Vector3(pos.x, pos.y * 0.3, pos.z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x1a3a5a, dashSize: 0.15, gapSize: 0.1, linewidth: 1 });
    trajectoryLine = new THREE.Line(geo, mat);
    trajectoryLine.computeLineDistances();
    scene.add(trajectoryLine);
  }

  // Bezier-ish transfer arc from Earth to Moon position
  function orionPosition(t) {
    // Moon current position
    const mx = Math.cos(moonAngle) * ORBIT_R;
    const mz = Math.sin(moonAngle) * ORBIT_R;
    // Control point: slightly above the arc midpoint
    const cx = mx * 0.3;
    const cy = 1.5;
    const cz = mz * 0.3 + ORBIT_R * 0.5;
    // Quadratic bezier Earth(0,0,0) -> control -> Moon
    const u = 1 - t;
    return {
      x: u * u * 0 + 2 * u * t * cx + t * t * mx,
      y: u * u * 0 + 2 * u * t * cy + t * t * 0,
      z: u * u * 0 + 2 * u * t * cz + t * t * mz,
    };
  }

  function animate() {
    animFrame = requestAnimationFrame(animate);

    moonAngle += 0.0012;
    moonMesh.position.set(
      Math.cos(moonAngle) * ORBIT_R,
      0,
      Math.sin(moonAngle) * ORBIT_R,
    );
    moonMesh.rotation.y += 0.002;
    earthMesh.rotation.y += 0.003;

    // Rebuild trajectory arc each frame (moon moves)
    if (trajectoryLine) {
      scene.remove(trajectoryLine);
      buildTrajectoryArc();
    }

    // Orion position on arc
    const op = orionPosition(state.transitProgress);
    orionMesh.position.set(op.x, op.y * 0.3, op.z);

    // Starship in low lunar orbit
    const shipOrbit = 0.45;
    const shipA = moonAngle * 8;
    starshipMesh.position.set(
      moonMesh.position.x + Math.cos(shipA) * shipOrbit,
      Math.sin(shipA * 0.5) * 0.1,
      moonMesh.position.z + Math.sin(shipA) * shipOrbit,
    );

    // Update trail
    trailPositions.push({ x: op.x, y: op.y * 0.3, z: op.z });
    if (trailPositions.length > TRAIL_LEN) trailPositions.shift();
    const buf = orionTrail.geometry.attributes.position;
    for (let i = 0; i < trailPositions.length; i++) {
      buf.setXYZ(i, trailPositions[i].x, trailPositions[i].y, trailPositions[i].z);
    }
    buf.needsUpdate = true;
    orionTrail.geometry.setDrawRange(0, trailPositions.length);

    // Slow camera orbit
    const t = Date.now() * 0.0001;
    camera.position.x = Math.sin(t) * 10;
    camera.position.z = Math.cos(t) * 10;
    camera.position.y = 5 + Math.sin(t * 0.3) * 1.5;
    camera.lookAt(2, 0, 0);

    renderer.render(scene, camera);
    updateTelemetryDisplay();
  }

  function updateTelemetryDisplay() {
    if (state.orionDistMoon !== null) {
      document.getElementById('tl-dist-moon').textContent =
        (state.orionDistMoon / 1000).toFixed(0) + ' Mm';
      document.getElementById('tl-dist-earth').textContent =
        (state.orionDistEarth / 1000).toFixed(0) + ' Mm';
      document.getElementById('tl-vel').textContent =
        state.orionVelocity.toFixed(2) + ' km/s';
    }
    document.getElementById('tl-phase').textContent = state.missionPhase;
  }

  function resize() {
    const panel = document.getElementById('panel-orbital');
    const canvas = document.getElementById('orbital-canvas');
    const legendH = 28;
    const telemH  = 48;
    const headerH = 37;
    const w = panel.clientWidth;
    const h = panel.clientHeight - legendH - telemH - headerH;
    renderer.setSize(w, Math.max(h, 100));
    camera.aspect = w / Math.max(h, 100);
    camera.updateProjectionMatrix();
  }

  function updateFromHorizons(data) {
    Object.assign(state, data);
    // update transit progress based on dist (rough model)
    if (data.orionDistEarth && data.orionDistMoon) {
      const total = data.orionDistEarth + data.orionDistMoon;
      state.transitProgress = Math.max(0.05, Math.min(0.95, data.orionDistEarth / total));
    }
    document.getElementById('orion-state').textContent =
      `Horizons · updated ${new Date().toISOString().substring(11, 19)} UTC`;
  }

  return { init, updateFromHorizons, resize };
})();
