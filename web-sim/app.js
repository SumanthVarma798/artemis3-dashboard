// Artemis III Dashboard — main controller
// Wires together orbital3d, dsn, timeline, countdown, auth, and data fetching

const App = (() => {

  const LAUNCH_DATE      = null; // set to new Date('2026-09-01T00:00:00Z') when confirmed
  const COUNTDOWN_TARGET = new Date('2026-09-01T00:00:00Z');

  // ── Countdown ──
  function updateCountdown() {
    const now    = Date.now();
    const target = LAUNCH_DATE ? LAUNCH_DATE.getTime() : COUNTDOWN_TARGET.getTime();
    const diff   = target - now;
    const label  = document.getElementById('cd-label');
    const clock  = document.getElementById('countdown');

    if (diff < 0 && LAUNCH_DATE) {
      label.textContent = 'T+';
      clock.textContent = formatHMS(-diff);
    } else if (diff < 0) {
      label.textContent = 'T+';
      clock.textContent = '00:00:00:00';
    } else {
      label.textContent = 'T-MINUS';
      clock.textContent = formatDHMS(diff);
    }
  }

  function formatDHMS(ms) {
    const s = Math.floor(ms / 1000);
    return `${pad(Math.floor(s/86400))}:${pad(Math.floor(s%86400/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`;
  }

  function formatHMS(ms) {
    const s = Math.floor(ms / 1000);
    return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ── UTC Clock ──
  function updateClock() {
    document.getElementById('utc-clock').textContent =
      new Date().toISOString().substring(11, 19) + ' UTC';
  }

  // ── Data fetching — branches on tier ──
  async function fetchHorizons() {
    const statusEl = document.getElementById('sb-horizons-msg');
    const isLive   = Auth.hasFeature('horizons_live');

    if (isLive) {
      // Pro: fetch through Edge Function (key never in browser)
      statusEl.textContent = 'Horizons: fetching…';
      try {
        const data = await Auth.callEdge('horizons', { target: '301' });
        if (data?.data?.result) {
          const parsed = parseHorizonsResult(data.data.result);
          if (parsed) {
            Orbital3D.updateFromHorizons({ ...parsed, missionPhase: LAUNCH_DATE ? 'TLI COAST' : 'PRE-LAUNCH' });
            statusEl.className   = 'ok';
            statusEl.textContent = `Horizons: live · Moon ${Math.round(parsed.orionDistMoon/1000)}k km`;
            setLastUpdate();
            return;
          }
        }
      } catch (e) {
        console.warn('Horizons fetch failed', e);
      }
    }

    // Free / fallback: static model with realistic values
    Orbital3D.updateFromHorizons({
      orionDistEarth:  152_000,
      orionDistMoon:   232_000,
      orionVelocity:   0.94,
      missionPhase:    'PRE-LAUNCH',
      transitProgress: 0.38,
    });
    statusEl.textContent = isLive ? 'Horizons: offline (static model)' : 'Horizons: upgrade to Pro for live data';
  }

  function parseHorizonsResult(result) {
    const lines  = result.split('\n');
    const soeIdx = lines.findIndex(l => l.includes('$$SOE'));
    if (soeIdx === -1) return null;
    const parts = lines[soeIdx + 2]?.split(',');
    if (!parts || parts.length < 5) return null;
    const x = parseFloat(parts[2]);
    const y = parseFloat(parts[3]);
    const z = parseFloat(parts[4]);
    const distKm = Math.sqrt(x*x + y*y + z*z); // Earth→Moon dist
    const progress = 0.38; // static transit progress until mission is live
    return {
      orionDistEarth: distKm * progress,
      orionDistMoon:  distKm * (1 - progress),
      orionVelocity:  0.94,
      transitProgress: progress,
    };
  }

  function setLastUpdate() {
    const el = document.getElementById('sb-last-update');
    el.className   = 'ok';
    el.textContent = `Last update: ${new Date().toISOString().substring(11, 19)} UTC`;
  }

  // ── Show tier gate overlay on locked panels ──
  function applyTierGates() {
    const liveFeatures = ['dsn_live', 'horizons_live', 'orbital_3d_live'];
    const hasAnyPro = liveFeatures.some(f => Auth.hasFeature(f));

    if (!hasAnyPro) {
      // Add upgrade nudge to DSN panel
      const dsnStatus = document.getElementById('dsn-status');
      if (dsnStatus) {
        dsnStatus.innerHTML = `<span style="color:var(--warn)">Live data · <button onclick="document.getElementById('btn-auth')?.click()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-family:var(--font);font-size:10px">Sign in / upgrade to Pro</button></span>`;
      }
    }
  }

  // ── Boot ──
  async function init() {
    // Start clocks immediately (works without auth)
    updateClock();
    updateCountdown();
    setInterval(updateClock, 1000);
    setInterval(updateCountdown, 1000);

    // Start 3D orbital (works in free mode)
    Orbital3D.init();

    // Start mission timeline (works in free mode)
    Timeline.start(LAUNCH_DATE ? LAUNCH_DATE.getTime() : null);

    // Init auth — non-blocking; dashboard still works before login
    const authReady = await Auth.init();

    // Listen for auth ready/change events
    window.addEventListener('auth:ready', async (e) => {
      console.log('[App] Auth ready, tier:', e.detail.tier);
      applyTierGates();

      // Pro users: validate NASA key and run onboarding if needed
      if (e.detail.tier === 'pro' || e.detail.tier === 'admin') {
        const { key, isDemo } = await NasaOnboarding.checkAndPromptIfNeeded();
        if (isDemo) {
          const sb = document.getElementById('sb-horizons-msg');
          if (sb) sb.textContent = 'Horizons: DEMO_KEY (limited rate)';
        }
        // Key is now valid — stored in localStorage, Edge Function will use vault key
      }

      // Start data fetching with correct tier
      fetchHorizons();
      setInterval(fetchHorizons, 5 * 60_000);
      DSN.start(Auth.hasFeature('dsn_live'), Auth.callEdge.bind(Auth));
    });

    window.addEventListener('auth:signedout', () => {
      applyTierGates();
    });

    // If Supabase not configured, still boot everything in demo mode
    if (!authReady) {
      applyTierGates();
      fetchHorizons();
      setInterval(fetchHorizons, 5 * 60_000);
      DSN.start(false, null);
    }

    window.addEventListener('resize', () => Orbital3D.resize());
  }

  return { init };
})();

window.addEventListener('load', App.init);
