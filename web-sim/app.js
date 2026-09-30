// Artemis Mission Control: main controller.
// Wires together the 3D stage, mission data, DSN, providers, auth, countdown and ephemeris.

const App = (() => {

  // No launch time exists yet. Set this to a real Date once NASA announces one; Mission.start() and the
  // countdown then switch from "NET" mode to a live T-minus / T-plus clock.
  const LAUNCH_DATE = null;

  const C_KM_S = 299_792.458;

  // ── Countdown ──────────────────────────────────────────────────────────────
  const pad = n => String(n).padStart(2, '0');

  function updateCountdown() {
    const label = document.getElementById('cd-label');
    const clock = document.getElementById('countdown');
    const target = (LAUNCH_DATE || Mission.LAUNCH_NET).getTime();
    const diff = target - Date.now();
    const past = diff < 0;
    const s = Math.floor(Math.abs(diff) / 1000);
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;

    if (LAUNCH_DATE) label.textContent = past ? 'Mission elapsed' : 'Artemis III launch';
    else             label.textContent = past ? 'Past the June 2027 target' : 'Artemis III, earliest June 2027';

    clock.innerHTML =
      `${d}<span class="cd-unit">d</span>${pad(h)}<span class="cd-unit">h</span>` +
      `${pad(m)}<span class="cd-unit">m</span>${pad(sec)}<span class="cd-unit">s</span>`;
    clock.setAttribute('aria-label', `${past ? 'plus' : 'minus'} ${d} days ${h} hours ${m} minutes`);
  }

  function updateClock() {
    document.getElementById('utc-clock').textContent = new Date().toISOString().substring(11, 19) + ' UTC';
  }

  // ── Moon distance: live from JPL Horizons (Pro), otherwise a low-precision model ─────────
  // Model: main periodic terms of Meeus, Astronomical Algorithms ch. 47. Within ~10 km of JPL today.
  const MOON_TERMS = [
    [0, 0, 1, 0, -20905355], [2, 0, -1, 0, -3699111], [2, 0, 0, 0, -2955968], [0, 0, 2, 0, -569925],
    [0, 1, 0, 0, 48888], [0, 0, 0, 2, -3149], [2, 0, -2, 0, 246158], [2, -1, -1, 0, -152138],
    [2, 0, 1, 0, -170733], [2, -1, 0, 0, -204586], [0, 1, -1, 0, -129620], [1, 0, 0, 0, 108743], [0, 1, 1, 0, 104755],
  ];
  function moonDistanceModelKm(ms = Date.now()) {
    const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525, r = Math.PI / 180;
    const D = (297.8501921 + 445267.1114034 * T) * r, M = (357.5291092 + 35999.0502909 * T) * r;
    const Mp = (134.9633964 + 477198.8675055 * T) * r, F = (93.272095 + 483202.0175233 * T) * r;
    return 385000.56 + MOON_TERMS.reduce((acc, [d, m, mp, f, c]) => acc + c * Math.cos(d * D + m * M + mp * Mp + f * F), 0) / 1000;
  }

  function parseHorizonsDistance(result) {
    const i = result.indexOf('$$SOE');
    if (i === -1) return null;
    const block = result.slice(i, i + 600);
    let x, y, z;
    const m = block.match(/X\s*=\s*(-?[\d.E+-]+)\s*Y\s*=\s*(-?[\d.E+-]+)\s*Z\s*=\s*(-?[\d.E+-]+)/);
    if (m) [x, y, z] = m.slice(1).map(parseFloat);
    else {
      const parts = result.split('\n')[result.split('\n').findIndex(l => l.includes('$$SOE')) + 1]?.split(',');
      if (!parts || parts.length < 5) return null;
      [x, y, z] = [parts[2], parts[3], parts[4]].map(parseFloat);
    }
    const km = Math.sqrt(x * x + y * y + z * z);
    return km > 340_000 && km < 410_000 ? km : null; // reject anything that is not a plausible Moon distance
  }

  function showMoon(km, source) {
    Orbital3D.setEphemeris({ moonKm: km, moonSource: source });
    const el = document.getElementById('sb-horizons-msg');
    el.className = 'ok';
    el.textContent = `Moon ${Math.round(km).toLocaleString('en-US')} km, ${(km / C_KM_S).toFixed(2)} s light delay (${source})`;
    const up = document.getElementById('sb-last-update');
    up.className = 'ok';
    up.textContent = `Updated ${new Date().toISOString().substring(11, 19)} UTC`;
  }

  async function updateMoon() {
    if (Auth.hasFeature('horizons_live')) {
      try {
        const data = await Auth.callEdge('horizons', { target: '301' });
        const km = data?.data?.result ? parseHorizonsDistance(data.data.result) : null;
        if (km) { showMoon(km, 'JPL Horizons'); return; }
      } catch (e) { console.warn('Horizons fetch failed', e); }
    }
    showMoon(moonDistanceModelKm(), 'computed');
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  async function init() {
    updateClock(); updateCountdown();
    setInterval(updateClock, 1000);
    setInterval(updateCountdown, 1000);

    Orbital3D.init();
    Mission.start(LAUNCH_DATE ? LAUNCH_DATE.getTime() : null);
    Providers.init();
    Roman.init();
    setInterval(() => Providers.init(), 60 * 60_000);

    // The Moon and DSN are public data, so they start immediately. Sign-in only upgrades the source.
    updateMoon();
    setInterval(updateMoon, 60_000);
    DSN.start(false, null);

    const authReady = await Auth.init();

    window.addEventListener('auth:ready', async e => {
      if (e.detail.tier === 'pro' || e.detail.tier === 'admin') {
        await NasaOnboarding.checkAndPromptIfNeeded();
      }
      updateMoon();
      DSN.start(Auth.hasFeature('dsn_live'), Auth.callEdge.bind(Auth));
    });
    window.addEventListener('auth:signedout', () => { updateMoon(); DSN.start(false, null); });

    if (!authReady) updateMoon();
  }

  return { init };
})();

window.addEventListener('load', App.init);
