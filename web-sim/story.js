/* ═══════════════════════════════════════════════
   STORY MODE — Artemis III Mission Explorer
   7 scenes, each with animated canvas visual
   ═══════════════════════════════════════════════ */

const StoryMode = (() => {

  // ─── Shared canvas drawing utilities ───────────────────────────────────────

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawStarfield(ctx, W, H, seed = 42) {
    const rng = mulberry32(seed);
    const colors = ['rgba(255,255,255,', 'rgba(180,210,255,', 'rgba(255,240,200,'];
    for (let i = 0; i < 320; i++) {
      const x  = rng() * W;
      const y  = rng() * H;
      const r  = rng() * 1.2 + 0.2;
      const a  = rng() * 0.6 + 0.3;
      const c  = colors[Math.floor(rng() * colors.length)];
      star(ctx, x, y, r, c + a + ')');
    }
  }

  function mulberry32(seed) {
    let s = seed;
    return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  function drawGlowCircle(ctx, x, y, r, color, glowR, glowColor) {
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, glowR);
    g.addColorStop(0, glowColor.replace(')', ',0.25)').replace('rgb', 'rgba'));
    g.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  // ─── Scene definitions ──────────────────────────────────────────────────────

  const SCENES = [

    // ══ 0: THE 54-YEAR GAP ════════════════════════════════════════════════════
    {
      chapter: 'PROLOGUE',
      title: '54 Years of Silence',
      text: `In December 1972, Apollo 17 commander Gene Cernan etched the last human bootprint into lunar dust. Then the program ended — not due to failure, but politics and budget.
<br><br>For <strong>54 years</strong>, the Moon sat 384,400 km away, explored only by robots. An entire generation grew up never seeing a human stand on another world.
<br><br>Artemis changes that. Named after Apollo's twin sister — goddess of the Moon — it picks up where Apollo left off, this time to <em>stay</em>.`,
      stats: [
        { label: 'Years without a human on the Moon', val: '54', sub: '1972 → 2026' },
        { label: 'Apollo astronauts who walked on Moon', val: '12', sub: 'All male, all American' },
        { label: 'Lunar samples returned by Apollo', val: '382', unit: 'kg', sub: 'Still being studied today' },
        { label: 'Artemis crewed missions planned', val: '3+', sub: 'III, IV, V and beyond' },
      ],
      draw: drawTimelineScene,
    },

    // ══ 1: THE ROCKETS ════════════════════════════════════════════════════════
    {
      chapter: 'THE HARDWARE',
      title: 'New Rockets for a New Era',
      text: `Apollo flew on the <strong>Saturn V</strong> — still the most powerful rocket ever successfully flown. It stood 111 metres tall and could send 48 tonnes to the Moon.
<br><br>Artemis uses the <strong>Space Launch System (SLS) Block 1B</strong> — slightly shorter at 98m but with 15% more thrust, carrying the Orion capsule and its crew of 4 toward lunar orbit.
<br><br>Where Saturn V was a one-shot disposable behemoth, SLS supports a broader ecosystem — reusable Orion capsule, commercial landers, and a lunar Gateway station.`,
      compare: {
        left:  { label: 'Saturn V', color: 'gold', rows: [
          { k: 'Height',        v: '111 m' },
          { k: 'Thrust (liftoff)', v: '34.0 MN' },
          { k: 'Lunar payload', v: '48,600 kg' },
          { k: 'Crew',          v: '3 (Apollo CM)' },
          { k: 'Missions',      v: '13 flown' },
          { k: 'First flight',  v: '1967' },
        ]},
        right: { label: 'SLS Block 1B', color: 'accent', rows: [
          { k: 'Height',        v: '98 m' },
          { k: 'Thrust (liftoff)', v: '39.1 MN' },
          { k: 'Lunar payload', v: '42,000 kg' },
          { k: 'Crew',          v: '4 (Orion)' },
          { k: 'Missions',      v: 'In service' },
          { k: 'First flight',  v: '2022' },
        ]},
      },
      draw: drawRocketsScene,
    },

    // ══ 2: EARTH → MOON ═══════════════════════════════════════════════════════
    {
      chapter: 'THE JOURNEY',
      title: 'Three Days to the Moon',
      text: `After Trans-Lunar Injection, Orion coasts through 384,400 km of deep space. There are no pit stops — just the quiet of vacuum and the slowly growing Moon.
<br><br>The trajectory isn't a straight line. Orion follows a precise arc, trading speed for altitude as Earth's gravity pulls back. At its fastest — <strong>10.8 km/s</strong> during TLI — it crosses a distance that takes light 1.28 seconds in just 3 days.
<br><br>Apollo 11 took the same basic route in 1969. The physics hasn't changed. The destination now is different: not a simple lunar orbit, but the <em>Near-Rectilinear Halo Orbit</em> where Starship HLS waits.`,
      stats: [
        { label: 'Earth–Moon distance (avg)', val: '384,400', unit: 'km', sub: 'Varies 356k–407k km' },
        { label: 'TLI velocity', val: '10.8', unit: 'km/s', sub: '~39,000 km/h' },
        { label: 'Coast duration', val: '~3', unit: 'days', sub: 'Before lunar orbit insertion' },
        { label: 'Signal delay (one-way)', val: '1.28', unit: 'sec', sub: 'Speed of light' },
      ],
      draw: drawTrajectoryScene,
    },

    // ══ 3: THE ORBIT ══════════════════════════════════════════════════════════
    {
      chapter: 'THE ORBIT',
      title: 'The Near-Rectilinear Halo Orbit',
      text: `Artemis doesn't park in a simple circular orbit. It uses the <strong>Near-Rectilinear Halo Orbit (NRHO)</strong> — a highly elongated loop anchored at the Moon's L2 gravitational region.
<br><br>At its closest (perilune), Orion sweeps just <strong>3,000 km</strong> above the lunar south pole — within easy reach of Starship HLS. At its farthest (apolune), it stretches out <strong>70,000 km</strong>, giving continuous communications with Earth.
<br><br>This same orbit will host the Lunar Gateway space station. It's unstable enough to be efficient (low stationkeeping fuel) yet stable enough for long-term use.`,
      stats: [
        { label: 'Perilune altitude', val: '3,000', unit: 'km', sub: 'Passes over south pole' },
        { label: 'Apolune altitude',  val: '70,000', unit: 'km', sub: 'Continuous Earth comms' },
        { label: 'Orbital period',    val: '~7', unit: 'days', sub: 'One complete revolution' },
        { label: 'vs Apollo LO', val: '110', unit: 'km', sub: 'Apollo used circular orbits' },
      ],
      draw: drawNRHOScene,
    },

    // ══ 4: TWO LANDERS ════════════════════════════════════════════════════════
    {
      chapter: 'THE LANDERS',
      title: 'Two Companies, Two Landers',
      text: `NASA's strategy is competition. They awarded <strong>two</strong> Human Landing System contracts — one to SpaceX, one to Blue Origin — rather than relying on a single supplier as Apollo did with Grumman.
<br><br><strong>SpaceX Starship HLS</strong> flies Artemis III. A modified version of the Mars-bound Starship, it launches to NRHO separately, refuels in orbit, then waits for Orion. It's enormous — 50m tall, designed to eventually carry 100+ people.
<br><br><strong>Blue Origin Blue Moon</strong> is contracted for Artemis V. A more traditional lander design, built from decades of engine development. Its BE-7 engine burns liquid hydrogen and oxygen — the most efficient chemical propellant combination.`,
      compare: {
        left:  { label: 'SpaceX Starship HLS', color: 'accent', subLabel: 'ARTEMIS III', rows: [
          { k: 'Height',     v: '~50 m' },
          { k: 'Diameter',   v: '9 m' },
          { k: 'Crew',       v: '2 (surface)' },
          { k: 'Propellant', v: 'LCH₄ / LOX' },
          { k: 'Engine',     v: 'Raptor vacuum' },
          { k: 'Cargo to surface', v: '>100 t' },
        ]},
        right: { label: 'Blue Moon MK1', color: 'accent2', subLabel: 'ARTEMIS V', rows: [
          { k: 'Height',     v: '16 m' },
          { k: 'Diameter',   v: '7 m' },
          { k: 'Crew',       v: '2 (surface)' },
          { k: 'Propellant', v: 'LH₂ / LOX' },
          { k: 'Engine',     v: 'BE-7' },
          { k: 'Cargo to surface', v: '20 t' },
        ]},
      },
      draw: drawLandersScene,
    },

    // ══ 5: LANDING SITE ═══════════════════════════════════════════════════════
    {
      chapter: 'THE LANDING SITE',
      title: 'Shackleton Crater Rim',
      text: `Artemis III targets the <strong>lunar south pole</strong> — a region Apollo never reached. The 6 Apollo landing sites were all near the equator, chosen for safety and sunlight.
<br><br>Near the south pole, craters like <strong>Shackleton</strong> (21 km wide, 5 km deep) have rims that bask in near-continuous sunlight while their interiors — <em>Permanently Shadowed Regions</em> — haven't seen sunlight in billions of years.
<br><br>LCROSS confirmed water ice in these shadows in 2009. Water means oxygen for breathing, hydrogen for fuel — the building blocks of a permanent lunar base. The south pole isn't just a destination. It's the <em>resource depot for humanity's future in space</em>.`,
      stats: [
        { label: 'Shackleton Crater diameter', val: '21', unit: 'km', sub: '5 km deep' },
        { label: 'Latitude', val: '89.5°', unit: 'S', sub: 'Near lunar south pole' },
        { label: 'Water ice confirmed', val: '2009', sub: 'NASA LCROSS impact' },
        { label: 'Candidate landing regions', val: '13', sub: 'Within 6° of south pole' },
      ],
      draw: drawLandingSiteScene,
    },

    // ══ 6: THE DSN ════════════════════════════════════════════════════════════
    {
      chapter: 'THE NETWORK',
      title: 'The Eyes That Never Sleep',
      text: `Every transmission between Orion and Earth passes through the <strong>Deep Space Network</strong> — three complexes placed 120° apart around the globe so at least one always faces the Moon.
<br><br><strong>Goldstone</strong> in California's Mojave Desert. <strong>Madrid</strong> in Robledo de Chavela, Spain. <strong>Canberra</strong> in Tidbinbilla, Australia. Each has dishes up to 70m across — the largest steerable radio antennas on Earth.
<br><br>At lunar distance, signals arrive at <strong>–159 dBW</strong> — a billionth of a billionth of a watt. The 70m dishes can pull a <strong>4 Mbps</strong> data stream from this whisper. During critical events — PDI, touchdown, EVAs — all three complexes point at the Moon simultaneously.`,
      stats: [
        { label: 'DSN complexes', val: '3', sub: 'Goldstone · Madrid · Canberra' },
        { label: 'Spacing', val: '120°', sub: 'Continuous sky coverage' },
        { label: 'Largest dish', val: '70', unit: 'm', sub: 'Goldstone & Canberra DSS-43' },
        { label: 'Data rate (lunar)', val: '4', unit: 'Mbps', sub: 'At 384,000 km' },
      ],
      draw: drawDSNScene,
    },

  ]; // end SCENES

  // ─── Scene draw functions ───────────────────────────────────────────────────

  function drawTimelineScene(ctx, W, H, t) {
    ctx.clearRect(0, 0, W, H);
    drawStarfield(ctx, W, H, 7);

    const cy    = H * 0.5;
    const x0    = W * 0.06;
    const x1    = W * 0.94;
    const totalYears = 2030 - 1960;

    function yearX(y) { return x0 + (y - 1960) / totalYears * (x1 - x0); }

    // Timeline axis
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(x1, cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Decade ticks
    for (let yr = 1960; yr <= 2030; yr += 10) {
      const x = yearX(yr);
      ctx.beginPath(); ctx.moveTo(x, cy - 6); ctx.lineTo(x, cy + 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'center'; ctx.fillText(yr, x, cy + 20);
    }

    // Apollo era bar (1969–1972)
    const ax0 = yearX(1969), ax1 = yearX(1972);
    const prog1 = Math.min(1, Math.max(0, (t - 300) / 600));
    ctx.fillStyle = 'rgba(245,200,66,0.25)';
    ctx.fillRect(ax0, cy - 22, (ax1 - ax0) * easeInOut(prog1), 44);
    ctx.strokeStyle = 'rgba(245,200,66,0.6)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(ax0, cy - 22, (ax1 - ax0) * easeInOut(prog1), 44);
    if (prog1 > 0.3) {
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(245,200,66,0.9)';
      ctx.textAlign = 'center'; ctx.fillText('APOLLO', (ax0 + ax1) / 2, cy - 30);
      ctx.fillText('1969–1972', (ax0 + ax1) / 2, cy - 18);
    }

    // The silence
    const sx0 = yearX(1972), sx1 = yearX(2022);
    const prog2 = Math.min(1, Math.max(0, (t - 700) / 800));
    const silW  = (sx1 - sx0) * easeInOut(prog2);
    const grad  = ctx.createLinearGradient(sx0, 0, sx0 + silW, 0);
    grad.addColorStop(0, 'rgba(60,0,0,0.15)');
    grad.addColorStop(1, 'rgba(60,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx0, cy - 10, silW, 20);
    if (prog2 > 0.5) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = `rgba(180,50,50,${prog2 * 0.8})`;
      ctx.textAlign = 'center';
      ctx.fillText('54 YEARS — NO HUMANS ON THE MOON', (sx0 + sx0 + silW) / 2, cy);
    }

    // Artemis era bar (2022–2030+)
    const emx0 = yearX(2022), emx1 = yearX(2030);
    const prog3 = Math.min(1, Math.max(0, (t - 1400) / 600));
    ctx.fillStyle = 'rgba(0,170,255,0.2)';
    ctx.fillRect(emx0, cy - 22, (emx1 - emx0) * easeInOut(prog3), 44);
    ctx.strokeStyle = 'rgba(0,170,255,0.7)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(emx0, cy - 22, (emx1 - emx0) * easeInOut(prog3), 44);
    if (prog3 > 0.3) {
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(0,170,255,0.9)';
      ctx.textAlign = 'center'; ctx.fillText('ARTEMIS', (emx0 + emx0 + (emx1-emx0)*easeInOut(prog3)) / 2, cy - 30);
    }

    // Artemis mission markers
    const missions = [
      { yr: 2022.9, label: 'I', sub: 'Uncrewed' },
      { yr: 2025.5, label: 'II', sub: 'Crewed orbit' },
      { yr: 2026.5, label: 'III', sub: 'LANDING' },
    ];
    if (prog3 > 0.5) {
      missions.forEach((m, i) => {
        const mx    = yearX(m.yr);
        const blink = m.label === 'III' ? 0.6 + 0.4 * Math.sin(t / 500) : 1;
        const a     = Math.min(1, (prog3 - 0.5) * 2);
        ctx.beginPath(); ctx.arc(mx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = m.label === 'III' ? `rgba(0,255,200,${a * blink})` : `rgba(0,170,255,${a})`;
        ctx.fill();
        ctx.font = m.label === 'III' ? 'bold 10px monospace' : '9px monospace';
        ctx.fillStyle = m.label === 'III' ? `rgba(0,255,200,${a})` : `rgba(0,170,255,${a})`;
        ctx.textAlign = 'center';
        ctx.fillText('A' + m.label, mx, cy - 14);
        ctx.font = '8px monospace'; ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
        ctx.fillText(m.sub, mx, cy + 30);
      });
    }

    // Apollo mission dots
    const apollos = [1969.5, 1969.9, 1971.1, 1971.7, 1972.2, 1972.9];
    if (prog1 > 0.5) {
      apollos.forEach(yr => {
        const ax = yearX(yr);
        ctx.beginPath(); ctx.arc(ax, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245,200,66,0.8)'; ctx.fill();
      });
    }
  }

  function drawRocketsScene(ctx, W, H, t) {
    ctx.clearRect(0, 0, W, H);
    drawStarfield(ctx, W, H, 13);

    const prog = Math.min(1, t / 1200);
    const ground = H * 0.88;
    const maxH   = H * 0.75;

    // Saturn V (left)
    const sv_h   = maxH * 0.96; // 111m
    const sls_h  = maxH * 0.85; // 98m
    const sv_x   = W * 0.28;
    const sls_x  = W * 0.72;
    const sv_w   = 30;
    const sls_w  = 28;

    // Ground line
    ctx.beginPath(); ctx.moveTo(W * 0.1, ground); ctx.lineTo(W * 0.9, ground);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();

    const sv_drawn  = sv_h  * easeInOut(prog);
    const sls_drawn = sls_h * easeInOut(prog);

    // Saturn V body
    const svGrad = ctx.createLinearGradient(sv_x - sv_w, 0, sv_x + sv_w, 0);
    svGrad.addColorStop(0, 'rgba(200,190,170,0.6)');
    svGrad.addColorStop(0.5, 'rgba(240,235,220,0.9)');
    svGrad.addColorStop(1, 'rgba(160,150,130,0.6)');
    ctx.fillStyle = svGrad;
    ctx.fillRect(sv_x - sv_w / 2, ground - sv_drawn, sv_w, sv_drawn);

    // Saturn V black bands
    if (prog > 0.3) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      [0.25, 0.5, 0.72].forEach(frac => {
        ctx.fillRect(sv_x - sv_w / 2, ground - sv_drawn * frac - 4, sv_w, 8);
      });
    }

    // Saturn V nose cone
    ctx.beginPath();
    ctx.moveTo(sv_x - sv_w / 2, ground - sv_drawn);
    ctx.lineTo(sv_x, ground - sv_drawn - 24);
    ctx.lineTo(sv_x + sv_w / 2, ground - sv_drawn);
    ctx.fillStyle = 'rgba(200,190,170,0.8)'; ctx.fill();

    // SLS body
    const slsGrad = ctx.createLinearGradient(sls_x - sls_w, 0, sls_x + sls_w, 0);
    slsGrad.addColorStop(0, 'rgba(160,180,255,0.5)');
    slsGrad.addColorStop(0.5, 'rgba(220,230,255,0.9)');
    slsGrad.addColorStop(1, 'rgba(100,120,200,0.5)');
    ctx.fillStyle = slsGrad;
    ctx.fillRect(sls_x - sls_w / 2, ground - sls_drawn, sls_w, sls_drawn);

    // SLS orange core
    if (prog > 0.2) {
      const og = ctx.createLinearGradient(sls_x - sls_w / 2, 0, sls_x + sls_w / 2, 0);
      og.addColorStop(0, 'rgba(255,100,0,0.4)');
      og.addColorStop(0.5, 'rgba(255,140,0,0.7)');
      og.addColorStop(1, 'rgba(255,100,0,0.4)');
      ctx.fillStyle = og;
      ctx.fillRect(sls_x - sls_w / 2, ground - sls_drawn * 0.6, sls_w, sls_drawn * 0.55);
    }

    // SLS Orion on top
    if (prog > 0.5) {
      ctx.beginPath();
      ctx.moveTo(sls_x - 12, ground - sls_drawn);
      ctx.lineTo(sls_x, ground - sls_drawn - 30);
      ctx.lineTo(sls_x + 12, ground - sls_drawn);
      ctx.fillStyle = 'rgba(100,160,255,0.8)'; ctx.fill();
    }

    // Height labels
    if (prog > 0.7) {
      const a = (prog - 0.7) / 0.3;
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = `rgba(240,235,220,${a})`;
      ctx.textAlign = 'center';
      ctx.fillText('111 m', sv_x, ground - sv_drawn - 36);
      ctx.fillStyle = `rgba(200,220,255,${a})`;
      ctx.fillText('98 m', sls_x, ground - sls_drawn - 44);
    }

    // Labels below
    if (prog > 0.4) {
      const a = Math.min(1, (prog - 0.4) / 0.4);
      ctx.textAlign = 'center';
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = `rgba(245,200,66,${a})`; ctx.fillText('SATURN V', sv_x, ground + 20);
      ctx.font = '9px monospace'; ctx.fillStyle = `rgba(245,200,66,${a * 0.6})`;
      ctx.fillText('Apollo · 1967–1973', sv_x, ground + 34);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = `rgba(100,180,255,${a})`; ctx.fillText('SLS BLOCK 1B', sls_x, ground + 20);
      ctx.font = '9px monospace'; ctx.fillStyle = `rgba(100,180,255,${a * 0.6})`;
      ctx.fillText('Artemis · 2022–', sls_x, ground + 34);
    }

    // Human scale figure
    if (prog > 0.8) {
      const a = (prog - 0.8) / 0.2;
      const hx = W * 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.5})`;
      ctx.lineWidth = 1.5;
      // stick figure 6 pixels tall (representing 1.8m vs ~100m)
      const scale = sv_drawn / 111 * 1.8;
      ctx.beginPath(); ctx.arc(hx, ground - scale * 1.7, scale * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, ground - scale * 1.4); ctx.lineTo(hx, ground - scale * 0.6);
      ctx.moveTo(hx - scale * 0.4, ground - scale); ctx.lineTo(hx + scale * 0.4, ground - scale);
      ctx.moveTo(hx, ground - scale * 0.6); ctx.lineTo(hx - scale * 0.3, ground);
      ctx.moveTo(hx, ground - scale * 0.6); ctx.lineTo(hx + scale * 0.3, ground);
      ctx.stroke();
      ctx.font = '8px monospace'; ctx.fillStyle = `rgba(255,255,255,${a * 0.4})`;
      ctx.textAlign = 'center'; ctx.fillText('1.8 m', hx, ground + 14);
    }
  }

  function drawTrajectoryScene(ctx, W, H, t) {
    ctx.clearRect(0, 0, W, H);
    drawStarfield(ctx, W, H, 99);

    const ex = W * 0.14, ey = H * 0.5;
    const mx = W * 0.86, my = H * 0.5;
    const er = 28, mr = 18;
    const cp1x = W * 0.35, cp1y = H * 0.12;
    const cp2x = W * 0.65, cp2y = H * 0.88;

    // Earth
    const earthG = ctx.createRadialGradient(ex - 6, ey - 8, 2, ex, ey, er);
    earthG.addColorStop(0, '#3a7abf');
    earthG.addColorStop(0.4, '#1e5799');
    earthG.addColorStop(0.8, '#0a2a5c');
    earthG.addColorStop(1, '#05152e');
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = earthG; ctx.fill();
    // atmosphere
    const atm = ctx.createRadialGradient(ex, ey, er, ex, ey, er + 8);
    atm.addColorStop(0, 'rgba(100,180,255,0.3)'); atm.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(ex, ey, er + 8, 0, Math.PI * 2);
    ctx.fillStyle = atm; ctx.fill();

    // Moon
    const moonG = ctx.createRadialGradient(mx - 4, my - 4, 2, mx, my, mr);
    moonG.addColorStop(0, '#c8c0b4');
    moonG.addColorStop(0.6, '#9a9288');
    moonG.addColorStop(1, '#6e6860');
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = moonG; ctx.fill();

    // Apollo trajectory (dotted gold, slightly different arc)
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(ex + er, ey);
    ctx.bezierCurveTo(cp1x + 10, cp1y - 20, cp2x + 10, cp2y + 20, mx - mr, my);
    ctx.strokeStyle = 'rgba(245,200,66,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Artemis trajectory
    const speed    = 0.00025;
    const progress = ((t * speed) % 1);

    // Draw trail up to progress
    const steps = 120;
    for (let i = 0; i < steps; i++) {
      const p0 = i / steps * progress;
      const p1 = (i + 1) / steps * progress;
      if (p1 <= 0) continue;
      const [x0, y0] = bezierPoint(ex + er, ey, cp1x, cp1y, cp2x, cp2y, mx - mr, my, p0);
      const [x1, y1] = bezierPoint(ex + er, ey, cp1x, cp1y, cp2x, cp2y, mx - mr, my, p1);
      const fade = i / steps;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = `rgba(0,220,180,${fade * 0.8})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Orion capsule dot
    const [ox, oy] = bezierPoint(ex + er, ey, cp1x, cp1y, cp2x, cp2y, mx - mr, my, progress);
    const orionGlow = ctx.createRadialGradient(ox, oy, 0, ox, oy, 10);
    orionGlow.addColorStop(0, 'rgba(0,255,200,0.6)');
    orionGlow.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(ox, oy, 10, 0, Math.PI * 2);
    ctx.fillStyle = orionGlow; ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffc8'; ctx.fill();

    // Velocity readout
    const velKms = (10.8 * (1 - progress * 0.65)).toFixed(2);
    ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(0,255,200,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`ORION  ${velKms} km/s`, ox + 12, oy - 6);

    // Labels
    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(100,180,255,0.7)';
    ctx.textAlign = 'center'; ctx.fillText('EARTH', ex, ey + er + 14);
    ctx.fillStyle = 'rgba(200,200,200,0.7)'; ctx.fillText('MOON', mx, my + mr + 14);
    ctx.fillStyle = 'rgba(245,200,66,0.4)'; ctx.fillText('Apollo 11 1969', (ex + mx) / 2, H * 0.08);
    ctx.fillStyle = 'rgba(0,220,180,0.5)'; ctx.fillText('Artemis III 2026', (ex + mx) / 2, H * 0.92);
  }

  function bezierPoint(x0, y0, cx1, cy1, cx2, cy2, x1, y1, t) {
    const mt = 1 - t;
    const x  = mt*mt*mt*x0 + 3*mt*mt*t*cx1 + 3*mt*t*t*cx2 + t*t*t*x1;
    const y  = mt*mt*mt*y0 + 3*mt*mt*t*cy1 + 3*mt*t*t*cy2 + t*t*t*y1;
    return [x, y];
  }

  function drawNRHOScene(ctx, W, H, t) {
    ctx.clearRect(0, 0, W, H);
    drawStarfield(ctx, W, H, 55);

    const mx = W * 0.42, my = H * 0.5;
    const mr = 30;

    // Moon
    const moonG = ctx.createRadialGradient(mx - 6, my - 8, 3, mx, my, mr);
    moonG.addColorStop(0, '#d0c8bc');
    moonG.addColorStop(0.6, '#a09890');
    moonG.addColorStop(1, '#706860');
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = moonG; ctx.fill();

    // NRHO is a highly elliptical orbit tilted ~90° to lunar equator
    // Approximate: a vertical oval, periapsis at south
    const nrA   = H * 0.44;   // semi-major (vertical)
    const nrB   = W * 0.22;   // semi-minor (horizontal)
    const cx    = mx + nrB * 0.1;
    const cy    = my + mr * 0.3;

    // Draw NRHO orbit
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, nrB, nrA, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,170,255,0.25)';
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Animated Orion on NRHO
    const ang  = -(t * 0.0003) % (Math.PI * 2);
    const ox   = cx + nrB * Math.cos(ang);
    const oy   = cy + nrA * Math.sin(ang);

    // Trail
    const trailSteps = 60;
    for (let i = 0; i < trailSteps; i++) {
      const a0 = ang - (i + 1) * 0.05;
      const a1 = ang - i * 0.05;
      const tx0 = cx + nrB * Math.cos(a0), ty0 = cy + nrA * Math.sin(a0);
      const tx1 = cx + nrB * Math.cos(a1), ty1 = cy + nrA * Math.sin(a1);
      ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(tx1, ty1);
      ctx.strokeStyle = `rgba(0,170,255,${(trailSteps - i) / trailSteps * 0.5})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Orion dot
    const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, 9);
    og.addColorStop(0, 'rgba(0,200,255,0.7)'); og.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.fillStyle = og; ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#00c8ff'; ctx.fill();

    // Starship HLS waiting on orbit (opposite phase)
    const sa  = ang + Math.PI * 0.7;
    const shx = cx + nrB * Math.cos(sa);
    const shy = cy + nrA * Math.sin(sa);
    const sg  = ctx.createRadialGradient(shx, shy, 0, shx, shy, 8);
    sg.addColorStop(0, 'rgba(255,140,0,0.6)'); sg.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(shx, shy, 8, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
    ctx.beginPath(); ctx.arc(shx, shy, 3, 0, Math.PI * 2); ctx.fillStyle = '#ff9040'; ctx.fill();

    // Labels
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(0,200,255,0.8)'; ctx.textAlign = 'left';
    ctx.fillText('ORION', ox + 10, oy - 4);
    ctx.fillStyle = 'rgba(255,140,0,0.8)';
    ctx.fillText('STARSHIP HLS', shx + 10, shy - 4);

    // Dimension lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy - nrA); ctx.lineTo(W * 0.78, cy - nrA);
    ctx.moveTo(cx, cy + nrA); ctx.lineTo(W * 0.78, cy + nrA);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('APOLUNE  70,000 km', W * 0.78 - 100, cy - nrA - 6);
    ctx.fillText('PERILUNE  3,000 km', W * 0.78 - 100, cy + nrA + 14);

    ctx.fillStyle = 'rgba(200,200,200,0.6)'; ctx.textAlign = 'center';
    ctx.fillText('MOON', mx, my + mr + 14);
  }

  function drawLandersScene(ctx, W, H, t) {
    ctx.clearRect(0, 0, W, H);
    drawStarfield(ctx, W, H, 77);

    const ground = H * 0.84;
    const prog   = Math.min(1, t / 1000);
    const sx     = W * 0.3;
    const bx     = W * 0.72;

    // Ground surface (Moon-like)
    ctx.fillStyle = 'rgba(120,110,100,0.15)';
    ctx.fillRect(0, ground, W, H - ground);
    ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground);
    ctx.strokeStyle = 'rgba(180,170,160,0.2)'; ctx.lineWidth = 1; ctx.stroke();

    const sh = H * 0.68 * easeInOut(prog);
    const bh = H * 0.36 * easeInOut(prog);

    // ── Starship HLS ──
    // Legs (3 visible)
    if (prog > 0.3) {
      const la = (prog - 0.3) / 0.7;
      ctx.strokeStyle = `rgba(180,200,255,${la * 0.6})`; ctx.lineWidth = 2;
      [[-28, 14], [0, 16], [28, 14]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(sx, ground - sh * 0.05);
        ctx.lineTo(sx + dx, ground + dy * la);
        ctx.stroke();
      });
    }
    // Body
    const sg = ctx.createLinearGradient(sx - 18, 0, sx + 18, 0);
    sg.addColorStop(0, 'rgba(140,160,200,0.5)');
    sg.addColorStop(0.5, 'rgba(210,220,240,0.9)');
    sg.addColorStop(1, 'rgba(100,120,180,0.5)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 18, ground - sh, 36, sh * 0.85);
    // Nose
    ctx.beginPath();
    ctx.moveTo(sx - 18, ground - sh);
    ctx.lineTo(sx, ground - sh - 28);
    ctx.lineTo(sx + 18, ground - sh);
    ctx.fillStyle = 'rgba(180,200,240,0.8)'; ctx.fill();
    // Fins
    if (prog > 0.5) {
      [[1, -1], [1, 1]].forEach(([sx2, side]) => {
        ctx.beginPath();
        ctx.moveTo(sx + side * 18, ground - sh * 0.15);
        ctx.lineTo(sx + side * 38, ground - sh * 0.02);
        ctx.lineTo(sx + side * 18, ground - sh * 0.28);
        ctx.fillStyle = 'rgba(140,160,220,0.5)'; ctx.fill();
      });
    }

    // ── Blue Moon ──
    if (prog > 0.15) {
      const ba = Math.min(1, (prog - 0.15) / 0.7);
      const bdrawn = bh * easeInOut(ba);
      // Legs
      [[-24, 12], [0, 14], [24, 12]].forEach(([dx, dy]) => {
        ctx.strokeStyle = `rgba(100,220,255,${ba * 0.6})`; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, ground - bdrawn * 0.08);
        ctx.lineTo(bx + dx, ground + dy * ba);
        ctx.stroke();
      });
      // Descent stage (wider)
      const bg2 = ctx.createLinearGradient(bx - 22, 0, bx + 22, 0);
      bg2.addColorStop(0, 'rgba(0,100,160,0.5)');
      bg2.addColorStop(0.5, 'rgba(60,180,255,0.85)');
      bg2.addColorStop(1, 'rgba(0,80,140,0.5)');
      ctx.fillStyle = bg2;
      ctx.fillRect(bx - 22, ground - bdrawn * 0.55, 44, bdrawn * 0.5);
      // Ascent stage (narrower, on top)
      const ag2 = ctx.createLinearGradient(bx - 14, 0, bx + 14, 0);
      ag2.addColorStop(0, 'rgba(60,160,255,0.6)');
      ag2.addColorStop(0.5, 'rgba(120,210,255,0.9)');
      ag2.addColorStop(1, 'rgba(40,140,220,0.6)');
      ctx.fillStyle = ag2;
      ctx.fillRect(bx - 14, ground - bdrawn, 28, bdrawn * 0.5);
      // Dome on top
      ctx.beginPath();
      ctx.arc(bx, ground - bdrawn, 14, Math.PI, 0);
      ctx.fillStyle = 'rgba(120,210,255,0.6)'; ctx.fill();

      // Label
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = `rgba(60,180,255,${ba})`;
      ctx.textAlign = 'center'; ctx.fillText('BLUE MOON MK1', bx, ground + 24);
      ctx.font = '8px monospace'; ctx.fillStyle = `rgba(60,180,255,${ba * 0.6})`;
      ctx.fillText('ARTEMIS V (Blue Origin)', bx, ground + 36);
    }

    // Labels Starship
    if (prog > 0.6) {
      const a = (prog - 0.6) / 0.4;
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = `rgba(180,200,255,${a})`;
      ctx.textAlign = 'center'; ctx.fillText('STARSHIP HLS', sx, ground + 24);
      ctx.font = '8px monospace'; ctx.fillStyle = `rgba(180,200,255,${a * 0.6})`;
      ctx.fillText('ARTEMIS III (SpaceX)', sx, ground + 36);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.4})`;
      ctx.fillText('~50 m', sx, ground - sh - 40);
      ctx.fillText('~16 m', bx, ground - bh - 10);
    }

    // Human scale figure
    if (prog > 0.85) {
      const a   = (prog - 0.85) / 0.15;
      const hx  = W * 0.5;
      const scale = (sh / (50 / 1.8));
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.5})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hx, ground - scale * 1.7, scale * 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx, ground - scale * 1.4); ctx.lineTo(hx, ground - scale * 0.6);
      ctx.moveTo(hx - scale * 0.4, ground - scale); ctx.lineTo(hx + scale * 0.4, ground - scale);
      ctx.moveTo(hx, ground - scale * 0.6); ctx.lineTo(hx - scale * 0.3, ground);
      ctx.moveTo(hx, ground - scale * 0.6); ctx.lineTo(hx + scale * 0.3, ground);
      ctx.stroke();
    }
  }

  function drawLandingSiteScene(ctx, W, H, t) {
    ctx.clearRect(0, 0, W, H);

    const cx = W * 0.5, cy = H * 0.52;
    const r  = Math.min(W, H) * 0.38;

    // Moon disk
    const mg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    mg.addColorStop(0, '#c8bfb4');
    mg.addColorStop(0.5, '#9c9490');
    mg.addColorStop(1, '#6e6860');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = mg; ctx.fill();

    // Permanently shadowed regions (dark patches near pole)
    const psrs = [
      [0, -0.85, 0.22], [-0.3, -0.78, 0.14], [0.35, -0.80, 0.16],
      [-0.1, -0.95, 0.10], [0.2, -0.70, 0.12],
    ];
    psrs.forEach(([px, py, pr]) => {
      ctx.beginPath();
      ctx.arc(cx + px * r, cy + py * r, pr * r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,10,5,0.7)'; ctx.fill();
    });

    // Craters
    const craters = [
      [0.1, -0.15, 0.08, 0.7], [-0.3, 0.2, 0.06, 0.6], [0.4, -0.3, 0.05, 0.5],
      [-0.1, 0.45, 0.09, 0.5], [0.2, 0.35, 0.04, 0.6], [-0.45, -0.1, 0.07, 0.4],
    ];
    craters.forEach(([px, py, pr, a]) => {
      ctx.beginPath(); ctx.arc(cx + px * r, cy + py * r, pr * r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(80,70,60,${a})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = `rgba(60,50,45,${a * 0.5})`; ctx.fill();
    });

    // Shackleton crater (highlight)
    const shx = cx + 0.04 * r;
    const shy = cy - 0.88 * r;
    const shr = 0.10 * r;
    const pulse = 0.7 + 0.3 * Math.sin(t / 600);
    // crater bowl
    ctx.beginPath(); ctx.arc(shx, shy, shr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,8,4,0.85)'; ctx.fill();
    // rim glow
    ctx.beginPath(); ctx.arc(shx, shy, shr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,255,200,${pulse * 0.8})`; ctx.lineWidth = 2; ctx.stroke();
    // outer glow ring
    ctx.beginPath(); ctx.arc(shx, shy, shr + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,255,200,${pulse * 0.25})`; ctx.lineWidth = 4; ctx.stroke();

    // Apollo sites (tiny gold markers near equator)
    const apolloSites = [
      [-0.08, 0.06, 'A11'], [0.24, -0.04, 'A12'], [-0.35, -0.08, 'A14'],
      [-0.18, -0.38, 'A15'], [0.30, -0.22, 'A16'], [0.12, -0.30, 'A17'],
    ];
    if (t > 800) {
      const a = Math.min(1, (t - 800) / 400);
      apolloSites.forEach(([px, py, label]) => {
        const ax = cx + px * r, ay = cy + py * r;
        ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,200,66,${a * 0.7})`; ctx.fill();
        ctx.font = '7px monospace'; ctx.fillStyle = `rgba(245,200,66,${a * 0.5})`;
        ctx.textAlign = 'center'; ctx.fillText(label, ax, ay - 6);
      });
    }

    // Labels
    ctx.font = 'bold 10px monospace'; ctx.fillStyle = 'rgba(0,255,200,0.9)';
    ctx.textAlign = 'left'; ctx.fillText('← SHACKLETON CRATER', shx + shr + 8, shy + 4);
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(0,255,200,0.55)';
    ctx.fillText('89.5°S · Target landing zone', shx + shr + 8, shy + 17);

    if (t > 800) {
      ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(245,200,66,0.55)';
      ctx.textAlign = 'center';
      ctx.fillText('Apollo sites (equatorial)', cx, cy + r * 0.55);
    }

    // PSR label
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(150,130,120,0.5)';
    ctx.textAlign = 'center'; ctx.fillText('Permanently Shadowed Regions', cx - r * 0.15, cy - r * 0.62);

    // North/South labels
    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('SOUTH POLE', cx, cy - r - 10);
    ctx.fillText('NEAR SIDE', cx, cy + r + 16);
  }

  function drawDSNScene(ctx, W, H, t) {
    ctx.clearRect(0, 0, W, H);
    drawStarfield(ctx, W, H, 22);

    const mx = W * 0.5, my = H * 0.46;
    const mw = W * 0.86, mh = H * 0.52;
    const x0 = mx - mw / 2, y0 = my - mh / 2;

    // Simple world map outline (filled continents as rectangles — simplified)
    ctx.fillStyle = 'rgba(30,50,40,0.6)';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = 'rgba(0,170,255,0.12)'; ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, mw, mh);

    // Lat/lon grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5;
    for (let lon = -180; lon <= 180; lon += 30) {
      const gx = x0 + ((lon + 180) / 360) * mw;
      ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + mh); ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const gy = y0 + ((90 - lat) / 180) * mh;
      ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + mw, gy); ctx.stroke();
    }

    // Continent shapes (approximate filled regions)
    const landAreas = [
      // North America
      { x: -130, y: 50, w: 75, h: 40 }, { x: -110, y: 20, w: 55, h: 35 },
      // South America
      { x: -80, y: -5, w: 35, h: 55 },
      // Europe
      { x: -10, y: 35, w: 40, h: 30 },
      // Africa
      { x: -20, y: -35, w: 55, h: 70 },
      // Asia
      { x: 25, y: 15, w: 110, h: 55 },
      // Australia
      { x: 114, y: -40, w: 50, h: 35 },
    ];
    ctx.fillStyle = 'rgba(50,80,60,0.5)';
    landAreas.forEach(({ x, y, w, h }) => {
      const px = x0 + ((x + 180) / 360) * mw;
      const py = y0 + ((90 - (y + h)) / 180) * mh;
      const pw = (w / 360) * mw;
      const ph = (h / 180) * mh;
      ctx.fillRect(px, py, pw, ph);
    });

    // DSN stations: Goldstone (-116.8, 35.4), Madrid (-4.2, 40.4), Canberra (148.9, -35.4)
    const stations = [
      { name: 'GOLDSTONE',  lon: -116.8, lat: 35.4,  color: '#00aaff' },
      { name: 'MADRID',     lon:  -4.2,  lat: 40.4,  color: '#00aaff' },
      { name: 'CANBERRA',   lon: 148.9,  lat: -35.4, color: '#00aaff' },
    ];

    // Moon position (upper right of map frame)
    const moonX = W * 0.88, moonY = H * 0.14;
    const moonR  = 10;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = '#b0a898'; ctx.fill();
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center'; ctx.fillText('MOON', moonX, moonY + moonR + 10);

    stations.forEach(({ name, lon, lat, color }, i) => {
      const sx = x0 + ((lon + 180) / 360) * mw;
      const sy = y0 + ((90 - lat) / 180) * mh;

      // Coverage arc (pulse outward)
      const arcR = (W * 0.12) + Math.sin(t / 800 + i * 2) * 5;
      ctx.beginPath();
      ctx.arc(sx, sy, arcR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,170,255,0.08)`;
      ctx.lineWidth = arcR * 0.4;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, arcR * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,170,255,0.12)'; ctx.lineWidth = 2; ctx.stroke();

      // Station dot
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
      glow.addColorStop(0, 'rgba(0,200,255,0.7)'); glow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fillStyle = '#00c8ff'; ctx.fill();

      // Signal line to Moon
      if (t > 500) {
        const prog = (t / 1000 + i * 0.33) % 1;
        const sigX = sx + (moonX - sx) * prog;
        const sigY = sy + (moonY - sy) * prog;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(moonX, moonY);
        ctx.strokeStyle = 'rgba(0,170,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(sigX, sigY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,220,255,${0.8 - prog * 0.7})`; ctx.fill();
      }

      // Label
      ctx.font = 'bold 9px monospace'; ctx.fillStyle = 'rgba(0,200,255,0.85)';
      ctx.textAlign = lat < 0 ? 'right' : 'left';
      ctx.fillText(name, sx + (lat < 0 ? -10 : 10), sy - 10);
    });

    // Equator label
    const eqY = y0 + mh / 2;
    ctx.font = '7px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign = 'left'; ctx.fillText('EQUATOR', x0 + 4, eqY - 3);
  }

  // ─── Story mode engine ──────────────────────────────────────────────────────

  let current  = 0;
  let animId   = null;
  let startT   = null;
  let overlay  = null;
  let stCanvas = null;
  let stCtx    = null;

  function build() {
    if (document.getElementById('story-overlay')) return;

    // Open button
    const openBtn = document.createElement('button');
    openBtn.id        = 'story-open-btn';
    openBtn.textContent = '⬡ STORY MODE';
    openBtn.onclick   = () => open(0);
    document.body.appendChild(openBtn);

    // Overlay
    overlay = document.createElement('div');
    overlay.id = 'story-overlay';
    overlay.innerHTML = `
      <div class="story-header">
        <span class="story-logo">⬡ <span>NASA</span> · ARTEMIS III · MISSION EXPLORER</span>
        <div class="story-progress"><div class="story-progress-fill" id="sp-fill"></div></div>
        <button class="story-close-btn" id="story-close">✕</button>
      </div>
      <div class="story-body-wrap">
        <div class="story-left" id="story-left"></div>
        <div class="story-right"><canvas id="story-canvas"></canvas></div>
      </div>
      <div class="story-nav">
        <button class="story-nav-btn" id="story-prev">← PREV</button>
        <div class="story-dots" id="story-dots"></div>
        <span class="story-hint">← → to navigate</span>
        <button class="story-nav-btn" id="story-next">NEXT →</button>
      </div>
    `;
    document.body.appendChild(overlay);

    stCanvas = document.getElementById('story-canvas');
    stCtx    = stCanvas.getContext('2d');

    // Dots
    const dotsEl = document.getElementById('story-dots');
    SCENES.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'story-dot';
      d.onclick   = () => goTo(i);
      dotsEl.appendChild(d);
    });

    document.getElementById('story-close').onclick = close;
    document.getElementById('story-prev').onclick  = () => goTo(current - 1);
    document.getElementById('story-next').onclick  = () => goTo(current + 1);

    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!overlay?.classList.contains('active')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  goTo(current + 1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    goTo(current - 1);
    if (e.key === 'Escape')                                close();
  }

  function open(n = 0) {
    build();
    overlay.classList.add('active');
    goTo(n, true);
  }

  function close() {
    overlay.classList.remove('active');
    cancelAnimationFrame(animId);
    animId = null;
  }

  function goTo(n, immediate = false) {
    if (n < 0 || n >= SCENES.length) return;
    if (!immediate) {
      overlay.classList.add('fading');
      setTimeout(() => { overlay.classList.remove('fading'); _renderScene(n); }, 320);
    } else {
      _renderScene(n);
    }
  }

  function _renderScene(n) {
    current = n;
    const sc = SCENES[n];

    // Left panel
    const leftEl = document.getElementById('story-left');
    let html = `
      <div class="story-chapter">${sc.chapter}</div>
      <div class="story-scene-label">SCENE ${n + 1} / ${SCENES.length}</div>
      <div class="story-title">${sc.title}</div>
      <div class="story-text">${sc.text || ''}</div>
    `;

    if (sc.compare) {
      html += `<div class="story-compare">`;
      const l = sc.compare.left, r = sc.compare.right;
      html += `<div class="cmp-col ${l.color}-col">
        <div class="cmp-mission ${l.color}">${l.label}${l.subLabel ? ` <span style="opacity:.5;font-size:8px">· ${l.subLabel}</span>` : ''}</div>`;
      l.rows.forEach(row => html += `<div class="cmp-row"><span class="cmp-key">${row.k}</span><span class="cmp-val ${row.hi ? 'hi' : ''}">${row.v}</span></div>`);
      html += `</div>`;
      html += `<div class="cmp-col ${r.color}-col">
        <div class="cmp-mission ${r.color}">${r.label}${r.subLabel ? ` <span style="opacity:.5;font-size:8px">· ${r.subLabel}</span>` : ''}</div>`;
      r.rows.forEach(row => html += `<div class="cmp-row"><span class="cmp-key">${row.k}</span><span class="cmp-val">${row.v}</span></div>`);
      html += `</div></div>`;
    }

    if (sc.stats) {
      html += `<div class="story-stats">`;
      sc.stats.forEach(s => {
        html += `<div class="story-stat">
          <div class="stat-label">${s.label}</div>
          <div class="stat-val">${s.val}<span class="stat-unit">${s.unit || ''}</span></div>
          ${s.sub     ? `<div class="stat-sub">${s.sub}</div>` : ''}
          ${s.compare ? `<div class="stat-compare">${s.compare}</div>` : ''}
        </div>`;
      });
      html += `</div>`;
    }

    leftEl.innerHTML = html;

    // Progress fill
    document.getElementById('sp-fill').style.width = `${(n / (SCENES.length - 1)) * 100}%`;

    // Dots
    document.querySelectorAll('.story-dot').forEach((d, i) => d.classList.toggle('active', i === n));

    // Nav buttons
    document.getElementById('story-prev').disabled = n === 0;
    document.getElementById('story-next').disabled = n === SCENES.length - 1;

    // Canvas animation
    cancelAnimationFrame(animId);
    startT = null;
    resizeCanvas();

    function loop(ts) {
      if (!startT) startT = ts;
      const elapsed = ts - startT;
      resizeCanvas();
      sc.draw(stCtx, stCanvas.width, stCanvas.height, elapsed);
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const r = stCanvas.parentElement.getBoundingClientRect();
    if (stCanvas.width !== Math.floor(r.width) || stCanvas.height !== Math.floor(r.height)) {
      stCanvas.width  = Math.floor(r.width);
      stCanvas.height = Math.floor(r.height);
    }
  }

  // Mount the launch button as soon as the DOM is ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  return { open, close };
})();
