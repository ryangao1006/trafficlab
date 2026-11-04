import { SIDES, Simulation } from './engine.js';
import { routeKey } from './conflicts.js';

const PHASES = [
  ['N_T', 'S_T'], ['N_L', 'S_L'], ['E_T', 'W_T'], ['E_L', 'W_L'],
  SIDES.map(side => `P_${side}`),
];

export class FixedTiming extends Simulation {
  constructor(timings = {}) { super(timings, 'smart', null); }
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
    const duration = hasCars ? this.timings.maxGreen : this.timings.walk;
    // Tolerate floating-point rounding at the exact fixed step boundary.
    return { hasCars, min: duration, max: duration - 1e-9 };
  }
}

export const COMPARE_PROFILES = ['rush', 'quiet', 'one-sided', 'pedestrian'];
const STEPS_PER_SECOND = 20;
export const RACE_STEP = 1 / STEPS_PER_SECOND;
export const MAX_RACE_ARRIVALS = 1000;
export const MAX_CUSTOM_TIME = 600;
export const RACE_POLICIES = ['smart', 'fixed'];
const HORIZON = 120 * STEPS_PER_SECOND;
const DRAIN_LIMIT = 1800 * STEPS_PER_SECOND;

function comparisonArrivals(profile, seed = 17) {
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
    sim.step(RACE_STEP);
    if (next === trace.length && sim.waitSamples.length === trace.length) break;
  }
  return summarize(sim, trace);
}

function summarize(sim, trace, useRecordedIds = false) {
  const admitted = new Map(sim.waitSamples.map(sample => [sample.id, sample.time]));
  const records = trace.map((arrival, i) => {
    const time = arrival.arrivalTime ?? arrival.step / STEPS_PER_SECOND;
    const admission = admitted.get(useRecordedIds ? arrival.id : i + 1);
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
      served, queued: group.filter(record => record.time < HORIZON / STEPS_PER_SECOND).length - served, unserved: group.length - waits.length,
    };
  }
  return { metrics, records };
}

export function compareStrategies(profile) {
  if (!COMPARE_PROFILES.includes(profile)) throw new Error('Unknown comparison profile');
  const trace = comparisonArrivals(profile);
  return {
    profile,
    smart: replay(new Simulation({}, 'smart'), trace),
    fixed: replay(new FixedTiming(), trace),
  };
}

export function comparisonCsv(result) {
  const rows = [['profile', 'strategy', 'kind', 'side', 'movement', 'arrival_s', 'admission_s', 'wait_s']];
  const race = Object.hasOwn(result, 'winner');
  if (race) rows[0].push('cleared_s', 'difference_s', 'winner');
  if (result.sourceTime !== undefined) rows[0].push('main_time_s', 'initial');
  for (const policy of RACE_POLICIES) {
    for (const record of result[policy].records) {
      const row = [result.profile, policy, record.movement === 'walk' ? 'pedestrian' : 'vehicle',
        record.side, record.movement, record.time.toFixed(2), record.admission?.toFixed(2) ?? '', record.wait?.toFixed(2) ?? ''];
      if (race) row.push(result[policy].finishedAt?.toFixed(2) ?? '', result.difference?.toFixed(2) ?? '', result.winner ?? '');
      if (result.sourceTime !== undefined) row.push(result.sourceTime.toFixed(2), record.initial ? 'true' : 'false');
      rows.push(row);
    }
  }
  return rows.map(row => row.join(',')).join('\n');
}

// Capture the visible junction and its overflow queues without changing the main run.
export function captureMainTraffic(sim) {
  const snapshot = structuredClone({
    cars: sim.cars, pedestrians: sim.pedestrians,
    queuedCars: [...sim.queuedCars], queuedPedestrians: [...sim.queuedPedestrians], requests: [...sim.requests],
    nextId: sim.nextId, timings: sim.timings, time: sim.time, mode: sim.mode,
    auto: sim.auto, seed: sim.seed, arrivalClock: sim.arrivalClock, arrivalPeriod: sim.arrivalPeriod,
  });
  const trace = [];
  const requestTimes = new Map(snapshot.requests.map(([key, time]) => [key, time - snapshot.time]));
  const allCars = [...snapshot.cars, ...snapshot.queuedCars.flatMap(([, queue]) => queue)];
  const allPeople = [...snapshot.pedestrians, ...snapshot.queuedPedestrians.flatMap(([, queue]) => queue)];
  for (const car of allCars) {
    const previousGroup = car.group;
    car.group = routeKey(car.direction, car.movement);
    if (!car.served && requestTimes.has(previousGroup)) requestTimes.set(car.group, requestTimes.get(previousGroup));
    car.born = (car.born ?? snapshot.time - car.wait) - snapshot.time;
    if (car.queuedAt !== undefined) car.queuedAt -= snapshot.time;
    if (!car.served) trace.push({ step: 0, arrivalTime: 0, side: car.direction, movement: car.movement ?? 'straight', id: car.id, initial: true });
  }
  for (const person of allPeople) {
    person.born -= snapshot.time;
    if (!person.crossing) trace.push({ step: 0, arrivalTime: 0, side: person.side, movement: 'walk', id: person.id, initial: true });
  }
  snapshot.requests = [...requestTimes];
  trace.sort((a, b) => a.id - b.id);
  const initialCount = trace.length;
  const carryoverCount = snapshot.cars.filter(car => car.served).length + snapshot.pedestrians.filter(person => person.crossing).length;
  let clock = snapshot.arrivalClock;
  let seed = snapshot.seed;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (snapshot.auto) {
    for (let step = 0; step < HORIZON; step++) {
      clock += RACE_STEP;
      if (clock < snapshot.arrivalPeriod) continue;
      clock = 0;
      let side, movement;
      if (random() < .24) {
        side = SIDES[Math.floor(random() * 4)];
        movement = 'walk';
      } else {
        side = SIDES[Math.floor(random() * 4)];
        movement = snapshot.mode !== 'straight' && random() < .35 ? 'left' : 'straight';
      }
      trace.push({ step, arrivalTime: (step + 1) * RACE_STEP, side, movement });
    }
  }
  return { snapshot, trace, initialCount, carryoverCount };
}

