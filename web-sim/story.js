/* ═══════════════════════════════════════════════════════════════════════════
   STORY MODE: how Artemis got here and what happens next.
   Eight chapters, each with a NASA photograph behind it, a canvas (or 3D model) visual and verified facts.
   Facts last checked 2026-09-30 (NASA, Wikipedia, Ars Technica). Update SCENES when the schedule moves.
   ═══════════════════════════════════════════════════════════════════════════ */

const StoryMode = (() => {

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MONO = "'Geist Mono', ui-monospace, Menlo, monospace";
  const SANS = "'Geist', ui-sans-serif, system-ui, sans-serif";
  const RED  = '232,96,90';       // Artemis: next mission, Orion, the pole
  const BLUE = '93,148,240';      // completed steps and communication links
  const WARM   = '214,200,172';    // Apollo-era neutral
  const COOL   = '170,186,210';    // everything else

  // NASA Image and Video Library, keyless. Large rendition of a known asset id.
  const nasaImg = id => `https://images-assets.nasa.gov/image/${encodeURIComponent(id)}/${encodeURIComponent(id)}~large.jpg`;

  // ── Canvas utilities ───────────────────────────────────────────────────────
  function mulberry32(seed) {
    let s = seed;
    return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const ease = t => { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, smooth((t - t0) / (t1 - t0))); }
    }
    return keys[keys.length - 1][1];
  }

  // Starfields are expensive to redraw every frame, so each (size, seed) is drawn once to an offscreen canvas
  const starCache = new Map();
  function drawStarfield(ctx, W, H, seed = 42) {
    const dpr = window.devicePixelRatio || 1, key = `${W}x${H}x${seed}x${dpr}`;
    let c = starCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
      const g = c.getContext('2d'); g.scale(dpr, dpr);
      const rng = mulberry32(seed), cols = ['255,255,255', '180,210,255', '255,240,200'];
      for (let i = 0; i < 280; i++) {
        g.beginPath(); g.arc(rng() * W, rng() * H, rng() * 1.1 + 0.2, 0, Math.PI * 2);
        g.fillStyle = `rgba(${cols[Math.floor(rng() * 3)]},${rng() * 0.55 + 0.25})`; g.fill();
      }
      if (starCache.size > 12) starCache.clear();
      starCache.set(key, c);
    }
    ctx.drawImage(c, 0, 0, W, H);
  }

  function text(ctx, str, x, y, { size = 11, color = `rgba(${COOL},0.8)`, align = 'left', weight = 400, font = MONO } = {}) {
    ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(str, x, y);
  }

  function disc(ctx, x, y, r, stops, rim) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    if (rim) { const a = ctx.createRadialGradient(x, y, r, x, y, r * 1.22); a.addColorStop(0, rim); a.addColorStop(1, 'transparent'); ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, Math.PI * 2); ctx.fillStyle = a; ctx.fill(); }
  }
  const earth = (ctx, x, y, r) => disc(ctx, x, y, r, [[0, '#4d8fd1'], [0.45, '#1f5a9e'], [0.85, '#0a2c5e'], [1, '#05152e']], 'rgba(110,170,255,0.28)');
  const moon  = (ctx, x, y, r) => disc(ctx, x, y, r, [[0, '#d6cfc4'], [0.6, '#a39b91'], [1, '#6f6a62']]);

  function bez(p0, c1, c2, p1, t) {
    const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]];
  }

  // Small top-down vehicle glyphs for the docking scene. Origin is the vehicle center, +x is "forward".
  function vehicle(ctx, kind, x, y, ang, s, alpha) {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); ctx.globalAlpha = alpha;
    const fill = c => { ctx.fillStyle = c; ctx.fill(); };
    if (kind === 'orion') {
      ctx.fillStyle = 'rgba(120,140,255,0.85)'; [-1, 1].forEach(sd => { ctx.fillRect(-4, sd * 17 - 2.5, 9, 5); ctx.fillRect(-4, sd * 7.5 - 2.5, 9, 5); }); // solar wings
      ctx.fillStyle = '#aab2bb'; ctx.fillRect(-12, -6, 12, 12);                                                                           // service module
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(13, -3.5); ctx.lineTo(13, 3.5); ctx.lineTo(0, 8); ctx.closePath(); fill('#eef1f4');     // capsule
    } else if (kind === 'blue') {
      ctx.fillStyle = '#6b8fb3'; ctx.fillRect(-16, -9, 11, 18);
      ctx.fillStyle = '#e2e8ef'; ctx.fillRect(-5, -8, 15, 16);
      ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(17, -3.5); ctx.lineTo(17, 3.5); ctx.lineTo(10, 8); ctx.closePath(); fill('#e2e8ef');
    } else { // starship test article
      const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#9aa3ab'); g.addColorStop(0.5, '#f0f3f5'); g.addColorStop(1, '#8d969e');
      ctx.fillStyle = g; ctx.fillRect(-28, -7.5, 44, 15);
      ctx.beginPath(); ctx.moveTo(16, -7.5); ctx.quadraticCurveTo(30, -4, 33, 0); ctx.quadraticCurveTo(30, 4, 16, 7.5); ctx.closePath(); fill('#dfe4e8');
      ctx.fillStyle = '#4a4f55'; ctx.fillRect(-31, -6, 3, 12);
    }
    ctx.restore();
  }

  // ── Canvas scenes ──────────────────────────────────────────────────────────

  // Piecewise axis: 1965-1975 (Apollo), a compressed break, then 2020-2030 (Artemis)
  function drawTimelineScene(ctx, W, H, t) {
    drawStarfield(ctx, W, H, 7);
    const cy = H * 0.5, x0 = W * 0.06, x1 = W * 0.94;
    // [from year, to year, from x fraction, to x fraction]
    const seg = [[1965, 1975, 0.06, 0.30], [1975, 2020, 0.30, 0.42], [2020, 2030, 0.42, 0.94]];
    const fx = yr => { const [a, b, p, q] = seg.find(([, hi]) => yr <= hi) || seg[2]; return W * lerp(p, q, clamp01((yr - a) / (b - a))); };

    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
    [1965, 1970, 1975, 2020, 2022, 2024, 2026, 2028, 2030].forEach(yr => {
      const x = fx(yr); ctx.beginPath(); ctx.moveTo(x, cy - 5); ctx.lineTo(x, cy + 5); ctx.stroke();
      text(ctx, yr, x, cy + 22, { size: 10, color: 'rgba(255,255,255,0.32)', align: 'center' });
    });

    // Apollo
    const p1 = ease((t - 200) / 800);
    const ax0 = fx(1969), ax1 = fx(1972.95);
    ctx.fillStyle = `rgba(${WARM},0.16)`; ctx.fillRect(ax0, cy - 24, (ax1 - ax0) * p1, 48);
    ctx.strokeStyle = `rgba(${WARM},0.55)`; ctx.strokeRect(ax0, cy - 24, (ax1 - ax0) * p1, 48);
    if (p1 > 0.5) {
      text(ctx, 'APOLLO', (ax0 + ax1) / 2, cy - 34, { size: 11, color: `rgba(${WARM},0.95)`, align: 'center', weight: 500 });
      [1969.55, 1969.9, 1971.1, 1971.6, 1972.3, 1972.95].forEach(yr => { ctx.beginPath(); ctx.arc(fx(yr), cy, 2.6, 0, Math.PI * 2); ctx.fillStyle = `rgba(${WARM},0.95)`; ctx.fill(); });
    }

    // The long gap: no one on the surface, from Dec 1972 to the planned 2028 landing
    const p2 = ease((t - 700) / 1600);
    const g0 = fx(1972.95), g1 = fx(2028.1);
    ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = `rgba(${COOL},0.35)`;
    ctx.beginPath(); ctx.moveTo(g0, cy); ctx.lineTo(g0 + (g1 - g0) * p2, cy); ctx.stroke(); ctx.restore();
    if (p2 > 0.3) text(ctx, 'No humans on the surface since Dec 1972', W * 0.5, cy - Math.min(H * 0.26, 120), { size: 12.5, color: `rgba(255,255,255,${p2 * 0.85})`, align: 'center', font: SANS });

    // Artemis markers. Labels sit on staggered levels so the crowded 2027-2029 stretch stays legible
    const items = [['I', 2022.88, 'Uncrewed', 'done', 1], ['II', 2026.25, 'Crew flyby', 'done', -1], ['III', 2027.4, 'Orbit test', 'next', 1], ['IV', 2028.1, 'Landing', 'plan', 2], ['V', 2028.9, 'Landing 2', 'plan', -2]];
    items.forEach(([n, yr, sub, st, lvl], i) => {
      const a = ease((t - 1500 - i * 260) / 500); if (a <= 0) return;
      const x = fx(yr), dy = lvl * 30;
      ctx.beginPath(); ctx.arc(x, cy, st === 'done' ? 5.5 : 5, 0, Math.PI * 2);
      if (st === 'done') { ctx.fillStyle = `rgba(${BLUE},${a})`; ctx.fill(); }
      else { ctx.fillStyle = `rgba(10,12,16,${a})`; ctx.fill(); ctx.strokeStyle = `rgba(${st === 'next' ? RED : COOL},${a})`; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (st === 'next') { const pr = (t / 1800) % 1; ctx.beginPath(); ctx.arc(x, cy, 5 + pr * 12, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${RED},${0.6 * (1 - pr) * a})`; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.strokeStyle = `rgba(255,255,255,${0.12 * a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, cy + Math.sign(dy) * 8); ctx.lineTo(x, cy + dy - Math.sign(dy) * 13); ctx.stroke();
      const col = st === 'plan' ? `rgba(${COOL},${a * 0.95})` : st === 'done' ? `rgba(${BLUE},${a})` : `rgba(${RED},${a})`;
      text(ctx, 'A' + n, x, cy + dy, { size: 11, color: col, align: 'center', weight: 600 });
      text(ctx, sub, x, cy + dy + (dy < 0 ? -13 : 13), { size: 9.5, color: `rgba(255,255,255,${a * 0.6})`, align: 'center' });
    });

    // Today
    const nx = fx(2026.75), pn = ease((t - 2200) / 500);
    ctx.strokeStyle = `rgba(255,255,255,${0.22 * pn})`; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(nx, cy - 84); ctx.lineTo(nx, H - 46); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'Today', nx, H - 32, { size: 10, color: `rgba(255,255,255,${0.65 * pn})`, align: 'center' });

    text(ctx, 'Axis is broken between 1975 and 2020', x1, H - 16, { size: 9.5, color: 'rgba(255,255,255,0.28)', align: 'right' });
  }

  // Artemis II free-return flyby
  function drawFlybyScene(ctx, W, H, t) {
    drawStarfield(ctx, W, H, 99);
    const ex = W * 0.14, ey = H * 0.5, er = Math.min(W, H) * 0.08;
    const mx = W * 0.82, my = H * 0.5, mr = er * 0.6;
    const P0 = [ex + er * 0.85, ey - er * 0.25], P3 = [mx + mr * 2.4, my], P5 = [ex + er * 0.85, ey + er * 0.25];
    const out = s => bez(P0, [W * 0.3, H * 0.06], [W * 0.66, H * 0.12], P3, s);
    const ret = s => bez(P3, [W * 0.66, H * 0.88], [W * 0.3, H * 0.94], P5, s);

    earth(ctx, ex, ey, er); moon(ctx, mx, my, mr);
    ctx.save(); ctx.setLineDash([3, 6]); ctx.strokeStyle = `rgba(${RED},0.3)`; ctx.lineWidth = 1;
    ctx.beginPath(); for (let i = 0; i <= 60; i++) { const [x, y] = out(i / 60); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    for (let i = 0; i <= 60; i++) { const [x, y] = ret(i / 60); ctx.lineTo(x, y); } ctx.stroke(); ctx.restore();

    const LOOP = 26000, loop = (t % LOOP) / LOOP, FLY = 0.553, DAYS = 9 + 1.5 / 24, day0 = loop * DAYS;
    // Where Orion is on the path follows a distance-vs-time model (see orbital3d.js): first day in high Earth orbit,
    // a fast climb after the burn on day 2, closest approach at day 5, then a coast that speeds up toward Earth.
    const km = day0 < 1.1 ? 71000 * smooth(day0 / 1.1) : day0 < 5.017 ? 71000 + 335771 * (1 - Math.pow(1 - (day0 - 1.1) / 3.917, 1.7)) : 406771 * (1 - Math.pow((day0 - 5.017) / (DAYS - 5.017), 1.8));
    const half = 0.04 + 0.46 * Math.min(1, Math.max(0, (km - 20000) / (406771 - 20000)));   // outbound curve parameter, 0 to 0.5
    const u = loop < FLY ? half : 1 - half;
    const pt = s => (s < 0.5 ? out(s * 2) : ret((s - 0.5) * 2));

    ctx.lineWidth = 2; ctx.lineCap = 'round';
    const steps = 140;
    for (let i = 0; i < steps; i++) {
      const s0 = u * i / steps, s1 = u * (i + 1) / steps, [a, b] = pt(s0), [c, d] = pt(s1);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.strokeStyle = `rgba(${RED},${0.15 + (i / steps) * 0.75})`; ctx.stroke();
    }
    const [ox, oy] = pt(u);
    const gl = ctx.createRadialGradient(ox, oy, 0, ox, oy, 14); gl.addColorStop(0, `rgba(${RED},0.7)`); gl.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(ox, oy, 14, 0, Math.PI * 2); ctx.fillStyle = gl; ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, 3.8, 0, Math.PI * 2); ctx.fillStyle = `rgb(${RED})`; ctx.fill();

    const day = loop * (9 + 1.5 / 24);
    text(ctx, 'EARTH', ex, ey + er + 22, { size: 10, align: 'center', color: 'rgba(130,180,255,0.75)' });
    text(ctx, 'MOON', mx, my + mr + 20, { size: 10, align: 'center', color: 'rgba(210,205,195,0.75)' });
    text(ctx, `DAY ${Math.floor(day) + 1}`, W * 0.5, H * 0.5 - 6, { size: 20, align: 'center', color: 'rgba(255,255,255,0.88)', weight: 500 });
    text(ctx, loop < 0.1 ? 'Launch and Earth orbit' : loop < 0.5 ? 'Outbound' : loop < 0.62 ? 'Lunar flyby' : loop < 0.96 ? 'Free return' : 'Splashdown', W * 0.5, H * 0.5 + 16, { size: 11, align: 'center', color: `rgba(${COOL},0.75)` });
    const near = smooth(1 - Math.abs(loop - FLY) / 0.08);
    text(ctx, '6,545 km above the far side', W - 14, P3[1] + mr * 2 + 26, { size: 10, align: 'right', color: `rgba(255,255,255,${0.25 + 0.7 * near})` });
    text(ctx, 'Farthest: 406,771 km from Earth', W * 0.5, H * 0.94, { size: 10, align: 'center', color: 'rgba(255,255,255,0.4)' });
  }

  // Artemis III: three vehicles in one orbit
  function drawLeoScene(ctx, W, H, t) {
    drawStarfield(ctx, W, H, 31);
    const SEQ = 48, ts = (t / 1000) % SEQ;
    const cx = W * 0.5, cy = H * 1.6, Re = H * 0.98, Ro = Re * 1.12;
    earth(ctx, cx, cy, Re);
    ctx.strokeStyle = `rgba(${RED},0.5)`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, Ro, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();

    const at = (xf, rOff = 0) => { // x fraction of width -> point on orbit plus tangent angle
      const a = -Math.PI / 2 + (xf * W - cx) / Ro, r = Ro + rOff;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a), a + Math.PI / 2];
    };
    const u = Math.max(1.35, Math.min(2.4, W / 290));          // glyph scale grows with the stage
    const bX = 0.5, sX = 0.22, dB = 35 * u / W, dS = 52 * u / W; // nose-to-tail docking distance in px, as a fraction of width
    const orionX = track([[0, 1.2], [6, 1.2], [13, bX + 0.2], [18, bX + dB], [25.5, bX + dB], [28, bX + 0.15], [31, bX - 0.02], [34, sX + 0.22], [37, sX + dS], [42.5, sX + dS], [46, sX + 0.3]], ts);
    const orionR = track([[0, 0], [26, 0], [28, 34], [34.5, 34], [37, 0], [43, 0], [47, -Re * 0.5]], ts);
    const oA = smooth((ts - 6) / 1.4) * (1 - smooth((ts - 45) / 2.5));
    const sA = smooth((ts - 22) / 1.6) * (1 - smooth((ts - 47.2) / 0.8));
    const bA = smooth(ts / 1.2) * (1 - smooth((ts - 47.2) / 0.8));

    const [bx, by, ba] = at(bX); vehicle(ctx, 'blue', bx, by - 14 * u, ba, u, bA);
    const [sx, sy, sa] = at(sX); vehicle(ctx, 'starship', sx, sy - 12 * u, sa, u, sA);
    const [ox, oy, oa] = at(orionX, orionR); vehicle(ctx, 'orion', ox, oy - 14 * u, oa, u, oA);

    const lab = (str, x, y, a, col) => a > 0.05 && text(ctx, str, x, y, { size: 10, align: 'center', color: `rgba(${col},${a * 0.9})` });
    lab('BLUE ORIGIN TEST ARTICLE', bx, by - 26 * u - 30, bA, COOL);
    lab('STARSHIP TEST ARTICLE', sx, sy - 26 * u - 18, sA, COOL);
    lab('ORION', ox, oy - 26 * u - 6, oA, RED);

    const docked = (a, b) => Math.abs(a - b) < 0.012 && oA > 0.9;
    const flash = docked(orionX, bX + dB) || docked(orionX, sX + dS);
    if (flash) { const pr = (t / 900) % 1, fx = docked(orionX, bX + dB) ? (bx + ox) / 2 : (sx + ox) / 2, fy = (docked(orionX, bX + dB) ? by : sy) - 14;
      ctx.beginPath(); ctx.arc(fx, fy, 6 + pr * 16, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${RED},${0.7 * (1 - pr)})`; ctx.lineWidth = 1.2; ctx.stroke(); }

    const steps = [[0, 'A Blue Origin lander test vehicle launches first.'], [6, 'SLS lifts four crew in Orion into the same orbit.'], [13, 'Orion closes in, then docks for about 2 days.'],
      [22, 'A Starship test article launches. It has a docking port, no crew cabin.'], [26, 'Orion undocks and flies to Starship for about 1 day.'], [43, 'Deorbit, entry, splashdown about two weeks after launch.']];
    let cap = steps[0][1]; steps.forEach(([s, c]) => { if (ts >= s) cap = c; });
    text(ctx, cap, W * 0.5, H * 0.14, { size: 13, align: 'center', color: 'rgba(255,255,255,0.88)', font: SANS });
    text(ctx, 'About 430 km up, inclined 33 degrees. Not to scale.', W * 0.5, H * 0.14 + 20, { size: 10, align: 'center', color: 'rgba(255,255,255,0.4)' });
  }

  // Fallback if the 3D model cannot load: Saturn V beside SLS
  function drawRocketsScene(ctx, W, H, t) {
    drawStarfield(ctx, W, H, 13);
    const prog = ease(t / 1400), ground = H * 0.86, maxH = H * 0.7;
    const svx = W * 0.3, slx = W * 0.7;
    const svh = maxH * (111 / 111) * prog, slh = maxH * (98 / 111) * prog;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(W * 0.1, ground); ctx.lineTo(W * 0.9, ground); ctx.stroke();
    ctx.fillStyle = `rgba(${WARM},0.85)`; ctx.fillRect(svx - 15, ground - svh, 30, svh);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; [0.28, 0.52, 0.74].forEach(f => ctx.fillRect(svx - 15, ground - svh * f - 4, 30, 8));
    ctx.fillStyle = 'rgba(232,236,240,0.92)'; ctx.fillRect(slx - 14, ground - slh, 28, slh);
    ctx.fillStyle = `rgba(${RED},0.85)`; ctx.fillRect(slx - 14, ground - slh * 0.62, 28, slh * 0.5);
    ctx.fillStyle = 'rgba(232,236,240,0.92)'; [-22, 22].forEach(dx => ctx.fillRect(slx + dx - 4, ground - slh * 0.5, 8, slh * 0.5));
    if (prog > 0.8) {
      text(ctx, '111 m', svx, ground - svh - 14, { size: 13, align: 'center', color: `rgba(${WARM},1)`, weight: 500 });
      text(ctx, '98 m', slx, ground - slh - 14, { size: 13, align: 'center', color: 'rgba(240,244,248,1)', weight: 500 });
      text(ctx, 'SATURN V', svx, ground + 22, { size: 11, align: 'center', color: `rgba(${WARM},0.9)` });
      text(ctx, 'SLS BLOCK 1', slx, ground + 22, { size: 11, align: 'center', color: 'rgba(240,244,248,0.9)' });
    }
  }

  // Fallback: Starship HLS beside Blue Moon Mark 2, to scale (52 m vs 16 m)
  function drawLandersScene(ctx, W, H, t) {
    drawStarfield(ctx, W, H, 77);
    const ground = H * 0.84, prog = ease(t / 1200), sx = W * 0.32, bx = W * 0.7;
    ctx.fillStyle = 'rgba(120,110,100,0.14)'; ctx.fillRect(0, ground, W, H - ground);
    const sh = H * 0.66 * prog, bh = sh * (16 / 52);
    const g = ctx.createLinearGradient(sx - 18, 0, sx + 18, 0); g.addColorStop(0, 'rgba(140,150,165,0.85)'); g.addColorStop(0.5, 'rgba(235,238,242,0.95)'); g.addColorStop(1, 'rgba(120,128,140,0.85)');
    ctx.fillStyle = g; ctx.fillRect(sx - 18, ground - sh, 36, sh);
    ctx.beginPath(); ctx.moveTo(sx - 18, ground - sh); ctx.quadraticCurveTo(sx, ground - sh - 34, sx + 18, ground - sh); ctx.fillStyle = 'rgba(220,224,230,0.95)'; ctx.fill();
    ctx.fillStyle = 'rgba(225,232,240,0.95)'; ctx.fillRect(bx - 26, ground - bh, 52, bh * 0.7);
    ctx.fillStyle = 'rgba(107,143,179,0.95)'; ctx.fillRect(bx - 30, ground - bh * 0.3, 60, bh * 0.3);
    if (prog > 0.8) {
      text(ctx, 'STARSHIP HLS', sx, ground + 22, { size: 11, align: 'center', color: 'rgba(235,238,242,0.9)' });
      text(ctx, '~52 m', sx, ground - sh - 42, { size: 12, align: 'center', color: 'rgba(255,255,255,0.7)' });
      text(ctx, 'BLUE MOON MK2', bx, ground + 22, { size: 11, align: 'center', color: 'rgba(200,220,240,0.9)' });
      text(ctx, '16 m', bx, ground - bh - 12, { size: 12, align: 'center', color: 'rgba(255,255,255,0.7)' });
    }
  }

  // The south polar region as a face-on Moon rotated 180 degrees (south up). Apollo sites use real coordinates.
  function drawLandingSiteScene(ctx, W, H, t) {
    const cx = W * 0.5, cy = H * 0.54, r = Math.min(W, H) * 0.36;
    const mg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
    mg.addColorStop(0, '#cfc7bb'); mg.addColorStop(0.55, '#9d958b'); mg.addColorStop(1, '#6a655d');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = mg; ctx.fill();

    [[0.05, -0.85, 0.2], [-0.3, -0.76, 0.13], [0.34, -0.78, 0.15], [-0.12, -0.94, 0.09], [0.2, -0.68, 0.1]].forEach(([px, py, pr]) => {
      ctx.beginPath(); ctx.arc(cx + px * r, cy + py * r, pr * r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(18,10,6,0.7)'; ctx.fill();
    });
    [[0.1, -0.15, 0.08, 0.6], [-0.3, 0.2, 0.06, 0.5], [0.4, -0.3, 0.05, 0.4], [-0.1, 0.45, 0.09, 0.45], [0.2, 0.35, 0.04, 0.5], [-0.45, -0.1, 0.07, 0.35]].forEach(([px, py, pr, a]) => {
      ctx.beginPath(); ctx.arc(cx + px * r, cy + py * r, pr * r, 0, Math.PI * 2); ctx.strokeStyle = `rgba(70,62,54,${a})`; ctx.lineWidth = 1; ctx.stroke();
    });

    // Apollo landing sites: [lat, lon, name]. South-up view: x = -sin(lon)cos(lat), y = +sin(lat)
    const sites = [[0.67, 23.47, 'A11'], [-3.0, -23.4, 'A12'], [-3.65, -17.5, 'A14'], [26.1, 3.6, 'A15'], [-8.97, 15.5, 'A16'], [20.2, 30.8, 'A17']];
    const a = ease((t - 600) / 500), d2r = Math.PI / 180;
    sites.forEach(([lat, lon, n]) => {
      const x = cx - r * Math.sin(lon * d2r) * Math.cos(lat * d2r), y = cy + r * Math.sin(lat * d2r);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = `rgba(${WARM},${a})`; ctx.fill();
      text(ctx, n, x, y - 7, { size: 8.5, align: 'center', color: `rgba(${WARM},${a * 0.8})` });
    });

    const shx = cx + 0.03 * r, shy = cy - 0.9 * r, shr = 0.1 * r, pulse = 0.65 + 0.35 * Math.sin(t / 650);
    ctx.beginPath(); ctx.arc(shx, shy, shr, 0, Math.PI * 2); ctx.fillStyle = 'rgba(12,7,4,0.9)'; ctx.fill();
    ctx.strokeStyle = `rgba(${RED},${pulse})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(shx, shy, shr + 7, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${RED},${pulse * 0.3})`; ctx.lineWidth = 1.2; ctx.stroke();

    text(ctx, 'SHACKLETON CRATER', shx + shr + 14, shy - 2, { size: 10.5, color: `rgba(${RED},0.95)`, weight: 500 });
    text(ctx, 'About 20 km wide, 4 km deep', shx + shr + 14, shy + 13, { size: 9.5, color: `rgba(${RED},0.7)` });
    text(ctx, 'Permanently shadowed regions', cx - r * 0.35, cy - r * 0.55, { size: 9.5, align: 'center', color: 'rgba(200,185,170,0.6)' });
    text(ctx, 'Apollo sites (equatorial)', cx, cy + r * 0.62, { size: 9.5, align: 'center', color: `rgba(${WARM},${a * 0.6})` });
    text(ctx, 'SOUTH POLE', cx, cy - r - 12, { size: 10, align: 'center', color: 'rgba(255,255,255,0.4)' });
    text(ctx, 'Near side, south up', cx, cy + r + 20, { size: 10, align: 'center', color: 'rgba(255,255,255,0.3)' });
  }

  // The road from Artemis I to a base, including the station that was cancelled
  function drawProgramScene(ctx, W, H, t) {
    drawStarfield(ctx, W, H, 58);
    const x0 = W * 0.11, x1 = W * 0.89, cy = H * 0.52;
    const nodes = [['I', 'Nov 2022', ['Uncrewed', 'flyby'], 'done'], ['II', 'Apr 2026', ['Crew', 'flyby'], 'done'], ['III', 'NET Jun 2027', ['Orbit docking', 'test'], 'next'], ['IV', 'Early 2028', ['First', 'landing'], 'plan'], ['V', 'Late 2028', ['Second landing,', 'base work'], 'plan']];
    const px = i => lerp(x0, x1, i / 4), py = i => cy + Math.sin(i * 1.1) * H * 0.07;
    const p = ease(t / 2200);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const f = i / 80 * 4, x = lerp(x0, x1, f / 4), y = cy + Math.sin(f * 1.1) * H * 0.07; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.strokeStyle = `rgb(${BLUE})`; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const f = i / 40 * 2; if (f / 4 > p) break; const x = lerp(x0, x1, f / 4), y = cy + Math.sin(f * 1.1) * H * 0.07; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();

    // Cancelled Gateway station, shown as a struck-through ghost between IV and V
    const gx = lerp(px(3), px(4), 0.5), gy = py(3.5) - H * 0.2, ga = ease((t - 1800) / 600);
    ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = `rgba(${COOL},${0.5 * ga})`; ctx.beginPath(); ctx.arc(gx, gy, 14, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = `rgba(229,118,111,${0.8 * ga})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx - 10, gy + 10); ctx.lineTo(gx + 10, gy - 10); ctx.stroke();
    text(ctx, 'Lunar Gateway', gx, gy - 26, { size: 10, align: 'center', color: `rgba(${COOL},${0.85 * ga})` });
    text(ctx, 'cancelled Mar 2026', gx, gy - 13 + 52, { size: 9.5, align: 'center', color: `rgba(229,118,111,${0.85 * ga})` });

    nodes.forEach(([n, when, what, st], i) => {
      const a = ease((t - 400 - i * 300) / 500); if (a <= 0) return;
      const x = px(i), y = py(i);
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2);
      if (st === 'done') { ctx.fillStyle = `rgba(${BLUE},${a})`; ctx.fill(); } else { ctx.fillStyle = `rgba(10,12,16,${a})`; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${st === 'next' ? RED : COOL},${a})`; ctx.stroke(); }
      if (st === 'next') { const pr = (t / 1900) % 1; ctx.beginPath(); ctx.arc(x, y, 11 + pr * 16, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${RED},${0.55 * (1 - pr) * a})`; ctx.lineWidth = 1; ctx.stroke(); }
      text(ctx, n, x, y + 4, { size: 11, align: 'center', weight: 600, color: st === 'done' ? `rgba(6,20,43,${a})` : `rgba(${st === 'next' ? RED : COOL},${a})` });
      text(ctx, when, x, y + 34, { size: 10.5, align: 'center', color: `rgba(255,255,255,${a * 0.85})` });
      what.forEach((ln, k) => text(ctx, ln, x, y + 49 + k * 12, { size: 9.5, align: 'center', color: `rgba(255,255,255,${a * 0.5})` }));
    });
  }

  // The DSN from above the pole: three complexes, at least one always faces the Moon
  function drawDSNScene(ctx, W, H, t) {
    drawStarfield(ctx, W, H, 22);
    const R = Math.min(W, H) * 0.23, ex = W * 0.38, ey = H * 0.48, mx = W * 0.9, my = H * 0.48;
    earth(ctx, ex, ey, R);
    moon(ctx, mx, my, R * 0.16);
    text(ctx, 'MOON', mx, my + R * 0.16 + 18, { size: 10, align: 'center', color: 'rgba(210,205,195,0.7)' });

    const phi = (t / 1000) * 0.17;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const a = phi + k * Math.PI / 6; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + R * Math.cos(a), ey + R * Math.sin(a)); ctx.stroke(); }
    [0.5, 0.8].forEach(f => { ctx.beginPath(); ctx.arc(ex, ey, R * f, 0, Math.PI * 2); ctx.stroke(); });

    const st = [['GOLDSTONE', -116.8, 35.4], ['MADRID', -4.2, 40.4], ['CANBERRA', 148.9, -35.4]];
    let visible = 0;
    st.forEach(([name, lon, lat], i) => {
      const a = phi + lon * Math.PI / 180, rr = R * Math.cos(lat * Math.PI / 180);
      const x = ex + rr * Math.cos(a), y = ey + rr * Math.sin(a), sees = Math.cos(a) > 0.05;
      if (sees) {
        visible++;
        ctx.save(); ctx.setLineDash([3, 6]); ctx.strokeStyle = `rgba(${BLUE},0.35)`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.stroke(); ctx.restore();
        const pr = ((t / 1400) + i * 0.33) % 1;
        ctx.beginPath(); ctx.arc(lerp(x, mx, pr), lerp(y, my, pr), 2.6, 0, Math.PI * 2); ctx.fillStyle = `rgba(${BLUE},${0.9 - pr * 0.6})`; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = sees ? `rgb(${BLUE})` : 'rgba(255,255,255,0.45)'; ctx.fill();
      const out = Math.cos(a) >= 0 ? 1 : -1;
      text(ctx, name, x + 12 * Math.sign(Math.cos(a) || 1), y + 4, { size: 9.5, align: Math.cos(a) >= 0 ? 'left' : 'right', color: sees ? `rgba(${BLUE},0.95)` : 'rgba(255,255,255,0.45)' });
    });
    text(ctx, `${visible} of 3 complexes can see the Moon right now`, W * 0.5, H * 0.92, { size: 11.5, align: 'center', color: 'rgba(255,255,255,0.7)', font: SANS });
    text(ctx, 'Schematic view from above the pole', W * 0.5, H * 0.92 + 18, { size: 9.5, align: 'center', color: 'rgba(255,255,255,0.35)' });
  }


  // ── Real Moon globe: LRO imagery on a sphere, with the south pole drawn on top ───────────────────
  // Base map: LRO WAC global mosaic (NASA/GSFC/ASU), tiles from NASA Moon Trek, stitched to 3072 px.
  // Pole: LROC WAC south pole mosaic (PIA13523), polar stereographic, 600 km across, fitted over the
  // pole with its own UVs so every label sits at its true latitude and longitude (within a few km).
  const Globe = (() => {
    const R_KM = 1737.4, CAP_KM = 300;
    const d2r = Math.PI / 180;
    // [name, lat, lon, kind, note]. kind: hero (Shackleton), cand (in NASA's 2022 candidate regions), ref (reference)
    const PLACES = [
      ['Shackleton',  -89.9,    0,    'hero', 'Sunlit rim, permanently dark floor', 'b'],
      ['de Gerlache', -88.5,  -87.1,  'cand', 'Candidate landing region', 'l'],
      ['Haworth',     -86.9,   -4.0,  'cand', 'Candidate landing region', 'r'],
      ['Faustini',    -87.3,   77.0,  'cand', 'Candidate landing region', 'b'],
      ['Malapert',    -84.9,   12.9,  'cand', 'Candidate landing region (massif)', 'r'],
      ['Nobile',      -85.28,  53.27, 'cand', 'Candidate landing region', 'r'],
      ['Amundsen',    -84.5,   82.8,  'cand', 'Candidate landing region', 'l'],
      ['Shoemaker',   -88.1,   44.9,  'ref',  'Deep, permanently shadowed crater', 'r'],
      ['Cabeus',      -84.9,  -35.5,  'ref',  'LCROSS found water here in 2009', 'l'],
    ];
    let renderer, scene, camera, host, labelsLayer, raf = 0, built = false, failed = false;
    const view = { a: 0.06, b: 0, r: 1.4, ta: 0.06, tb: 0, tr: 1.4 };  // tilt from the pole, azimuth, distance (and their targets)
    let introStart = 0, userTouched = false;
    const labelEls = [];

    // East is -Z and longitude 0 faces +X, which is how THREE.SphereGeometry lays out an equirectangular map
    const at = (lat, lon, r = 1) => new THREE.Vector3(r * Math.cos(lat * d2r) * Math.cos(lon * d2r), r * Math.sin(lat * d2r), -r * Math.cos(lat * d2r) * Math.sin(lon * d2r));

    function capGeometry() {
      const N = 48, M = 160, capA = 2 * Math.atan(CAP_KM / (2 * R_KM));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const c = capA * i / N, rho = 2 * R_KM * Math.tan(c / 2);
        for (let j = 0; j <= M; j++) {
          const lon = 2 * Math.PI * j / M, v = at(-90 + c / d2r, lon / d2r, 1.0015);
          pos.push(v.x, v.y, v.z);
          uv.push(0.5 + rho * Math.sin(lon) / (2 * CAP_KM), 0.5 + rho * Math.cos(lon) / (2 * CAP_KM));
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // computeVertexNormals on a patch is fine, but use the exact sphere normals so lighting matches the globe
      const n = g.attributes.position.clone().normalize ? null : null;
      const nrm = []; for (let i = 0; i < pos.length; i += 3) { const l = Math.hypot(pos[i], pos[i + 1], pos[i + 2]); nrm.push(pos[i] / l, pos[i + 1] / l, pos[i + 2] / l); }
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      return g;
    }

    function fadeTexture() { // opaque in the middle, transparent at the mosaic's edge, so the cap melts into the globe
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, '#fff'); g.addColorStop(0.78, '#fff'); g.addColorStop(0.97, '#000'); g.addColorStop(1, '#000');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    }

    function build() {
      built = true;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (e) { failed = true; return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      renderer.domElement.className = 'globe-canvas';
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D Moon centered on the south pole. Drag to tilt, scroll to zoom.');

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
      scene.add(camera);
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const head = new THREE.DirectionalLight(0xffffff, 0.6); head.position.set(0.35, 0.55, 1); camera.add(head); // headlight: the visible face is always lit

      const L = new THREE.TextureLoader(), maxA = renderer.capabilities.getMaxAnisotropy();
      const tex = (url, color = true) => { const t = L.load(url); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxA; return t; };
      const base = tex('assets/textures/moon_wac_3k.jpg'), pole = tex('assets/textures/moon_south_pole_600km.jpg');

      const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96),
        new THREE.MeshLambertMaterial({ map: base }));
      scene.add(moon);
      const cap = new THREE.Mesh(capGeometry(),
        new THREE.MeshLambertMaterial({ map: pole, alphaMap: fadeTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      cap.renderOrder = 1;
      scene.add(cap);

      labelsLayer = document.createElement('div'); labelsLayer.className = 'globe-labels'; host.appendChild(labelsLayer);
      PLACES.forEach(([name, lat, lon, kind, note, side]) => {
        const el = document.createElement('div');
        el.className = `globe-label ${kind} side-${side}`; el.innerHTML = `<span>${name}</span>`; el.title = `${name}: ${note}`;
        labelsLayer.appendChild(el); labelEls.push({ el, v: at(lat, lon, 1.004) });
      });

      const reset = document.createElement('button');
      reset.type = 'button'; reset.className = 'globe-reset'; reset.innerHTML = '<i class="ph ph-crosshair" aria-hidden="true"></i>South pole';
      reset.onclick = () => { userTouched = true; Object.assign(view, { ta: 0.06, tb: 0, tr: 1.4 }); };
      host.appendChild(reset);

      const dom = renderer.domElement; let lx = 0, ly = 0, drag = false;
      dom.addEventListener('pointerdown', e => { drag = true; userTouched = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); });
      dom.addEventListener('pointermove', e => {
        if (!drag) return;
        view.tb -= (e.clientX - lx) * 0.006; view.ta = Math.max(0, Math.min(1.5, view.ta + (e.clientY - ly) * 0.006));
        view.b = view.tb; view.a = view.ta; lx = e.clientX; ly = e.clientY;
      });
      const end = e => { drag = false; try { dom.releasePointerCapture(e.pointerId); } catch {} };
      dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', end);
      dom.addEventListener('wheel', e => { e.preventDefault(); userTouched = true; view.tr = Math.max(1.12, Math.min(4.6, view.tr * (1 + Math.sign(e.deltaY) * 0.09))); }, { passive: false });
      dom.style.cursor = 'grab';

      if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    }

    function resize() {
      if (!renderer) return;
      const w = Math.max(host.clientWidth, 2), h = Math.max(host.clientHeight, 2);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!userTouched && !reduce.matches) { // fly in from the whole Moon to the pole
        const t = ease((now - introStart) / 4200);
        view.a = lerp(1.15, view.ta, t); view.b = lerp(0.9, view.tb, t); view.r = lerp(4.4, view.tr, t);
      } else {                          // ease toward wherever the user asked to be
        view.a += (view.ta - view.a) * 0.12; view.b += (view.tb - view.b) * 0.12; view.r += (view.tr - view.r) * 0.12;
      }
      const a = view.a, b = view.b, r = view.r;
      camera.position.set(r * Math.sin(a) * Math.cos(b), -r * Math.cos(a), -r * Math.sin(a) * Math.sin(b));
      camera.up.set(Math.cos(b), 0, -Math.sin(b));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);

      // Labels follow the surface; hide the ones on the far side, and all of them when zoomed far out
      const w = host.clientWidth, h = host.clientHeight, show = r < 1.9, cn = camera.position.clone().normalize(), horizon = 1 / r + 0.04;
      labelEls.forEach(({ el, v }) => {
        const vis = show && v.clone().normalize().dot(cn) > horizon;
        const p = v.clone().project(camera);
        const x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
        const on = vis && p.x > -1 && p.x < 1 && p.y > -1 && p.y < 1;
        el.style.opacity = on ? '1' : '0';
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
    }

    function show(container) {
      host = container;
      if (!built) build();
      if (failed) return false;
      host.style.display = 'block';
      resize();
      userTouched = false; introStart = performance.now();
      Object.assign(view, { a: 1.15, b: 0.9, r: 4.4, ta: 0.06, tb: 0, tr: 1.4 });
      if (reduce.matches) { Object.assign(view, { a: 0.06, b: 0, r: 1.4 }); userTouched = true; }
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      return true;
    }
    function hide() { cancelAnimationFrame(raf); raf = 0; if (host) host.style.display = 'none'; }
    return { show, hide };
  })();

  // ── Scenes ─────────────────────────────────────────────────────────────────
  const SCENES = [
    {
      chapter: 'The gap', title: '53 years since the last footprints',
      bg: { id: 'as17-134-20481', credit: 'Apollo 17 commander Gene Cernan at the lunar module ladder, Dec 1972. NASA' },
      text: [
        'In December 1972 Gene Cernan climbed the ladder of Apollo 17\'s lander and became the last person to stand on the Moon. The program ended over budget and politics, not engineering.',
        'For more than half a century only robots visited. In April 2026 people went back, but only around it. <strong>The footprints are still to come.</strong>',
      ],
      stats: [
        { label: 'Years since the last Moon landing', val: '53', sub: 'Dec 1972 to Sep 2026. The next one is planned for 2028.' },
        { label: 'Apollo astronauts who walked on the Moon', val: '12', sub: 'All American men' },
        { label: 'Lunar samples returned by Apollo', val: '382', unit: 'kg', sub: 'Still being studied' },
        { label: 'First Artemis landing', val: '2028', sub: 'Artemis IV, planned early 2028' },
      ],
      draw: drawTimelineScene,
    },
    {
      chapter: 'April 2026', title: 'Artemis II flew around the Moon',
      bg: { id: 'art002e021278', credit: '"A Breathtaking Earthset from Orion," Artemis II crew, Apr 6, 2026. NASA' },
      text: [
        'On April 1, 2026, Reid Wiseman, Victor Glover, Christina Koch and Canada\'s Jeremy Hansen lifted off on the Space Launch System. Their Orion capsule was named Integrity.',
        'Nine days later they splashed down off San Diego. On the way they passed <strong>6,545 km above the far side of the Moon</strong> and reached 406,771 km from Earth, farther than any human has gone. Apollo 13\'s record had stood for 56 years.',
      ],
      stats: [
        { label: 'Farthest from Earth', val: '406,771', unit: 'km', sub: 'Beat Apollo 13 by about 6,600 km' },
        { label: 'Closest pass over the far side', val: '6,545', unit: 'km', sub: '40 minutes without signal' },
        { label: 'Mission length', val: '9 d 1 h', sub: 'Apr 1 to Apr 11, 2026 UTC' },
        { label: 'Crew', val: '4', sub: 'Wiseman, Glover, Koch, Hansen' },
      ],
      draw: drawFlybyScene,
    },
    {
      chapter: 'The new plan', title: 'Artemis III is a rehearsal, not a landing',
      bg: { id: 'MK2_EOR_ArtemisIII_Dock', credit: 'Artist\'s concept: Orion docking with a Blue Moon test article. Blue Origin' },
      text: [
        'In February 2026 NASA reshuffled the program. The landers are not ready, so <strong>Artemis III became a test in Earth orbit</strong> and the first landing moved to Artemis IV.',
        'Three rockets launch into one orbit: a Blue Origin lander test article, then SLS with four astronauts in Orion, then a SpaceX Starship test article. Orion docks with each. The crew climbs into the Blue Origin cabin to test its systems and its spacesuit connections.',
        'Staying in Earth orbit keeps the crew close to home if a docking goes wrong.',
      ],
      stats: [
        { label: 'Launch target', val: 'NET Jun 2027', sub: 'Reported about 90 days behind' },
        { label: 'Launches in one mission', val: '3', sub: 'Blue Origin, SLS, Starship' },
        { label: 'Orbit altitude', val: '430', unit: 'km', sub: 'Inclined 33 degrees' },
        { label: 'Mission length', val: '~2', unit: 'weeks', sub: 'Splashdown off San Diego' },
      ],
      draw: drawLeoScene,
    },
    {
      chapter: 'The rocket', title: 'The most thrust, half the reach',
      bg: { id: 'KSC-04012026-Artemis II_Launch-1', credit: 'Artemis II lifts off from Launch Complex 39B, Apr 1, 2026. NASA/Brandon Hancock' },
      text: [
        'Apollo flew on Saturn V: 111 m tall, able to throw 48.6 tonnes toward the Moon.',
        'Artemis uses the <strong>Space Launch System</strong>. At 98 m it has more liftoff thrust than any rocket that has carried people, but it sends only 27 tonnes toward the Moon. That is why the landers fly on their own rockets.',
        'In February 2026 NASA cancelled the larger Block 1B and Block 2 versions to keep a single configuration, Block 1.',
      ],
      compare: {
        left:  { label: 'Saturn V', tone: 'warm', rows: [['Height', '111 m'], ['Liftoff thrust', '35 MN'], ['To the Moon', '48.6 t'], ['Crew', '3'], ['Flights', '13'], ['First flight', '1967']] },
        right: { label: 'SLS Block 1', tone: 'red', rows: [['Height', '98 m'], ['Liftoff thrust', '39 MN'], ['To the Moon', '27 t'], ['Crew', '4'], ['Flights', '2'], ['First flight', '2022']] },
      },
      draw: drawRocketsScene, model: 'sls', modelLabel: 'Space Launch System',
    },
    {
      chapter: 'The landers', title: 'Two landers, one seat',
      bg: { id: '11 03 24  orion transfer', credit: 'Artist\'s concept of Starship HLS. SpaceX' },
      text: [
        'NASA chose competition. SpaceX\'s Starship HLS won in 2021 and Blue Origin\'s Blue Moon was added in 2023. Both must dock with Orion on Artemis III before either carries astronauts down, and the one that is ready first flies Artemis IV.',
        '<strong>Starship HLS</strong> is about 52 m tall and designed to put roughly 100 tonnes on the surface. It has to be refueled in orbit, a step SpaceX has not yet demonstrated.',
        '<strong>Blue Moon Mark 2</strong> is 16 m tall, burns hydrogen and oxygen and is built for stays of up to 30 days. A smaller cargo lander, Mark 1, goes first as a pathfinder, targeted for 2027.',
      ],
      compare: {
        left:  { label: 'Starship HLS', tone: 'steel', rows: [['Height', '~52 m'], ['Diameter', '9 m'], ['Propellant', 'Methane, oxygen'], ['To the surface', '~100 t'], ['Selected', '2021']] },
        right: { label: 'Blue Moon Mark 2', tone: 'blue', rows: [['Height', '16 m'], ['Engines', '3 × BE-7'], ['Propellant', 'Hydrogen, oxygen'], ['Surface stay', 'Up to 30 days'], ['Selected', '2023']] },
      },
      draw: drawLandersScene, model: 'starship', modelLabel: 'Starship, the ship that becomes HLS',
    },
    {
      chapter: 'The destination', title: 'The Moon\'s south pole',
      bg: { id: 'art002e009287', credit: 'Earthset over the lunar limb, Artemis II, Apr 6, 2026. NASA' },
      text: [
        'Apollo landed near the equator. Artemis goes to the <strong>south pole</strong>, where craters like Shackleton have rims in near-constant sunlight while their floors have been dark for billions of years.',
        'Those permanently shadowed regions hold water ice. NASA\'s LCROSS probe found water there in 2009. Ice means drinking water, breathable oxygen and rocket fuel, the reasons a base is possible at all.',
        'In 2022 NASA named 13 candidate landing regions around the pole, each about 15 km across, back when the landing was planned for Artemis III.',
      ],
      stats: [
        { label: 'Shackleton Crater width', val: '~20', unit: 'km', sub: 'About 4 km deep' },
        { label: 'Latitude of Shackleton', val: '89.9°', unit: 'S', sub: 'Almost exactly at the pole' },
        { label: 'Water ice found by LCROSS', val: '2009', sub: 'Impact in Cabeus crater' },
        { label: 'Candidate landing regions', val: '13', sub: 'Named by NASA in Aug 2022' },
      ],
      draw: drawLandingSiteScene, globe: true,
      globeLabel: 'Real LRO imagery (NASA/GSFC/ASU). Drag to tilt, scroll to zoom. Red rings mark candidate regions.',
    },
    {
      chapter: 'Staying', title: 'From flags and footprints to a base',
      bg: { id: 'KSC-20260709-PH-JBS02_0026', credit: 'Artemis III booster segment arrives at the Vehicle Assembly Building, Jul 9, 2026. NASA/Ben Smegelsky' },
      text: [
        'Apollo visited. Artemis wants to stay. In March 2026 NASA cancelled the Lunar Gateway, the planned station in lunar orbit, and moved its focus to a base on the surface.',
        'Artemis V, planned for late 2028, is expected to begin that work. Behind it is an international effort: as of September 26, 2026, <strong>76 countries</strong> have signed the Artemis Accords, a set of principles for peaceful exploration.',
        'The hardware is being stacked right now. The first real test comes in orbit.',
      ],
      stats: [
        { label: 'Countries in the Artemis Accords', val: '76', sub: 'As of Sep 26, 2026' },
        { label: 'Lunar Gateway cancelled', val: 'Mar 2026', sub: 'Focus moves to the surface' },
        { label: 'Artemis V', val: 'Late 2028', sub: 'Second landing, first base work' },
        { label: 'Artemis III boosters', val: 'Stacking', sub: 'Began Jul 13, 2026 in the VAB' },
      ],
      draw: drawProgramScene,
    },
    {
      chapter: 'The network', title: 'Staying in touch',
      bg: { id: 'PIA26147', credit: 'Six antennas at the Madrid complex arrayed for the first time, Apr 2024. NASA/JPL, MDSCC/INTA' },
      text: [
        'Every message to and from deep space passes through NASA\'s <strong>Deep Space Network</strong>: three sites spread roughly 120° apart, at Goldstone in California, Madrid in Spain and Canberra in Australia. One of them always faces the Moon.',
        'Each site has a 70 m dish plus several 34 m dishes. A signal from the Moon takes about 1.28 seconds to arrive.',
        'Artemis II also tested laser communication. Orion\'s optical terminal sent data to ground stations in California and New Mexico, a preview of faster links on later missions.',
      ],
      stats: [
        { label: 'DSN complexes', val: '3', sub: 'Goldstone, Madrid, Canberra' },
        { label: 'Spacing', val: '~120°', sub: 'Continuous sky coverage' },
        { label: 'Largest dish', val: '70', unit: 'm', sub: 'One at each complex' },
        { label: 'One-way light time to the Moon', val: '1.28', unit: 's', sub: 'At the average distance' },
      ],
      draw: drawDSNScene,
    },
  ];

  // ── Engine ─────────────────────────────────────────────────────────────────
  let current = 0, animId = null, startT = null, overlay = null, stCanvas = null, stCtx = null;
  let lastFocus = null, modelManifest = null, bgLayer = 0, touchX = null;

  const $ = id => document.getElementById(id);

  function build() {
    if ($('story-overlay')) return;

    const openBtn = document.createElement('button');
    openBtn.id = 'story-open-btn'; openBtn.className = 'tb-exhibit'; openBtn.type = 'button';
    openBtn.innerHTML = '<i class="ph ph-book-open" aria-hidden="true"></i><span class="tb-label">Story</span>';
    openBtn.onclick = () => open(0);
    ($('exhibit-nav') || document.body).appendChild(openBtn);

    overlay = document.createElement('div');
    overlay.id = 'story-overlay';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'The Artemis story');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="story-bg" id="story-bg-a"></div><div class="story-bg" id="story-bg-b"></div>
      <div class="story-scrim"></div>
      <header class="story-header">
        <span class="story-logo">The Artemis story</span>
        <div class="story-progress" aria-hidden="true"><div class="story-progress-fill" id="sp-fill"></div></div>
        <button class="story-close-btn" id="story-close" type="button" aria-label="Close story"><i class="ph ph-x" aria-hidden="true"></i></button>
      </header>
      <div class="story-body-wrap">
        <nav class="story-chapters" id="story-chapters" aria-label="Chapters"></nav>
        <div class="story-left" id="story-left" tabindex="-1"></div>
        <div class="story-right">
          <div class="story-stage">
            <canvas id="story-canvas" aria-hidden="true"></canvas>
            <div class="story-model" id="story-model"></div>
            <div class="story-globe" id="story-globe"></div>
            <div class="story-globe-cap" id="story-globe-cap"></div>
          </div>
          <div class="story-credit" id="story-credit"></div>
        </div>
      </div>
      <div class="story-nav">
        <button class="story-nav-btn" id="story-prev" type="button"><i class="ph ph-arrow-left" aria-hidden="true"></i>Previous</button>
        <div class="story-dots" id="story-dots" aria-hidden="true"></div>
        <button class="story-nav-btn primary" id="story-next" type="button">Next<i class="ph ph-arrow-right" aria-hidden="true"></i></button>
      </div>`;
    document.body.appendChild(overlay);

    stCanvas = $('story-canvas'); stCtx = stCanvas.getContext('2d');

    const chap = $('story-chapters'), dots = $('story-dots');
    SCENES.forEach((s, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'story-chap';
      b.innerHTML = `<span class="story-chap-n">${String(i + 1).padStart(2, '0')}</span><span class="story-chap-t">${s.chapter}</span>`;
      b.onclick = () => goTo(i); chap.appendChild(b);
      const d = document.createElement('button'); d.type = 'button'; d.className = 'story-dot'; d.setAttribute('aria-label', `Chapter ${i + 1}: ${s.chapter}`);
      d.onclick = () => goTo(i); dots.appendChild(d);
    });

    $('story-close').onclick = close;
    $('story-prev').onclick = () => goTo(current - 1);
    $('story-next').onclick = () => goTo(current + 1);
    overlay.addEventListener('keydown', onKey);
    overlay.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', e => {
      if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 70) goTo(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
    window.addEventListener('resize', () => { if (overlay.classList.contains('active') && reduce.matches && stCanvas.style.display !== 'none') paint(6000); });

    loadModelManifest();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = [...overlay.querySelectorAll('button:not([disabled]), model-viewer, [tabindex="0"]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.target.closest?.('model-viewer')) return; // model-viewer owns the arrow keys while focused
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(current - 1); }
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(SCENES.length - 1);
  }

  function open(n = 0) {
    build();
    lastFocus = document.activeElement;
    overlay.classList.add('active'); overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderScene(n, 0, true);
    setTimeout(() => $('story-next')?.focus({ preventScroll: true }), 50);
  }

  function close() {
    overlay.classList.remove('active'); overlay.setAttribute('aria-hidden', 'true');
    cancelAnimationFrame(animId); animId = null;
    Globe.hide();
    document.body.style.overflow = '';
    hideModel();
    lastFocus?.focus?.({ preventScroll: true });
  }

  let busy = false;
  function goTo(n) {
    if (n < 0 || n >= SCENES.length || n === current || busy) return;
    const dir = n > current ? 1 : -1;
    if (reduce.matches) { renderScene(n, dir, true); return; }
    busy = true;
    overlay.dataset.dir = dir > 0 ? 'next' : 'prev';
    overlay.classList.add('leaving');
    setTimeout(() => {
      overlay.classList.remove('leaving');
      renderScene(n, dir, false);
      busy = false;
    }, 280);
  }

  // Count numeric stats up once per scene
  function countUp(el, raw) {
    const m = raw.match(/^(\d[\d,]*)(\.\d+)?$/);
    if (!m || reduce.matches) return;
    const dec = m[2] ? m[2].length - 1 : 0, target = parseFloat(raw.replace(/,/g, ''));
    const t0 = performance.now(), dur = 1100;
    (function tick(now) {
      const p = clamp01((now - t0) / dur), v = target * (1 - Math.pow(1 - p, 3));
      el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (p < 1) requestAnimationFrame(tick); else el.textContent = raw;
    })(t0);
  }

  function renderScene(n, dir, immediate) {
    current = n;
    const sc = SCENES[n];
    overlay.dataset.dir = dir >= 0 ? 'next' : 'prev';

    setBackground(sc.bg);
    if (SCENES[n + 1]?.bg) new Image().src = nasaImg(SCENES[n + 1].bg.id);

    let html = `<h2 class="story-title" style="--k:0">${sc.title}</h2>`;
    html += sc.text.map((p, i) => `<p class="story-text" style="--k:${i + 1}">${p}</p>`).join('');
    const k0 = sc.text.length + 1;

    if (sc.compare) {
      const col = c => `<div class="cmp-col ${c.tone}"><div class="cmp-mission">${c.label}</div>${c.rows.map(([k, v]) => `<div class="cmp-row"><span class="cmp-key">${k}</span><span class="cmp-val">${v}</span></div>`).join('')}</div>`;
      html += `<div class="story-compare" style="--k:${k0}">${col(sc.compare.left)}${col(sc.compare.right)}</div>`;
    }
    if (sc.stats) {
      html += `<div class="story-stats">${sc.stats.map((s, i) => `
        <div class="story-stat${i === 0 ? ' feature' : ''}" style="--k:${k0 + i}">
          <div class="stat-label">${s.label}</div>
          <div class="stat-val"><span class="stat-num" data-raw="${s.val}">${s.val}</span>${s.unit ? `<span class="stat-unit">${s.unit}</span>` : ''}</div>
          ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
        </div>`).join('')}</div>`;
    }
    $('story-left').innerHTML = html;
    $('story-left').scrollTop = 0;
    $('story-left').querySelectorAll('.stat-num').forEach(el => setTimeout(() => countUp(el, el.dataset.raw), 350));

    $('sp-fill').style.transform = `scaleX(${(n + 1) / SCENES.length})`;
    document.querySelectorAll('.story-dot').forEach((d, i) => d.classList.toggle('active', i === n));
    document.querySelectorAll('.story-chap').forEach((c, i) => { c.classList.toggle('active', i === n); c.classList.toggle('done', i < n); if (i === n) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current'); });
    $('story-prev').disabled = n === 0;
    $('story-next').disabled = n === SCENES.length - 1;

    // Re-trigger the entrance animation
    overlay.classList.remove('entering'); void overlay.offsetWidth; overlay.classList.add('entering');

    cancelAnimationFrame(animId); startT = null;
    Globe.hide(); $('story-globe-cap').textContent = '';
    if (sc.globe && $('story-globe') && typeof THREE !== 'undefined') {
      hideModel();
      $('story-canvas').style.display = 'none';
      if (Globe.show($('story-globe'))) { $('story-globe-cap').textContent = sc.globeLabel || ''; return; }
      $('story-canvas').style.display = 'block';
    }
    if (sc.model && modelManifest?.includes(sc.model)) { showModel(sc); return; }
    hideModel();
    (function loop(ts) {
      if (!startT) startT = ts;
      paint(reduce.matches ? 6000 : ts - startT);   // reduced motion: one settled frame instead of animation
      if (!reduce.matches) animId = requestAnimationFrame(loop);
    })(performance.now());
  }

  function paint(t) {
    sizeCanvas();
    const W = stCanvas.clientWidth, H = stCanvas.clientHeight;
    stCtx.clearRect(0, 0, W, H);
    SCENES[current].draw(stCtx, W, H, t);
  }

  function sizeCanvas() {
    const r = stCanvas.parentElement.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(r.width), h = Math.floor(r.height);
    if (stCanvas.width !== w * dpr || stCanvas.height !== h * dpr) { stCanvas.width = w * dpr; stCanvas.height = h * dpr; }
    stCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Cross-fading photo backdrop with a slow push-in
  function setBackground(bg) {
    const cr = $('story-credit');
    if (!bg) return;
    const url = nasaImg(bg.id), layers = [$('story-bg-a'), $('story-bg-b')];
    const img = new Image();
    img.onload = () => {
      bgLayer = 1 - bgLayer;
      const on = layers[bgLayer], off = layers[1 - bgLayer];
      on.style.backgroundImage = `url("${url}")`;
      on.classList.remove('zoom'); void on.offsetWidth; on.classList.add('show', 'zoom');
      off.classList.remove('show');
    };
    img.src = url;
    if (cr) cr.textContent = bg.credit;
  }

  // ── 3D models inside chapters ──────────────────────────────────────────────
  async function loadModelManifest() {
    if (modelManifest) return modelManifest;
    try { const r = await fetch('assets/models/manifest.json', { cache: 'no-cache' }); modelManifest = r.ok ? await r.json() : []; }
    catch { modelManifest = []; }
    return modelManifest;
  }

  function showModel(sc) {
    const wrap = $('story-model'), cv = $('story-canvas');
    cv.style.display = 'none'; wrap.style.display = 'block';
    wrap.innerHTML = `
      <model-viewer src="assets/models/${sc.model}/scene.gltf" alt="3D model of ${sc.modelLabel}"
        camera-controls ${reduce.matches ? '' : 'auto-rotate rotation-per-second="20deg"'} interaction-prompt="none"
        shadow-intensity="1.1" exposure="1.15" environment-image="neutral" loading="eager" reveal="auto"
        style="width:100%;height:100%;background:transparent;">
        <div slot="poster" class="story-model-poster">Loading model</div>
      </model-viewer>
      <div class="story-model-cap">${sc.modelLabel}. Drag to inspect.</div>`;
  }
  function hideModel() {
    const wrap = $('story-model'), cv = $('story-canvas');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
    if (cv) cv.style.display = 'block';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  return { open, close };
})();
