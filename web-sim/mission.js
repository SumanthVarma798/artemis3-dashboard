// Artemis mission state: program ladder, Artemis III facts, flight plan, hardware readiness.
//
// Facts last checked 2026-09-30 against NASA, Wikipedia (Artemis II / III / IV, Artemis program),
// Ars Technica, Fox 35 (Isaacman memo via NASA Watch) and NASA's Artemis blog.
// Artemis III is an Earth-orbit docking test, not a landing. The first landing is Artemis IV.
// Update CHECKED and the arrays below when NASA publishes a new schedule.
const Mission = (() => {

  const CHECKED = 'Sep 30, 2026';

  // NET (no earlier than) placeholder. NASA has not announced a launch date.
  const LAUNCH_NET = new Date('2027-06-01T00:00:00Z');

  const LADDER = [
    { n: 'I',   when: 'Nov 2022',   what: 'Uncrewed flyby',      state: 'done'    },
    { n: 'II',  when: 'Apr 2026',   what: 'Crew around the Moon', state: 'done'   },
    { n: 'III', when: 'NET Jun 2027', what: 'Orbit docking test', state: 'next'   },
    { n: 'IV',  when: 'Early 2028', what: 'First landing',       state: 'planned' },
    { n: 'V',   when: 'Late 2028',  what: 'Second landing',      state: 'planned' },
  ];

  const FACTS = [
    { k: 'Launch',  v: 'NET June 2027 from Kennedy LC-39B. Reported about 90 days behind; best case is summer 2027.' },
    { k: 'Crew',    v: 'Randy Bresnik (commander), Luca Parmitano (ESA, pilot), Frank Rubio and Andre Douglas (mission specialists). Backup: Bob Hines.' },
    { k: 'Orbit',   v: 'Circular, about 430 km up, inclined 33°. Not a trip to the Moon.' },
    { k: 'Stack',   v: 'SLS flies with a spacer in place of the upper stage. The last ICPS is saved for Artemis IV.' },
  ];

  // Artemis III flight plan. atHours = hours after Orion launch, used once a real launch time exists.
  const STEPS = [
    { id: 'blue-launch', title: 'Blue Origin test vehicle launches first',
      when: 'Before Orion', atHours: -1,
      desc: 'A lander test vehicle goes to orbit ahead of the crew. It can stay up for as long as 90 days.' },
    { id: 'launch', title: 'SLS and Orion launch with four crew',
      when: 'Launch day', atHours: 0,
      desc: 'Liftoff from Kennedy LC-39B. No upper stage burn: Orion goes to orbit on the core stage and its own service module.' },
    { id: 'circularize', title: 'Orion settles into a 430 km orbit',
      when: 'First hours', atHours: 3,
      desc: 'The European Service Module circularizes the orbit and the crew starts checking Orion out.' },
    { id: 'dock-blue', title: 'Dock with the Blue Origin vehicle', critical: true,
      when: 'About 2 days docked', atHours: 30,
      desc: 'The crew enters the vehicle, tests its systems and checks how it interfaces with the Axiom AxEMU spacesuit. Orion steers the joined stack.' },
    { id: 'starship-launch', title: 'Starship V3 launches',
      when: 'During the docked phase', atHours: 36,
      desc: 'The third launch. The Starship test article has a docking mechanism but no crew cabin.' },
    { id: 'dock-starship', title: 'Undock and dock with Starship', critical: true,
      when: 'About 1 day docked', atHours: 80,
      desc: 'Orion flies to Starship and docks. The crew stays inside Orion the whole time.' },
    { id: 'entry', title: 'Deorbit and entry', critical: true,
      when: 'About 2 weeks after launch', atHours: 330,
      desc: 'Orion re-enters on an upgraded heat shield and lands in the Pacific about two weeks after launch.' },
    { id: 'splashdown', title: 'Splashdown off San Diego',
      when: 'Mission end', atHours: 336,
      desc: 'Pacific Ocean landing. The U.S. Navy recovers Orion and the crew.' },
  ];

  const READINESS = [
    { state: 'done',   t: 'Crew named',                         d: 'Jun 9, 2026' },
    { state: 'done',   t: 'Core stage arrives at Kennedy',      d: 'Apr 28, 2026' },
    { state: 'done',   t: 'Four RS-25 engines installed',       d: 'Engines delivered Jul 21, 2026' },
    { state: 'done',   t: 'Orion crew and service modules joined', d: 'Aug 2026' },
    { state: 'active', t: 'Solid rocket booster stacking',      d: 'Began Jul 13, 2026 in the VAB' },
    { state: 'todo',   t: 'Blue Origin test vehicle',           d: 'In development, not yet human-rated' },
    { state: 'todo',   t: 'Starship V3 test article',           d: 'Starship first reached orbit on Flight 14, Sep 28, 2026' },
  ];

  const ICON = { done: 'ph-check-circle', active: 'ph-circle-notch', todo: 'ph-circle-dashed' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderProgram() {
    const body = document.getElementById('mission-body');
    if (!body) return;
    body.innerHTML = `
      <p class="lede">Artemis III is a crewed rehearsal in Earth orbit. Orion docks with two commercial lander test vehicles before NASA commits to the first landing on Artemis IV.</p>
      <ol class="ladder" aria-label="Artemis missions">
        ${LADDER.map((m, i) => `
          <li class="rung ${m.state}" style="--i:${i}">
            <span class="rung-n">${m.n}</span>
            <span class="rung-when">${esc(m.when)}</span>
            <span class="rung-what">${esc(m.what)}</span>
          </li>`).join('')}
      </ol>
      <dl class="facts">
        ${FACTS.map(f => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join('')}
      </dl>`;
    const chk = document.getElementById('mission-checked');
    if (chk) chk.textContent = 'Checked ' + CHECKED.replace(/, \d{4}$/, '');
  }

  function stepStatus(step, launchTime) {
    if (!launchTime) return 'upcoming';
    const h = (Date.now() - launchTime) / 3_600_000;
    const i = STEPS.indexOf(step), next = STEPS[i + 1];
    if (next && h >= next.atHours) return 'done';
    return h >= step.atHours ? 'active' : 'upcoming';
  }

  function renderSteps(launchTime) {
    const list = document.getElementById('timeline-list');
    if (!list) return;
    list.innerHTML = STEPS.map((s, i) => {
      const st = stepStatus(s, launchTime);
      return `
        <li class="tl-event ${st}${s.critical ? ' critical' : ''}" data-step="${i + 1}" style="--i:${i}">
          <span class="tl-rail" aria-hidden="true"><span class="tl-dot"></span></span>
          <div class="tl-content">
            <div class="tl-event-title">${esc(s.title)}</div>
            <div class="tl-event-date">${esc(s.when)}</div>
            <div class="tl-event-desc">${esc(s.desc)}</div>
          </div>
        </li>`;
    }).join('');
    markSceneStep();

    const active = STEPS.find(s => stepStatus(s, launchTime) === 'active');
    const badge = document.getElementById('mission-phase-badge');
    if (badge && active) { badge.textContent = active.title; badge.className = 'phase-badge active'; }
  }

  function renderReadiness() {
    const list = document.getElementById('readiness-list');
    if (!list) return;
    list.innerHTML = READINESS.map(r => `
      <li class="rd ${r.state}">
        <i class="ph ${ICON[r.state]} rd-icon" aria-hidden="true"></i>
        <div><div class="rd-t">${esc(r.t)}</div><div class="rd-d">${esc(r.d)}</div></div>
        <span class="sr-only">${r.state === 'done' ? 'complete' : r.state === 'active' ? 'in progress' : 'not started'}</span>
      </li>`).join('');
    const sub = document.getElementById('readiness-sub');
    if (sub) sub.textContent = `${READINESS.filter(r => r.state === 'done').length} of ${READINESS.length} complete`;
  }

  // The 3D stage announces which flight-plan step it is showing; mirror it in the list
  let sceneStep = null;
  function markSceneStep() {
    document.querySelectorAll('#timeline-list .tl-event').forEach(el =>
      el.classList.toggle('scene-active', sceneStep !== null && +el.dataset.step === sceneStep));
  }
  window.addEventListener('stage:step', e => { sceneStep = e.detail.step; markSceneStep(); });

  function start(launchTime) {
    renderProgram();
    renderReadiness();
    renderSteps(launchTime);
    if (launchTime) setInterval(() => renderSteps(launchTime), 60_000);
  }

  return { start, LAUNCH_NET };
})();
