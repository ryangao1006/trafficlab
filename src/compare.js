import { SIDES, Simulation } from './engine.js';

const PHASES = [
  ['N_T', 'S_T'], ['N_L', 'S_L'], ['E_T', 'W_T'], ['E_L', 'W_L'],
  SIDES.map(side => `P_${side}`),
];

export class FixedTiming extends Simulation {
  constructor() { super({}, 'smart'); }
  reset() {
    super.reset();
    this.phaseIndex = -1;
    this.advanceSmartPhase();
  }
  hasPhaseDemand() { return true; }
  beginSmartPhase() {
    this.phaseIndex = (this.phaseIndex + 1) % PHASES.length;
    this.activeRoutes = new Set(PHASES[this.phaseIndex]);
    this.current = PHASES[this.phaseIndex][0];
    this.phaseServed.clear();
    this.state = 'GREEN';
    this.elapsed = 0;
    this.admitPedestrians();
  }
  joinSmartRoutes() {}
  keepSmartGreen() { return true; }
  smartGreenLimits() {
    const hasCars = this.phaseIndex < PHASES.length - 1;
    const duration = hasCars ? 10 : 4;
    // Tolerate floating-point rounding at the exact fixed step boundary.
    return { hasCars, min: duration, max: duration - 1e-9 };
  }
}

export const COMPARE_PROFILES = ['rush', 'quiet', 'one-sided', 'pedestrian'];
const STEPS_PER_SECOND = 20;
const HORIZON = 120 * STEPS_PER_SECOND;
const DRAIN_LIMIT = 1800 * STEPS_PER_SECOND;

function arrivals(profile) {
  let seed = 17;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const interval = profile === 'quiet' ? 82 : profile === 'rush' ? 13 : 20;
  const pedestrianChance = profile === 'pedestrian' ? .65 : .23;
  const trace = [];
  for (let step = 0; step < HORIZON; step += interval) {
    const side = profile === 'one-sided' && random() < .77 ? 'E' : SIDES[Math.floor(random() * 4)];
    const movement = random() < pedestrianChance ? 'walk' : random() < .33 ? 'left' : 'straight';
    trace.push({ step, side, movement });
  }
  return trace;
}

function replay(sim, trace) {
  let next = 0;
  for (let step = 0; step < DRAIN_LIMIT; step++) {
    if (trace[next]?.step === step) {
      const { side, movement } = trace[next++];
      if (movement === 'walk') sim.addPedestrian(side);
      else sim.addCar(side, movement);
    }
    sim.step(1 / STEPS_PER_SECOND);
    if (next === trace.length && sim.waitSamples.length === trace.length) break;
  }
  const admitted = new Map(sim.waitSamples.map(sample => [sample.id, sample.time]));
  const records = trace.map((arrival, i) => {
    const time = arrival.step / STEPS_PER_SECOND;
    const admission = admitted.get(i + 1);
    return { ...arrival, time, admission, wait: admission === undefined ? undefined : admission - time };
  });
  const metrics = {};
  for (const kind of ['vehicle', 'pedestrian']) {
    const group = records.filter(record => (record.movement === 'walk') === (kind === 'pedestrian'));
    const waits = group.flatMap(record => record.wait === undefined ? [] : [record.wait]).sort((a, b) => a - b);
    const served = group.filter(record => record.admission <= HORIZON / STEPS_PER_SECOND + 1e-8).length;
    metrics[kind] = {
      mean: waits.length ? waits.reduce((sum, wait) => sum + wait, 0) / waits.length : null,
      p95: waits.length ? waits[Math.ceil(waits.length * .95) - 1] : null,
      served, queued: group.length - served, unserved: group.length - waits.length,
    };
  }
  return { metrics, records };
}

export function compareStrategies(profile) {
  if (!COMPARE_PROFILES.includes(profile)) throw new Error('Unknown comparison profile');
  const trace = arrivals(profile);
  return {
    profile,
    smart: replay(new Simulation({}, 'smart'), trace),
    fixed: replay(new FixedTiming(), trace),
  };
}

export function comparisonCsv(result) {
  const rows = [['profile', 'strategy', 'kind', 'side', 'movement', 'arrival_s', 'admission_s', 'wait_s']];
  for (const policy of ['smart', 'fixed']) {
    for (const record of result[policy].records) {
      rows.push([result.profile, policy, record.movement === 'walk' ? 'pedestrian' : 'vehicle',
        record.side, record.movement, record.time.toFixed(2), record.admission?.toFixed(2) ?? '', record.wait?.toFixed(2) ?? '']);
    }
  }
  return rows.map(row => row.join(',')).join('\n');
}
