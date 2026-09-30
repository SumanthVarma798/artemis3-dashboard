// Deep Space Network, live from DSN Now (NASA JPL).
//
// The feed is flat XML: a <station> element is followed by its sibling <dish> elements, and dishes are
// named like "DSS14" (no hyphen). eyes.nasa.gov sends Access-Control-Allow-Origin: *, so the browser
// can fetch it directly. Pro users can route through the Supabase Edge Function instead.
//
// When the feed is unreachable we say so. We do not invent spacecraft or comm windows.
const DSN = (() => {

  const DSN_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml';
  const STATION_KEY = { gdscc: 'goldstone', mdscc: 'madrid', cdscc: 'canberra' };
  const SITE_KEYS = ['goldstone', 'madrid', 'canberra'];

  // Names Artemis spacecraft may use in the feed. None is flying until Artemis III.
  const ARTEMIS_TARGETS = ['ORION', 'ARTEMIS', 'EM1', 'EM2', 'EM3', 'ART2', 'ART3', 'MPCV'];
  // Placeholders the DSN uses when a dish has no spacecraft
  const NOT_A_SPACECRAFT = ['DSN', 'DSS', 'CAL', 'N/A'];

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function parseDSNXML(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const result = { goldstone: [], madrid: [], canberra: [] };
    let site = null;

    for (const el of Array.from(doc.documentElement.children)) {
      if (el.tagName === 'station') { site = STATION_KEY[el.getAttribute('name')] || null; continue; }
      if (el.tagName !== 'dish' || !site) continue;

      const targets = Array.from(el.querySelectorAll('target'))
        .map(t => t.getAttribute('name'))
        .filter(n => n && !NOT_A_SPACECRAFT.includes(n.toUpperCase()));
      const down = el.querySelector('downSignal');
      result[site].push({
        name:     el.getAttribute('name'),
        targets,
        activity: el.getAttribute('activity') || '',
        elev:     parseFloat(el.getAttribute('elevationAngle') || '0'),
        rateBps:  down ? parseFloat(down.getAttribute('dataRate') || '0') : 0,
        downActive: down ? down.getAttribute('active') === 'true' : false,
      });
    }
    return result;
  }

  function fmtRate(bps) {
    if (!bps) return '';
    if (bps >= 1e6) return (bps / 1e6).toFixed(1) + ' Mb/s';
    return bps >= 1000 ? Math.round(bps / 1000) + ' kb/s' : Math.round(bps) + ' b/s';
  }

  // Bars show how high the dish points (a proxy for a clean link), and only while a downlink is active
  function signalLevel(d) {
    if (!d.targets.length || !d.downActive) return 0;
    return d.elev > 60 ? 4 : d.elev > 30 ? 3 : d.elev > 10 ? 2 : 1;
  }

  function signalBarsHtml(level) {
    return `<div class="signal-bars s${level}" aria-hidden="true"><div class="signal-bar b1"></div><div class="signal-bar b2"></div><div class="signal-bar b3"></div><div class="signal-bar b4"></div></div>`;
  }

  function dishRow(d) {
    const tracking = d.targets.length > 0;
    const label = tracking ? d.targets.join(', ') : (d.activity || 'Idle');
    return `<div class="dish-row">
      <div class="dish-name">${esc(d.name)}</div>
      <div class="dish-target ${tracking ? '' : 'idle'}" title="${esc(label)}">${esc(label)}</div>
      <div class="dish-signal">${signalBarsHtml(signalLevel(d))}<span class="dish-rate">${d.downActive ? fmtRate(d.rateBps) : ''}</span></div>
    </div>`;
  }

  function renderSite(siteKey, dishes) {
    const container = document.getElementById('dishes-' + siteKey);
    const dot = document.querySelector(`#dsn-${siteKey} .site-dot`);
    if (!container || !dot) return;
    if (!dishes.length) {
      container.innerHTML = '<div class="dsn-empty">No dishes reported</div>';
      dot.className = 'site-dot';
      return;
    }
    const isArtemis = dishes.some(d => d.targets.some(t => ARTEMIS_TARGETS.some(a => t.toUpperCase().includes(a))));
    const busy = dishes.some(d => d.targets.length);
    dot.className = 'site-dot' + (isArtemis ? ' active' : busy ? ' tracking' : '');
    // Dishes with a spacecraft first, then the rest; four rows keeps the card short
    const sorted = [...dishes].sort((a, b) => b.targets.length - a.targets.length);
    container.innerHTML = sorted.slice(0, 4).map(dishRow).join('');
  }

  function renderAll(data, sourceLabel) {
    SITE_KEYS.forEach(k => renderSite(k, data[k]));
    const all = SITE_KEYS.flatMap(k => data[k]);
    const tracking = all.filter(d => d.targets.length).length;
    const artemis = all.some(d => d.targets.some(t => ARTEMIS_TARGETS.some(a => t.toUpperCase().includes(a))));

    const status = document.getElementById('dsn-status');
    if (status) status.textContent = `${tracking} of ${all.length} dishes tracking`;
    const note = document.getElementById('dsn-artemis');
    if (note) {
      note.classList.toggle('live', artemis);
      note.textContent = artemis
        ? 'An Artemis spacecraft is being tracked right now.'
        : 'No Artemis spacecraft in flight. The next one to launch is Artemis III.';
    }
    const sb = document.getElementById('sb-dsn-msg');
    if (sb) { sb.className = 'ok'; sb.textContent = `DSN: ${sourceLabel}, ${new Date().toISOString().substring(11, 19)} UTC`; }
  }

  function renderUnavailable() {
    SITE_KEYS.forEach(k => {
      const c = document.getElementById('dishes-' + k), dot = document.querySelector(`#dsn-${k} .site-dot`);
      if (c) c.innerHTML = '<div class="dsn-empty">DSN Now is not reachable right now.</div>';
      if (dot) dot.className = 'site-dot';
    });
    const status = document.getElementById('dsn-status');
    if (status) status.textContent = 'Unavailable';
    const sb = document.getElementById('sb-dsn-msg');
    if (sb) { sb.className = ''; sb.textContent = 'DSN: unavailable'; }
  }

  async function fetchDirect() {
    const res = await fetch(DSN_URL + '?r=' + Math.floor(Date.now() / 5000), { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error('http ' + res.status);
    return parseDSNXML(await res.text());
  }

  // start() is safe to call again when the user's tier changes: one timer, latest config wins
  let timer = null;
  let cfg = { isLive: false, callEdge: null };

  async function poll() {
    try {
      if (cfg.isLive && cfg.callEdge) {
        try {
          const data = await cfg.callEdge('dsn');
          if (data?.xml) { renderAll(parseDSNXML(data.xml), 'live via edge'); return; }
        } catch { /* fall through to direct */ }
      }
      renderAll(await fetchDirect(), 'live');
    } catch (e) {
      console.warn('DSN fetch failed', e);
      renderUnavailable();
    }
  }

  function start(isLive, callEdge) {
    cfg = { isLive: !!isLive, callEdge: callEdge || null };
    poll();
    if (!timer) timer = setInterval(poll, 30_000);
  }

  return { start, parseDSNXML };
})();
