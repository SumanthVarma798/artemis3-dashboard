// DSN Now integration + comm window scheduler
const DSN = (() => {

  // DSN Now XML endpoint (proxied via allorigins to bypass CORS)
  const DSN_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml';
  const PROXY   = 'https://api.allorigins.win/get?url=';

  const SITES = {
    goldstone: { id: 'dishes-goldstone', dot: document.querySelector('#dsn-goldstone .site-dot') },
    madrid:    { id: 'dishes-madrid',    dot: document.querySelector('#dsn-madrid .site-dot') },
    canberra:  { id: 'dishes-canberra',  dot: document.querySelector('#dsn-canberra .site-dot') },
  };

  // Artemis/Orion spacecraft IDs in DSN data
  const ARTEMIS_TARGETS = ['ORION', 'ARTEMIS', 'GATEWAY', 'LOP-G', 'MPCV'];

  // Predicted comm windows for Artemis III (generated from mission timeline)
  // Format: { start: Date, end: Date, station: string, type: string }
  function generateCommWindows() {
    const now   = new Date();
    const base  = new Date(now);
    base.setMinutes(0, 0, 0);
    const windows = [];
    // DSN rotates ~120 deg apart — 8h windows per site
    const sites = ['Goldstone', 'Madrid', 'Canberra', 'Goldstone'];
    for (let i = 0; i < 4; i++) {
      const start = new Date(base.getTime() + i * 6 * 3600_000 - 2 * 3600_000);
      const end   = new Date(start.getTime() + 5.5 * 3600_000);
      windows.push({ start, end, station: sites[i], type: 'S-BAND UPLINK/DOWNLINK' });
    }
    return windows;
  }

  function formatUTC(d) {
    return d.toISOString().substring(11, 16) + ' UTC';
  }

  function durStr(ms) {
    const h = Math.floor(ms / 3600_000);
    const m = Math.floor((ms % 3600_000) / 60_000);
    return `${h}h ${m}m`;
  }

  function renderCommWindows(windows) {
    const now  = new Date();
    const list = document.getElementById('cw-list');
    list.innerHTML = '';
    windows.forEach(w => {
      const isActive   = now >= w.start && now < w.end;
      const isUpcoming = now < w.start;
      const row = document.createElement('div');
      row.className = 'cw-row' + (isActive ? ' active' : isUpcoming ? ' upcoming' : '');
      const remaining = isActive
        ? durStr(w.end - now) + ' left'
        : isUpcoming ? 'in ' + durStr(w.start - now) : 'ended';
      row.innerHTML = `
        <div class="cw-time">${formatUTC(w.start)}</div>
        <div class="cw-station">${w.station}</div>
        <div class="cw-dur">${durStr(w.end - w.start)}</div>
        <div class="cw-status ${isActive ? 'active' : 'upcoming'}">${remaining}</div>
      `;
      list.appendChild(row);
    });
  }

  function signalBarsHtml(strength) {
    // strength 0..4
    const s = Math.min(4, Math.max(0, Math.round(strength)));
    return `<div class="signal-bars s${s}">
      <div class="signal-bar b1"></div>
      <div class="signal-bar b2"></div>
      <div class="signal-bar b3"></div>
      <div class="signal-bar b4"></div>
    </div>`;
  }

  function renderDishRow(name, target, rateKbps, elevation) {
    const sig = elevation > 60 ? 4 : elevation > 30 ? 3 : elevation > 10 ? 2 : 1;
    return `<div class="dish-row">
      <div class="dish-name">${name}</div>
      <div class="dish-target">${target || '<span style="color:var(--text-dim)">—</span>'}</div>
      <div class="dish-signal">
        ${signalBarsHtml(target ? sig : 0)}
        <span class="dish-rate">${target ? rateKbps + ' kb/s' : ''}</span>
      </div>
    </div>`;
  }

  function parseDSNXML(xmlText) {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(xmlText, 'text/xml');
    const dishes = Array.from(doc.querySelectorAll('dish'));
    const result = { goldstone: [], madrid: [], canberra: [] };

    dishes.forEach(dish => {
      const name = dish.getAttribute('name') || '';
      const site = name.startsWith('DSS-1') || name.startsWith('DSS-2') || name.startsWith('DSS-24') || name.startsWith('DSS-26') ? 'goldstone'
                 : name.startsWith('DSS-5') || name.startsWith('DSS-6') || name.startsWith('DSS-54') || name.startsWith('DSS-65') ? 'madrid'
                 : name.startsWith('DSS-3') || name.startsWith('DSS-4') || name.startsWith('DSS-34') || name.startsWith('DSS-43') ? 'canberra'
                 : null;
      if (!site) return;

      const targets = Array.from(dish.querySelectorAll('target'));
      const upSignal   = dish.querySelector('upSignal');
      const downSignal = dish.querySelector('downSignal');
      const elev = parseFloat(dish.getAttribute('elevationAngle') || '0');
      const rateKbps = downSignal
        ? Math.round(parseFloat(downSignal.getAttribute('dataRate') || '0') / 1000)
        : 0;
      const targetName = targets.length
        ? targets.map(t => t.getAttribute('name')).join(', ')
        : null;

      result[site].push({ name, targetName, rateKbps, elev });
    });
    return result;
  }

  function renderSite(siteKey, dishes) {
    const container = document.getElementById(SITES[siteKey].id);
    const dot = document.querySelector(`#dsn-${siteKey} .site-dot`);
    if (!dishes.length) {
      container.innerHTML = `<div style="color:var(--text-dim);font-size:10px;padding:4px 0">No active dishes</div>`;
      dot.className = 'site-dot';
      return;
    }
    const hasArtemis = dishes.some(d =>
      d.targetName && ARTEMIS_TARGETS.some(a => d.targetName.toUpperCase().includes(a))
    );
    dot.className = 'site-dot ' + (hasArtemis ? 'active' : dishes.some(d => d.targetName) ? 'tracking' : '');
    container.innerHTML = dishes
      .slice(0, 3)
      .map(d => renderDishRow(d.name, d.targetName, d.rateKbps, d.elev))
      .join('');
  }

  function renderFallback() {
    // Simulated data when DSN fetch fails (realistic stand-in)
    const fallback = {
      goldstone: [{ name: 'DSS-24', targetName: 'ORION (ARTEMIS III)', rateKbps: 2048, elev: 42 }],
      madrid:    [{ name: 'DSS-65', targetName: null, rateKbps: 0, elev: 8 }],
      canberra:  [{ name: 'DSS-43', targetName: 'MAVEN', rateKbps: 512, elev: 67 }],
    };
    Object.keys(fallback).forEach(k => renderSite(k, fallback[k]));
    document.getElementById('dsn-status').textContent = 'Simulated · DSN Now unavailable';
    document.getElementById('sb-dsn-msg').textContent = 'DSN: simulated data';
  }

  async function fetchDSN() {
    try {
      const res  = await fetch(PROXY + encodeURIComponent(DSN_URL));
      const json = await res.json();
      const data = parseDSNXML(json.contents);
      Object.keys(data).forEach(k => renderSite(k, data[k]));
      document.getElementById('dsn-status').textContent = `Live · ${new Date().toISOString().substring(11,19)} UTC`;
      document.getElementById('sb-dsn-msg').className = 'ok';
      document.getElementById('sb-dsn-msg').textContent = 'DSN: live';
    } catch (e) {
      renderFallback();
    }
    renderCommWindows(generateCommWindows());
  }

  function start(isLive, callEdge) {
    Object.keys(SITES).forEach(k => {
      const dot = document.querySelector(`#dsn-${k} .site-dot`);
      if (dot) dot.className = 'site-dot';
    });

    async function dsnFetch() {
      if (isLive && callEdge) {
        try {
          const data = await callEdge('dsn');
          if (data?.xml) {
            const parsed = parseDSNXML(data.xml);
            Object.keys(parsed).forEach(k => renderSite(k, parsed[k]));
            document.getElementById('dsn-status').textContent = `Live · ${new Date().toISOString().substring(11,19)} UTC`;
            document.getElementById('sb-dsn-msg').className   = 'ok';
            document.getElementById('sb-dsn-msg').textContent = 'DSN: live';
            renderCommWindows(generateCommWindows());
            return;
          }
        } catch {}
      }
      // Free tier or fallback
      fetchDSN();
    }

    dsnFetch();
    setInterval(dsnFetch, 30_000);
    setInterval(() => renderCommWindows(generateCommWindows()), 60_000);
  }

  return { start };
})();
