// Artemis III mission timeline — phases, milestones, and live status
const Timeline = (() => {

  // Artemis III mission events — dates based on published NASA plans (NET 2026)
  // Status: done | active | upcoming | critical
  const EVENTS = [
    {
      id: 'launch',
      title: 'Launch · SLS Block 1B / Orion',
      date: '2026-Q3 (NET)',
      desc: 'Launch from LC-39B, Kennedy Space Center. SLS delivers Orion + crew to trans-lunar injection.',
      status: 'upcoming',
      phase: 'ASCENT',
    },
    {
      id: 'tli',
      title: 'Trans-Lunar Injection (TLI)',
      date: 'L+2h',
      desc: 'ICPS upper stage burn puts Orion on trajectory to the Moon. ~3-day coast begins.',
      status: 'upcoming',
      phase: 'TLI',
    },
    {
      id: 'hls-rendezvous',
      title: 'Orion–Starship HLS Rendezvous',
      date: 'L+4d',
      desc: 'Orion docks with Starship Human Landing System already in Near-Rectilinear Halo Orbit (NRHO). Two crew members transfer to HLS.',
      status: 'upcoming',
      phase: 'LUNAR ORBIT',
    },
    {
      id: 'loi',
      title: 'Lunar Orbit Insertion (LOI)',
      date: 'L+4d 12h',
      desc: 'Orion main engine burn inserts spacecraft into NRHO. Two crew remain in Orion while two descend.',
      status: 'upcoming',
      phase: 'LUNAR ORBIT',
    },
    {
      id: 'powered-descent',
      title: 'Powered Descent Initiation (PDI)',
      date: 'L+5d',
      desc: 'Starship HLS departs NRHO. Begins descent toward South Polar landing zone near Shackleton Crater rim.',
      status: 'upcoming',
      phase: 'DESCENT',
      critical: true,
    },
    {
      id: 'touchdown',
      title: 'Touchdown · Shackleton Crater Rim',
      date: 'L+5d 4h',
      desc: 'First crewed lunar landing since Apollo 17 (1972). Target: ~89.5°S, permanently shadowed region access.',
      status: 'upcoming',
      phase: 'SURFACE',
      critical: true,
    },
    {
      id: 'eva-1',
      title: 'EVA 1 · South Pole Traverse',
      date: 'L+6d',
      desc: 'First moonwalk in 54 years. Crew deploys science instruments, collects regolith samples, surveys terrain.',
      status: 'upcoming',
      phase: 'SURFACE OPS',
    },
    {
      id: 'eva-2',
      title: 'EVA 2 · Sample Collection',
      date: 'L+7d',
      desc: 'Extended traverse. Drill cores, volatile sampling near PSR boundary, deploy seismometer.',
      status: 'upcoming',
      phase: 'SURFACE OPS',
    },
    {
      id: 'ascent',
      title: 'Ascent · HLS Liftoff',
      date: 'L+8d',
      desc: 'Starship HLS upper stage lifts crew from lunar surface back to NRHO for Orion rendezvous.',
      status: 'upcoming',
      phase: 'ASCENT',
      critical: true,
    },
    {
      id: 'tei',
      title: 'Trans-Earth Injection (TEI)',
      date: 'L+9d',
      desc: 'Orion main engine burn departs lunar orbit. ~3-day coast to Earth.',
      status: 'upcoming',
      phase: 'RETURN',
    },
    {
      id: 'entry',
      title: 'Entry, Descent & Splashdown',
      date: 'L+12d',
      desc: 'Orion CM enters at 11 km/s. Skip-entry trajectory. Splashdown in Pacific Ocean. Recovery by USS San Diego.',
      status: 'upcoming',
      phase: 'ENTRY',
    },
  ];

  // Find current "active" event based on mission start date
  // (For pre-launch, all are upcoming; once flying, compute from launch time)
  function computeStatuses(launchTime) {
    if (!launchTime) return EVENTS; // pre-launch: all upcoming
    const now       = Date.now();
    const elapsed   = (now - launchTime) / 3_600_000; // hours since launch

    const phaseHours = {
      launch:          0,
      tli:             2,
      'hls-rendezvous': 96,
      loi:             108,
      'powered-descent': 120,
      touchdown:       124,
      'eva-1':         144,
      'eva-2':         168,
      ascent:          192,
      tei:             216,
      entry:           288,
    };

    return EVENTS.map(ev => {
      const evH  = phaseHours[ev.id] || 0;
      const nextH = phaseHours[Object.keys(phaseHours)[Object.keys(phaseHours).indexOf(ev.id) + 1]] || 9999;
      let status = 'upcoming';
      if (elapsed > nextH) status = 'done';
      else if (elapsed >= evH) status = 'active';
      return { ...ev, status };
    });
  }

  function render(launchTime) {
    const events = computeStatuses(launchTime);
    const list   = document.getElementById('timeline-list');
    list.innerHTML = '';

    events.forEach(ev => {
      const div = document.createElement('div');
      div.className = `tl-event ${ev.status}`;
      const dotClass = ev.status + (ev.critical ? ' critical' : '');
      div.innerHTML = `
        <div class="tl-node">
          <div class="tl-dot ${dotClass}"></div>
          <div class="tl-line"></div>
        </div>
        <div class="tl-content">
          <div class="tl-event-title">${ev.title}</div>
          <div class="tl-event-date">${ev.date} · ${ev.phase}</div>
          <div class="tl-event-desc">${ev.desc}</div>
        </div>
      `;
      list.appendChild(div);
    });

    // Update phase badge
    const active = events.find(e => e.status === 'active');
    const badge  = document.getElementById('mission-phase-badge');
    if (active) {
      badge.textContent = active.phase;
      badge.className   = 'phase-badge active';
      document.getElementById('tl-phase').textContent = active.phase;
    }
  }

  function start(launchTime) {
    render(launchTime);
    setInterval(() => render(launchTime), 60_000);
  }

  return { start };
})();
