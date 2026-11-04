import { ComparisonRace, comparisonCsv, RACE_POLICIES, RACE_STEP } from './compare.js';
import { SIDES } from './engine.js';
import { drawJunction } from './draw.js';
import { queueLayout, queueViewSpan } from './queue-layout.js';

const $ = id => document.getElementById(id);
function text(element, value) {
  if (element.textContent !== String(value)) element.textContent = value;
}

export function setupRaceDialog({ t, route, name, environment, mainTraffic, saveCsv, reducedMotion, onClose }) {
  const dialog = $('comparison');
  const panels = RACE_POLICIES.map(key => {
    const lane = dialog.querySelector(`.race-lane[data-policy=${key}]`);
    return {
      key, lane, board: lane.querySelector('.race-board'), map: lane.querySelector('.race-map'),
      time: lane.querySelector('.race-time'), phase: lane.querySelector('.race-phase'), counts: lane.querySelector('.race-counts'),
    };
  });
  const profile = $('compare-profile'), play = $('race-play'), replay = $('race-replay');
  const addForm = $('race-add-form'), addStatus = $('race-add-status'), viewChoice = $('race-view');
  const report = $('race-report');
  const motion = { running: false, previous: null, accumulator: 0, frame: 0, lastStatus: 0 };
  const createRace = () => new ComparisonRace(profile.value, profile.value === 'main' ? { source: mainTraffic() } : {});
  let race = createRace();
  let result = null, viewRequest = 0, views = [], ready3D = false, lastCamera = '', viewStatus = '';
  const sec = value => t('seconds', { n: value.toFixed(2) });
  const policyName = key => t(key === 'smart' ? 'smart' : 'fixedTiming');
  const beforeCustom = () => !motion.running && race.profile === 'custom' && race.stepNumber === 0;
  const canAdd = () => !race.winner && !race.done && race.trace.length < race.arrivalLimit && (motion.running || beforeCustom() || (race.profile === 'main' && race.stepNumber === 0));

  function invalidate() {
    if (dialog.open && !motion.frame) motion.frame = requestAnimationFrame(frame);
  }

  function frame(now) {
    motion.frame = 0;
    if (!dialog.open) return;
    if (motion.running) {
      const delta = motion.previous === null ? 0 : Math.min((now - motion.previous) / 1000, .12);
      motion.previous = now;
      motion.accumulator += delta * Number($('race-speed').value);
      const previousWinner = race.winner;
      while (motion.accumulator >= RACE_STEP && !race.done) {
        race.step();
        motion.accumulator -= RACE_STEP;
      }
      if (race.done) {
        result = race.report();
        setRunning(false);
        report.open = true;
      } else if (previousWinner !== race.winner || now - motion.lastStatus >= 100) {
        refreshStatus();
        motion.lastStatus = now;
      }
    }
    draw(now);
    if (motion.running) invalidate();
  }

  function draw(now) {
    const alpha = motion.running ? motion.accumulator / RACE_STEP : 1;
    const layouts = panels.map(({ key }) => {
      const { sim, finishedAt } = race.sides[key];
      return queueLayout(sim, finishedAt === null ? alpha : 1);
    });
    const reach = Math.max(...layouts.map(layout => layout.reach));
    if (ready3D) {
      // Round each arm outwards to keep the camera stable between queue changes.
      const armReach = Object.fromEntries(SIDES.map(side => [side, Math.ceil(Math.max(...layouts.map(layout => layout.armReach[side])) / 100) * 100]));
      const cameraKey = Object.values(armReach).join(':');
      if (lastCamera !== cameraKey) {
        for (const view of views) view.setShot('top', true, { reach, armReach });
        lastCamera = cameraKey;
      }
      try {
        views.forEach((view, i) => {
          const { sim, finishedAt } = race.sides[panels[i].key];
          const progress = finishedAt === null ? alpha : 1;
          view.render(sim, progress, {
            reducedMotion: reducedMotion(), now: sim.time * 1000,
            motionTime: Math.max(0, sim.time - RACE_STEP * (1 - progress)),
          });
        });
        return;
      } catch { fallback(); }
    }
    const span = queueViewSpan(reach);
    panels.forEach(({ key, map }, i) => {
      const { sim, finishedAt } = race.sides[key];
      drawJunction(map, sim, { markers: false, span, layout: layouts[i], alpha: finishedAt === null ? alpha : 1, reducedMotion: reducedMotion() });
    });
  }

  function disposeViews() {
    viewRequest++;
    ready3D = false;
    lastCamera = '';
    $('race-views').dataset.renderer = '2d';
    for (const view of views) view.dispose();
    views = [];
    for (const panel of panels) panel.board.querySelector('.race-3d')?.remove();
  }

  function setViewStatus(key) {
    viewStatus = key;
    const status = $('race-view-status');
    status.hidden = !key;
    text(status, key ? t(key) : '');
  }

  function fallback() {
    disposeViews();
    viewChoice.value = '2d';
    setViewStatus('race3DFailed');
    invalidate();
  }

  async function changeView() {
    disposeViews();
    setViewStatus('');
    if (viewChoice.value === '2d') { invalidate(); return; }
    const request = viewRequest;
    setViewStatus('race3DLoading');
    try {
      const { TownView } = await import('./town.js');
      if (request !== viewRequest || !dialog.open) return;
      const { city, time, weather } = environment();
      const quality = innerWidth <= 720 ? 'performance' : 'balanced';
      for (const panel of panels) {
        const canvas = document.createElement('canvas');
        canvas.className = 'race-3d';
        canvas.setAttribute('aria-hidden', 'true');
        panel.board.append(canvas);
        canvas.addEventListener('webglcontextlost', () => { if (request === viewRequest) fallback(); });
        const view = new TownView(canvas, panel.board, [], invalidate, () => {}, { interactive: false });
        views.push(view);
        view.setAtmosphere(time, weather);
        view.setQuality(quality);
      }
      await Promise.all(views.map(view => view.setCity(city)));
      if (request !== viewRequest || !dialog.open) return;
      ready3D = true;
      $('race-views').dataset.renderer = '3d';
      setViewStatus('');
      invalidate();
    } catch { if (request === viewRequest) fallback(); }
  }

  function refreshStatus() {
    text($('race-clock'), sec(race.time));
    const difference = result?.difference;
    const outcome = race.winner === 'tie' ? t('raceTie') :
      race.winner ? t('raceWinner', { policy: policyName(race.winner), time: sec(race.sides[race.winner].finishedAt) }) :
      race.timedOut ? t('raceTimeout') : t(motion.running ? 'raceRunning' : race.stepNumber ? 'paused' : 'raceReady');
    const end = difference > 0 ? ' · ' + t('raceGap', { time: sec(difference) }) :
      race.timedOut && race.winner ? ' · ' + t('raceTimeout') : '';
    text($('race-outcome'), outcome + end);
    for (const panel of panels) {
      const { sim, finishedAt } = race.sides[panel.key];
      panel.lane.dataset.winner = String(race.winner === panel.key);
      text(panel.time, finishedAt === null ? '—' : sec(finishedAt));
      const routes = [...sim.activeRoutes].map(route).join(' + ');
      const status = finishedAt !== null ? t('raceCleared') : race.timedOut ? t('raceTimeout') :
        sim.state === 'GREEN' ? t('raceGreen', { routes }) : t(sim.state === 'AMBER' ? 'amber' : 'raceAllRed');
      text(panel.phase, status);
      text(panel.counts, t('raceCounts', { admitted: sim.waitSamples.length, waiting: race.nextArrival - sim.waitSamples.length }));
    }
    text(play, t(motion.running ? 'pause' : 'play'));
    play.disabled = !race.hasTraffic || race.done;
    replay.disabled = !race.hasTraffic;
    profile.disabled = motion.running;
    const addAllowed = canAdd();
    for (const field of addForm.elements) field.disabled = !addAllowed;
    $('race-time-field').hidden = !beforeCustom();
    const seconds = addForm.elements.namedItem('seconds');
    seconds.disabled = !beforeCustom();
    $('race-clear').hidden = !beforeCustom();
    $('race-clear').disabled = !beforeCustom() || !race.trace.length;
  }

  function refreshSchedule() {
    text($('race-schedule'), t('raceSchedule', { n: race.trace.length, max: race.arrivalLimit }));
    const sourceInfo = $('race-source');
    sourceInfo.hidden = !race.source;
    if (race.source) {
      const { snapshot, initialCount, carryoverCount } = race.source;
      const people = race.source.trace.slice(0, initialCount).filter(record => record.movement === 'walk').length;
      text(sourceInfo, t('raceMainSummary', {
        time: sec(snapshot.time), cars: initialCount - people, people, clearing: carryoverCount,
      }) + ' · ' + t(snapshot.auto ? 'raceMainAuto' : 'raceMainManual'));
    }
    const list = $('race-arrivals');
    const show = race.profile === 'custom' && race.trace.length > 0;
    list.hidden = !show;
    list.replaceChildren();
    if (!show) return;
    const grouped = new Map();
    for (const { side, movement, step } of race.trace) {
      const key = `${side}/${movement}/${step}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    for (const [key, n] of grouped) {
      const [side, movement, step] = key.split('/');
      const item = document.createElement('li');
      item.textContent = `${sec(Number(step) * RACE_STEP)} · ${name(side)} · ${t(movement === 'straight' ? 'through' : movement === 'walk' ? 'ped' : 'left')} × ${n}`;
      list.append(item);
    }
  }

  function refreshReport() {
    report.hidden = !result;
    if (!result) { report.open = false; return; }
    const labels = [['mean', 'compareMean'], ['p95', 'compareP95'], ['served', 'compareServed'], ['queued', 'compareQueued']];
    text($('race-method'), t(race.source ? 'compareMainMethod' : 'compareMethodTimings', {
      green: race.sides.fixed.sim.timings.maxGreen, walk: race.sides.fixed.sim.timings.walk,
    }));
    $('compare-results').innerHTML = RACE_POLICIES.map(key => {
      const { metrics, finishedAt } = result[key];
      const groups = ['vehicle', 'pedestrian'].map(kind => {
        const values = metrics[kind];
        const rows = labels.map(([field, label]) => {
          const value = values[field];
          const display = value === null ? '—' : field === 'mean' || field === 'p95' ? sec(value) : value;
          return `<div><dt>${t(label)}</dt><dd>${display}</dd></div>`;
        });
        if (values.unserved) rows.push(`<div><dt>${t('compareUnserved')}</dt><dd>${values.unserved}</dd></div>`);
        return `<h4>${t(kind === 'vehicle' ? 'cars' : 'people')}</h4><dl>${rows.join('')}</dl>`;
      });
      return `<section class="compare-card" data-policy="${key}"><h3>${policyName(key)}</h3><p>${finishedAt === null ? t('raceTimeout') : t('raceCleared') + ' · ' + sec(finishedAt)}</p>${groups.join('')}</section>`;
    }).join('');
  }

  function setRunning(running) {
    motion.running = running;
    motion.previous = null;
    refreshStatus();
    refreshReport();
    invalidate();
  }

  function reset(nextRace, run) {
    if (nextRace === race) race.reset();
    else race = nextRace;
    result = null;
    addStatus.textContent = '';
    motion.accumulator = 0;
    setRunning(run);
    refreshSchedule();
  }

  function refreshLanguage() {
    const side = $('race-side');
    const selected = side.value || SIDES[0];
    side.replaceChildren(...SIDES.map(key => new Option(name(key), key)));
    side.value = selected;
    setViewStatus(viewStatus);
    refreshStatus();
    refreshSchedule();
    refreshReport();
  }

  play.onclick = () => setRunning(!motion.running);
  replay.onclick = () => reset(race, true);
  profile.onchange = () => {
    reset(createRace(), false);
    if (profile.value === 'custom') $('race-add').open = true;
  };
  viewChoice.onchange = changeView;
  $('race-clear').onclick = () => reset(new ComparisonRace('custom'), false);
  addForm.onsubmit = event => {
    event.preventDefault();
    if (!canAdd()) return;
    const data = new FormData(addForm);
    const count = Number(data.get('count'));
    const ok = race.add({ side: data.get('side'), movement: data.get('movement'), count, seconds: Number(data.get('seconds')) }, motion.running);
    text(addStatus, ok ? t('raceAdded', { n: count }) : t('raceInvalid', { max: race.arrivalLimit }));
    refreshStatus();
    refreshSchedule();
    invalidate();
  };
  $('compare-export').onclick = () => { if (result) void saveCsv(comparisonCsv(result), 'trafficlab-strategy-comparison.csv'); };
  dialog.addEventListener('close', () => {
    setRunning(false);
    cancelAnimationFrame(motion.frame);
    motion.frame = 0;
    disposeViews();
    viewChoice.value = '2d';
    setViewStatus('');
    onClose();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && motion.running) setRunning(false);
  });

  return {
    open({ running = false, speed = 1 } = {}) {
      profile.value = 'main';
      $('race-speed').value = String(speed);
      reset(createRace(), running);
      dialog.showModal();
      invalidate();
    },
    refreshLanguage,
  };
}