export class ComparisonRace {
  constructor(profile = 'rush', { seed = 17, demandPolicy, source } = {}) {
    if (!COMPARE_PROFILES.includes(profile) && !['custom', 'main'].includes(profile)) throw new Error('Unknown race profile');
    if (profile === 'main' && !source) throw new Error('Main traffic snapshot is required');
    this.profile = profile;
    this.source = profile === 'main' ? structuredClone(source) : null;
    this.demandPolicy = demandPolicy;
    this.trace = this.source ? structuredClone(this.source.trace) : profile === 'custom' ? [] : comparisonArrivals(profile, seed);
    this.arrivalLimit = Math.max(MAX_RACE_ARRIVALS, this.trace.length);
    this.reset();
  }

  reset() {
    this.stepNumber = 0;
    this.nextArrival = 0;
    this.sides = {
      smart: { sim: new Simulation(this.source?.snapshot.timings, 'smart', this.demandPolicy), finishedAt: null },
      fixed: { sim: new FixedTiming(this.source?.snapshot.timings), finishedAt: null },
    };
    if (this.source) {
      this.nextArrival = this.source.initialCount;
      for (const record of this.trace) if (!record.initial) delete record.id;
      for (const key of RACE_POLICIES) {
        const { sim } = this.sides[key];
        if (key === 'fixed') sim.phaseIndex = -1;
        const snapshot = structuredClone(this.source.snapshot);
        sim.cars = snapshot.cars;
        sim.pedestrians = snapshot.pedestrians;
        sim.queuedCars = new Map(snapshot.queuedCars);
        sim.queuedPedestrians = new Map(snapshot.queuedPedestrians);
        sim.nextId = snapshot.nextId;
        sim.state = sim.junctionOccupied() ? 'ALL_RED' : 'IDLE';
        sim.elapsed = 0;
        sim.current = null;
        sim.activeRoutes.clear();
        sim.updateRequests();
        for (const [key, since] of snapshot.requests) {
          if (sim.requests.has(key)) sim.requests.set(key, Math.min(since, sim.requests.get(key)));
        }
      }
    }
    this.winner = null;
    this.timedOut = false;
  }

  get time() { return this.stepNumber / STEPS_PER_SECOND; }
  get hasTraffic() { return this.trace.length > 0 || (this.source?.carryoverCount ?? 0) > 0; }
  get done() { return this.timedOut || RACE_POLICIES.every(key => this.sides[key].finishedAt !== null); }

  add({ side, movement, count, seconds }, live = false) {
    if (this.winner || this.done || (live ? this.stepNumber >= DRAIN_LIMIT : !['custom', 'main'].includes(this.profile) || this.stepNumber !== 0)) return false;
    if (!SIDES.includes(side) || !['walk', 'left', 'straight'].includes(movement) ||
        !Number.isInteger(count) || count < 1 || this.trace.length + count > this.arrivalLimit ||
        (!live && (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_CUSTOM_TIME))) return false;
    const step = live ? this.stepNumber : Math.round(seconds * STEPS_PER_SECOND);
    const additions = Array.from({ length: count }, () => ({ step, side, movement }));
    this.trace.push(...additions);
    this.trace.sort((a, b) => a.step - b.step);
    return true;
  }

  step() {
    if (this.done || !this.hasTraffic) return;
    while (this.trace[this.nextArrival]?.step === this.stepNumber) {
      const record = this.trace[this.nextArrival++];
      const { side, movement } = record;
      if (this.source) record.id = this.sides.smart.sim.nextId;
      for (const key of RACE_POLICIES) {
        const { sim } = this.sides[key];
        if (movement === 'walk') sim.addPedestrian(side);
        else sim.addCar(side, movement);
      }
    }
    this.stepNumber++;
    for (const key of RACE_POLICIES) {
      const entry = this.sides[key];
      if (entry.finishedAt !== null) continue;
      entry.sim.step(RACE_STEP);
      if (this.nextArrival === this.trace.length && entry.sim.waitSamples.length === this.trace.length && !entry.sim.junctionOccupied()) {
        entry.finishedAt = this.time;
      }
    }
    if (!this.winner) {
      const finished = RACE_POLICIES.filter(key => this.sides[key].finishedAt !== null);
      this.winner = finished.length === 2 ? 'tie' : finished[0] ?? null;
    }
    if (!this.done && this.stepNumber >= DRAIN_LIMIT) this.timedOut = true;
  }

  report() {
    const result = { profile: this.profile, winner: this.winner };
    if (this.source) result.sourceTime = this.source.snapshot.time;
    for (const key of RACE_POLICIES) {
      const { sim, finishedAt } = this.sides[key];
      result[key] = { ...summarize(sim, this.trace, !!this.source), finishedAt };
    }
    result.difference = RACE_POLICIES.every(key => result[key].finishedAt !== null)
      ? Math.abs(result.smart.finishedAt - result.fixed.finishedAt) : null;
    return result;
  }
}
