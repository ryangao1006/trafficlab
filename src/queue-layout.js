import { routeKey } from './conflicts.js';
import { laneGap, vehiclePose } from './routes.js';

export const queueRoadBase = 2380;
const interpolate = (start, end, alpha) => (start ?? end) + (end - (start ?? end)) * alpha;

function pedestrianPose(person, progress, index) {
  const offset = index * 22, lane = (person.id % 3 - 1) * 5;
  const { crossing, side } = person;
  if (side === 'N') return [crossing ? 335 + 330 * progress : 318 - offset, 349 + (crossing ? lane : 0), Math.PI / 2];
  if (side === 'S') return [crossing ? 665 - 330 * progress : 682 + offset, 651 + (crossing ? lane : 0), -Math.PI / 2];
  if (side === 'E') return [650 + (crossing ? lane : 0), crossing ? 335 + 330 * progress : 318 - offset, Math.PI];
  return [350 + (crossing ? lane : 0), crossing ? 665 - 330 * progress : 682 + offset, 0];
}

export function queueLayout(sim, alpha) {
  const cars = [], people = [], waitingPeople = [];
  const rear = new Map(), ranks = { N: 0, E: 0, S: 0, W: 0 };
  const armReach = { N: 500, E: 500, S: 500, W: 500 };
  for (const car of sim.cars) {
    const key = routeKey(car.direction, car.movement);
    const s = interpolate(car.previousS, car.s, alpha);
    rear.set(key, Math.min(rear.get(key) ?? Infinity, s));
  }
  for (const [key, queue] of sim.queuedCars) {
    const gap = Math.max(60, laneGap(queue[0].movement));
    let s = Math.min(0, (rear.get(key) ?? gap) - gap);
    for (const car of queue) {
      cars.push({ car, ...vehiclePose(car, s, sim.mode) });
      s -= gap;
    }
    const direction = queue[0].direction;
    armReach[direction] = Math.max(armReach[direction], 500 - s);
  }
  function place(person, list) {
    const progress = interpolate(person.previousProgress, person.progress, alpha);
    const [x, y, r] = pedestrianPose(person, progress, person.crossing ? 0 : ranks[person.side]++);
    list.push({ person, progress, x, y, r });
    if (!person.crossing) {
      const arm = { N: 'W', E: 'N', S: 'E', W: 'S' }[person.side];
      armReach[arm] = Math.max(armReach[arm], Math.abs(x - 500) + 20, Math.abs(y - 500) + 20);
    }
  }
  for (const person of sim.pedestrians) place(person, people);
  for (const queue of sim.queuedPedestrians.values()) {
    for (const person of queue) place(person, waitingPeople);
  }
  return { cars, people, waitingPeople, armReach, reach: Math.max(...Object.values(armReach)) };
}

export function queueViewSpan(reach) {
  return reach <= 500 ? 1000 : 2 * (reach + 55);
}
