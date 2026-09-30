// Nancy Grace Roman Space Telescope — frames captured by Roman itself.
// No public API exists for these yet (science data lands in MAST; NASA's Image Library only has launch/ground photos),
// so this is a curated list. Append new frames here as NASA publishes them.
const Roman = (() => {
  const POST = 'https://science.nasa.gov/blogs/roman/2026/09/15/nasa-activates-romans-primary-instrument-checks-out-coronagraph/';
  const IMG  = 'https://science.nasa.gov/wp-content/uploads/2026/09/roman-first-image-v3-d1.jpg';
  const FRAMES = [{
    thumb: IMG + '?w=1024',
    full:  IMG + '?w=2048',
    title: 'First test image from the Wide Field Instrument: all 18 detectors, with a zoom on one star',
    note:  'Stars look like donuts because the instrument is not focused yet (expected at this stage).',
    date:  'Sep 2026',
    src:   POST,
  }];

  function init() {
    const list = document.getElementById('roman-list');
    const dlg  = document.getElementById('roman-dialog');
    list.innerHTML = FRAMES.map((f, i) =>
      `<button class="roman-thumb" data-i="${i}" title="${f.title}"><img src="${f.thumb}" alt="${f.title}"></button>`
    ).join('') + '<p class="roman-note">Commissioning test frames only. First science images expected early 2027.</p>';
    document.getElementById('roman-status').textContent = `${FRAMES.length} frame · captured by Roman`;

    list.onclick = e => {
      const b = e.target.closest('.roman-thumb');
      if (!b) return;
      const f = FRAMES[b.dataset.i];
      dlg.querySelector('img').src = f.full;
      dlg.querySelector('figcaption').innerHTML =
        `${f.title}. ${f.note} · ${f.date} · <a href="${f.src}" target="_blank" rel="noopener">NASA Science</a>`;
      dlg.showModal();
    };
    dlg.onclick = e => { if (e.target.tagName !== 'A') dlg.close(); };
  }

  return { init };
})();
