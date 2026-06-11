// Launch Providers — live SpaceX & Blue Origin launch data
// Source: The Space Devs "Launch Library 2" (free, CORS-enabled).
// The SpaceX r-spacex API is deprecated/offline and Blue Origin has no public
// API, so LL2 is used for both. Results are cached in localStorage to stay well
// within the anonymous rate limit (~15 req/hour).
const Providers = (() => {

  const LL2       = 'https://ll.thespacedevs.com/2.2.0';
  const CACHE_KEY = 'll2_providers_v1';
  const TTL_MS    = 60 * 60 * 1000; // 1 hour

  // LL2 launch-service-provider IDs
  const AGENCIES = [
    { id: 121, key: 'spacex',     name: 'SPACEX',      sub: 'Starship HLS · Artemis III', cls: 'spacex' },
    { id: 141, key: 'blueorigin', name: 'BLUE ORIGIN', sub: 'Blue Moon · Artemis V',      cls: 'blueorigin' },
  ];

  async function fetchOne(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 429) throw new Error('rate-limited');
    if (!res.ok) throw new Error('http ' + res.status);
    const json = await res.json();
    return json.results && json.results[0] ? json.results[0] : null;
  }

  function trim(launch) {
    if (!launch) return null;
    return {
      name:   launch.name || 'Unknown',
      net:    launch.net  || null,
      status: launch.status ? { abbrev: launch.status.abbrev, name: launch.status.name } : null,
    };
  }

  async function fetchAgency(id) {
    const [latest, next] = await Promise.all([
      fetchOne(`${LL2}/launch/previous/?lsp__id=${id}&limit=1&mode=list`),
      fetchOne(`${LL2}/launch/upcoming/?lsp__id=${id}&limit=1&mode=list`),
    ]);
    return { latest: trim(latest), next: trim(next) };
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && obj.ts && obj.data ? obj : null;
    } catch { return null; }
  }

  async function load() {
    const cached = readCache();
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return { data: cached.data, fresh: false, cachedAt: cached.ts };
    }
    try {
      const entries = await Promise.all(AGENCIES.map(a => fetchAgency(a.id).then(d => [a.key, d])));
      const data = Object.fromEntries(entries);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      return { data, fresh: true, cachedAt: Date.now() };
    } catch (e) {
      // On failure, fall back to any cached data even if stale
      if (cached) return { data: cached.data, fresh: false, cachedAt: cached.ts, stale: true };
      throw e;
    }
  }

  // ── Formatting ──────────────────────────────────────────────────────────────

  function relTime(netStr) {
    if (!netStr) return '';
    const d = new Date(netStr);
    if (isNaN(d)) return '';
    const diff = d.getTime() - Date.now();
    const past = diff < 0;
    const s    = Math.abs(diff) / 1000;
    let phrase;
    if      (s / 86400 >= 1.5) phrase = `${Math.round(s / 86400)} days`;
    else if (s / 3600  >= 1)   phrase = `${Math.round(s / 3600)} h`;
    else                       phrase = `${Math.max(1, Math.round(s / 60))} min`;
    return past ? `${phrase} ago` : `T-minus ${phrase}`;
  }

  function absDate(netStr) {
    if (!netStr) return '';
    const d = new Date(netStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function statusClass(abbrev) {
    switch ((abbrev || '').toLowerCase()) {
      case 'success': return 'ok';
      case 'go':      return 'go';
      case 'failure':
      case 'partial failure': return 'fail';
      default:        return 'tbd';
    }
  }

  function splitName(name) {
    const i = name.indexOf(' | ');
    if (i === -1) return { rocket: name, mission: '' };
    return { rocket: name.slice(0, i), mission: name.slice(i + 3) };
  }

  function rowHtml(label, launch) {
    if (!launch) {
      return `<div class="prov-row"><span class="prov-tag">${label}</span><div class="prov-body"><div class="prov-meta">No data</div></div></div>`;
    }
    const { rocket, mission } = splitName(launch.name);
    const st = launch.status;
    const pill = st
      ? `<span class="pill ${statusClass(st.abbrev)}">${st.abbrev}</span>`
      : '';
    return `
      <div class="prov-row">
        <span class="prov-tag">${label}</span>
        <div class="prov-body">
          <div class="prov-mission">${rocket}${mission ? ` <span class="prov-payload">· ${mission}</span>` : ''}</div>
          <div class="prov-meta">${absDate(launch.net)} · ${relTime(launch.net)} ${pill}</div>
        </div>
      </div>`;
  }

  function render(data, meta) {
    const list = document.getElementById('providers-list');
    if (!list) return;
    list.innerHTML = AGENCIES.map(a => {
      const d = data[a.key] || {};
      return `
        <div class="prov-card ${a.cls}">
          <div class="prov-head">
            <span class="prov-name">${a.name}</span>
            <span class="prov-sub">${a.sub}</span>
          </div>
          ${rowHtml('LATEST', d.latest)}
          ${rowHtml('NEXT',   d.next)}
        </div>`;
    }).join('');

    const statusEl = document.getElementById('providers-status');
    if (statusEl) {
      const when = meta.cachedAt ? new Date(meta.cachedAt).toISOString().substring(11, 16) + ' UTC' : '';
      statusEl.textContent = meta.stale ? `cached ${when} (offline)` : `Launch Library 2 · ${when}`;
      statusEl.className = 'panel-sub';
    }
  }

  async function init() {
    const statusEl = document.getElementById('providers-status');
    if (statusEl) statusEl.textContent = 'Fetching live launches…';
    try {
      const { data, ...meta } = await load();
      render(data, meta);
    } catch (e) {
      console.warn('Providers fetch failed', e);
      const list = document.getElementById('providers-list');
      if (list) list.innerHTML = `<div class="prov-empty">Live launch data unavailable.<br><span>The Space Devs API may be rate-limited — retry shortly.</span></div>`;
      if (statusEl) statusEl.textContent = 'unavailable';
    }
  }

  // Expose cached data for other modules (e.g. Story Mode)
  function getCached() {
    const c = readCache();
    return c ? c.data : null;
  }

  return { init, load, getCached };
})();
