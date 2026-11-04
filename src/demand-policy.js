import { chooseRoutes, isWalkRoute, LONG_REQUEST_WAIT, routesConflict, SMART_ROUTES } from './conflicts.js';
import { clearanceDistance, laneGap } from './routes.js';

const STOP_LINE = 296;
const ACCELERATION = 120;
const WALK_HEADWAY = .4;
const WALK_TRAVEL = 3;

function travelTime(car, distance) {
  const topSpeed = car.movement === 'left' ? 100 : 130;
  const speed = Math.min(topSpeed, car.v ?? 0);
  const accelerationTime = (topSpeed - speed) / ACCELERATION;
  const accelerationDistance = (speed + topSpeed) * accelerationTime / 2;
  if (distance >= accelerationDistance) return accelerationTime + (distance - accelerationDistance) / topSpeed;
  return (Math.sqrt(speed * speed + 2 * ACCELERATION * distance) - speed) / ACCELERATION;
}

function demand(sim) {
  const counts = new Map();
  const leads = new Map();
  const blocked = new Map();
  const crossings = new Map();
  for (const car of sim.cars) {
    if (car.served) {
      if (car.s < clearanceDistance(car)) {
        const time = travelTime(car, clearanceDistance(car) - car.s);
        blocked.set(car.group, Math.max(blocked.get(car.group) ?? 0, time));
      }
      continue;
    }
    counts.set(car.group, (counts.get(car.group) ?? 0) + 1);
    if (car.s > (leads.get(car.group)?.s ?? -1)) leads.set(car.group, car);
  }
  for (const [key, queue] of sim.queuedCars) counts.set(key, (counts.get(key) ?? 0) + queue.length);
  for (const person of sim.pedestrians) {
    const key = `P_${person.side}`;
    if (!person.crossing) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      continue;
    }
    blocked.set(key, Math.max(blocked.get(key) ?? 0, (1 - person.progress) * WALK_TRAVEL));
    crossings.set(key, Math.max(crossings.get(key) ?? 0, WALK_HEADWAY - person.progress * WALK_TRAVEL));
  }
  for (const [side, queue] of sim.queuedPedestrians) {
    const key = `P_${side}`;
    counts.set(key, (counts.get(key) ?? 0) + queue.length);
  }

  return {
    blocked, leads,
    capacity(key, seconds, entryDelay = 0) {
      const count = counts.get(key) ?? 0;
      if (!count || seconds <= 0) return 0;
      if (isWalkRoute(key)) {
        const first = Math.max(0, (crossings.get(key) ?? 0) - entryDelay);
        return Math.min(count, Math.max(0, 1 + Math.floor((seconds - first) / WALK_HEADWAY)));
      }
      const lead = leads.get(key);
      if (!lead) return 0;
      const headway = laneGap(lead.movement) / (lead.movement === 'left' ? 100 : 130) + .12;
      const first = Math.max(.05, travelTime(lead, Math.max(0, STOP_LINE - lead.s)) - entryDelay);
      return Math.min(count, Math.max(0, 1 + Math.floor((seconds - first) / headway)));
    },
  };
}

function oldestOverdue(sim, requests) {
  let oldest = null;
  let oldestTime = Infinity;
  for (const key of SMART_ROUTES) {
    const since = requests.get(key);
    if (since < oldestTime && sim.time - since >= LONG_REQUEST_WAIT) {
      oldest = key;
      oldestTime = since;
    }
  }
  return oldest;
}

const SELECTION_WINDOW = 3.5;
const DECISION_WINDOW = 6;
const APPROACH_LOOKAHEAD = 1;

export const DEMAND_POLICY = {
  plan(sim, required = [], requests = sim.requests, duringClearance = false) {
    const { blocked, capacity, leads } = demand(sim);
    const pending = new Map(requests);
    const overdue = oldestOverdue(sim, requests);
    for (const [key, car] of leads) {
      if (!pending.has(key) && car.s + (car.v ?? 0) * APPROACH_LOOKAHEAD >= 240) pending.set(key, sim.time);
    }
    const occupiedRoutes = [...blocked.keys()];
    const isClear = key => occupiedRoutes.every(occupied => !routesConflict(key, occupied));
    for (const key of pending.keys()) {
      if ((!duringClearance && !isClear(key)) ||
          (overdue && !required.includes(overdue) && routesConflict(key, overdue))) pending.delete(key);
    }
    const plan = chooseRoutes(pending, {
      required,
      count: key => capacity(key, SELECTION_WINDOW),
      now: sim.time,
    });
    // Keep the intended vehicle bundle intact while it clears. Independent
    // pedestrian crossings can open separately once their own conflict is gone.
    if (!duringClearance || plan.every(isClear)) return plan;
    return plan.every(isWalkRoute) ? plan.filter(isClear) : [];
  },

  keepGreen(sim, hasCars) {
    const pending = new Map([...sim.requests].filter(([key]) => !sim.activeRoutes.has(key)));
    if (oldestOverdue(sim, pending)) return false;
    const { blocked, capacity } = demand(sim);
    const { max } = sim.smartGreenLimits();
    const holdTime = Math.min(DECISION_WINDOW, max - sim.elapsed);
    const active = [...sim.activeRoutes].reduce((sum, key) => sum + capacity(key, holdTime), 0);
    if (!active) return false;
    if (!pending.size) return true;
    const minimumSwitch = hasCars ? sim.timings.amber + sim.timings.allRed : sim.timings.pedestrianClear;
    function canPassAfterSwitch(key) {
      let delay = minimumSwitch;
      for (const [occupied, remaining] of blocked) {
        if (routesConflict(key, occupied)) delay = Math.max(delay, remaining);
      }
      return capacity(key, DECISION_WINDOW - delay, delay);
    }
    const next = chooseRoutes(pending, { count: canPassAfterSwitch, now: sim.time });
    const competing = next.reduce((sum, key) => sum + canPassAfterSwitch(key), 0);
    return active >= competing;
  },
};
