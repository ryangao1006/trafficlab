import { LONG_REQUEST_WAIT, SMART_ROUTES, routeKey, routeName, isWalkRoute, chooseRoutes, routesConflict } from './conflicts.js';
import { clearanceDistance, laneGap, routeLength } from './routes.js';
import { DEMAND_POLICY } from './demand-policy.js';
export const GROUPS = ['NS', 'EW', 'PED'];
export const TURN_GROUPS = ['NS', 'EW', 'NS_LEFT', 'EW_LEFT', 'PED'];
export const DEFAULT_TIMINGS = Object.freeze({ minGreen: 3, maxGreen: 10, amber: 1, allRed: 1, walk: 4, pedestrianClear: 1 });
export const groupFor = (direction, movement = 'straight') => (['N', 'S'].includes(direction) ? 'NS' : 'EW') + (movement === 'left' ? '_LEFT' : '');
// Side names identify the road arm crossed, not the person's walking direction.
export const SIDES = ['N', 'E', 'S', 'W'];
export const CROSSING_SECONDS = 3;
const VISIBLE_WALK_QUEUE = 8;
function enqueue(queues, key, actor) {
  if (!queues.has(key)) queues.set(key, []);
  queues.get(key).push(actor);
}
function dequeue(queues, key) {
  const queue = queues.get(key);
  if (!queue) return;
  const actor = queue.shift();
  if (!queue.length) queues.delete(key);
  return actor;
}
export const compatibleCrossing = (group, side) =>
  (group === 'NS' && ['E', 'W'].includes(side)) || (group === 'EW' && ['N', 'S'].includes(side));
export class Simulation {
  constructor(timings = {}, mode = 'straight', demandPolicy = DEMAND_POLICY) {
    this.demandPolicy = demandPolicy;
    this.timings = { ...DEFAULT_TIMINGS, ...timings }; this.setMode(mode);
  }
  get groups() { return this.mode === 'smart' ? SMART_ROUTES : this.mode === 'left-turns' ? TURN_GROUPS : GROUPS; }
  get vehicleGroups() { return this.groups.filter(g => g !== 'PED' && !isWalkRoute(g)); }
  setMode(mode) {
    if (!['straight', 'left-turns', 'smart'].includes(mode)) throw new Error('Unknown junction mode.');
    this.mode = mode; this.reset();
  }
  reset() {
    this.time = 0; this.state = 'IDLE'; this.elapsed = 0; this.current = null; this.activeRoutes = new Set(); this.phaseServed = new Set();
    this.cars = []; this.pedestrians = []; this.queuedCars = new Map(); this.queuedPedestrians = new Map(); this.requests = new Map(); this.events = [];
    this.nextId = 1; this.servedCars = 0; this.servedPeople = 0; this.waitSamples = [];
    this.auto = false; this.arrivalClock = 0; this.seed = 17; this.arrivalPeriod = 3;
    this.log('All signals red. Ready for a request.','logReady');
  }
  log(message, code, data = {}) { this.events.unshift({ time: this.time, message, code, data }); this.events = this.events.slice(0, 60); }
  random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  addCar(direction, movement = 'straight') {
    if (!['N', 'S', 'E', 'W'].includes(direction)) return false;
    if (!['straight', 'left'].includes(movement) || (movement === 'left' && this.mode === 'straight')) return false;
    const key = routeKey(direction, movement);
    const car = { id: this.nextId++, direction, movement,
      group: this.mode === 'smart' ? key : groupFor(direction, movement), born: this.time,
      s: 0, v: 0, previousS: 0, wait: 0, served: false };
    if (this.queuedCars.has(key) || !this.entryClear(car)) {
      enqueue(this.queuedCars, key, car);
      car.queuedAt = this.time;
    } else this.cars.push(car);
    return true;
  }
  entryClear({ direction, movement }) {
    return !this.cars.some(c => c.direction === direction &&
      (c.movement ?? 'straight') === movement && c.s < Math.max(60, laneGap(movement)));
  }
  admitQueuedCars() {
    for (const [key, queue] of this.queuedCars) {
      if (!this.entryClear(queue[0])) continue;
      const car = dequeue(this.queuedCars, key);
      car.wait = this.time - car.queuedAt;
      this.cars.push(car);
    }
  }
  addPedestrian(side = 'N') {
    if (!SIDES.includes(side)) return false;
    const person = { id: this.nextId++, side, born: this.time, crossing: false, progress: 0 };
    if (this.queuedPedestrians.has(side) ||
      this.pedestrians.filter(p => !p.crossing && p.side === side).length >= VISIBLE_WALK_QUEUE) {
      enqueue(this.queuedPedestrians, side, person);
    } else this.pedestrians.push(person);
    this.record(this.mode === 'smart' ? `P_${side}` : 'PED');
    return true;
  }
  record(group) {
    if (!this.requests.has(group)) this.requests.set(group, this.time);
  }
  demand(group) { return this.cars.some(c => c.group === group && !c.served && c.s >= 240); }
  updateRequests() {
    if (this.mode === 'smart') {
      for (const key of this.vehicleGroups) {
        if (this.demand(key) && (this.signal(key) !== 'green' || !this.phaseServed.has(key))) this.record(key);
        else this.requests.delete(key);
      }
      for (const side of SIDES) {
        const waiting = this.pedestrians.filter(p => p.side === side && !p.crossing);
        if (waiting.length) this.requests.set(`P_${side}`,Math.min(...waiting.map(p => p.born)));
        else this.requests.delete(`P_${side}`);
      }
      return;
    }
    for (const g of this.vehicleGroups) if (this.demand(g) && !(this.state === 'GREEN' && this.current === g)) this.record(g);
    // Sharing a phase must preserve the arrival time of any people still waiting.
    const waiting = this.pedestrians.filter(p => !p.crossing);
    if (waiting.length) this.requests.set('PED', Math.min(...waiting.map(p => p.born)));
    else this.requests.delete('PED');
  }
  nextGroup() {
    return this.groups.filter(g => this.requests.has(g)).sort((a, b) => this.requests.get(a) - this.requests.get(b) || this.groups.indexOf(a) - this.groups.indexOf(b))[0] ?? null;
  }
  selectGroup() {
    if (this.mode === 'smart') {
      const pending = new Map([...this.requests].filter(([k]) => this.state !== 'GREEN' || !this.activeRoutes.has(k)));
      const plan = this.demandPolicy ? this.demandPolicy.plan(this, [], pending) :
        chooseRoutes(pending,{count:k=>this.routeCount(k),now:this.time});
      return plan.find(key => !this.activeRoutes.has(key) || this.state !== 'GREEN') ?? null;
    }
    const oldest = this.nextGroup();
    if (oldest !== 'PED') return oldest;
    // Serve the oldest pedestrians together with a parallel vehicle direction when every
    // waiting pedestrian can cross in that vehicle phase. Otherwise keep their
    // exclusive walk phase, so incompatible pedestrians cannot be left behind.
    const waiting = this.pedestrians.filter(p => !p.crossing);
    return ['NS', 'EW'].find(g => waiting.length &&
      waiting.every(p => compatibleCrossing(g, p.side))) ?? oldest;
  }
  begin(group) {
    if (this.mode === 'smart') { this.beginSmartPhase(); return; }
    const paired = this.nextGroup() === 'PED' && group !== 'PED';
    const wait = this.time - this.requests.get(paired ? 'PED' : group);
    this.requests.delete(group); this.current = group; this.elapsed = 0;
    this.state = group === 'PED' ? 'WALK' : 'GREEN';
    this.log(`${group} selected: ${paired ? 'shares the oldest pedestrian request' : 'longest pending request'} (${wait.toFixed(1)} s).`,'logGroup',{route:group,why:paired?'parallel':'oldest',wait:wait.toFixed(1)});
    this.admitPedestrians();
  }
  pedestrianSignal(side) {
    if (!SIDES.includes(side)) return 'red';
    if (this.mode === 'smart') return this.state === 'GREEN' && this.activeRoutes.has(`P_${side}`) ? 'green' : 'red';
    return this.state === 'WALK' || (this.state === 'GREEN' && compatibleCrossing(this.current, side)) ? 'green' : 'red';
  }
  admitPedestrians() {
    const admitted = [];
    const occupied = new Set(this.pedestrians.filter(p => p.crossing && p.progress < .12).map(p => p.side));
    for (const person of this.pedestrians) if (!person.crossing && this.pedestrianSignal(person.side) === 'green') {
      if (occupied.has(person.side)) continue;
      occupied.add(person.side);
      person.crossing = true;
      admitted.push(person.side);
      this.waitSamples.push({ id: person.id, time: this.time, kind: 'pedestrian', wait: this.time - person.born });
    }
    if (admitted.length) {
      for (const side of admitted) {
        const next = dequeue(this.queuedPedestrians, side);
        if (next) this.pedestrians.push(next);
      }
      this.log(`${this.state === 'GREEN' ? (this.mode === 'smart' ? 'Shared walk' : 'Parallel walk') : 'Walk'}: ${[...new Set(admitted)].join('/')} crossing${admitted.length > 1 ? 's' : ''}, ${admitted.length} admitted.`,'logWalk',{sides:[...new Set(admitted)],n:admitted.length});
      this.updateRequests();
    }
  }
  signal(group) {
    // Aggregate only; rendering and conflict checks use each crosswalk's signal.
    if (this.mode === 'smart' && isWalkRoute(group)) return this.pedestrianSignal(group[2]);
    if (group === 'PED') return SIDES.some(side => this.pedestrianSignal(side) === 'green') ? 'green' : 'red';
    if (this.mode === 'smart') {
      if (!this.activeRoutes.has(group) || isWalkRoute(group)) return 'red';
      return this.state === 'GREEN' ? 'green' : this.state === 'AMBER' ? 'amber' : 'red';
    }
    if (this.current !== group) return 'red';
    return this.state === 'GREEN' ? 'green' : this.state === 'AMBER' ? 'amber' : 'red';
  }
  vehicleSignal(direction, movement = 'straight') {
    return this.signal(this.mode === 'smart' ? routeKey(direction,movement) : groupFor(direction,movement));
  }
  overflowCount(key) {
    if (isWalkRoute(key)) return this.queuedPedestrians.get(key[2])?.length ?? 0;
    if (key === 'PED') return [...this.queuedPedestrians.values()].reduce((n, queue) => n + queue.length, 0);
    if (this.mode === 'smart') return this.queuedCars.get(key)?.length ?? 0;
    let count = 0;
    for (const queue of this.queuedCars.values()) if (queue[0].group === key) count += queue.length;
    return count;
  }
  routeCount(key) {
    const visible = key === 'PED' || isWalkRoute(key)
      ? this.pedestrians.filter(p => !p.crossing && (key === 'PED' || p.side === key[2])).length
      : this.cars.filter(c => c.group === key && !c.served).length;
    return visible + this.overflowCount(key);
  }
  planRoutes(required = []) {
    if (this.demandPolicy) return this.demandPolicy.plan(this, required);
    return chooseRoutes(this.requests,{required,count:k=>this.routeCount(k),now:this.time});
  }
  beginSmartPhase(plan = this.planRoutes()) {
    if (!plan.length) return;
    this.current = plan[0]; this.activeRoutes = new Set(plan); this.phaseServed.clear(); this.state = 'GREEN'; this.elapsed = 0;
    const priority = this.current, n = this.routeCount(priority);
    this.log(`Smart green: ${plan.map(routeName).join(' + ')}. Priority: ${routeName(priority)} (${n} queued or approaching).`,
      'logSmart',{routes:plan,route:priority,n});
    this.admitPedestrians();
  }
  joinSmartRoutes() {
    const plan = this.planRoutes([...this.activeRoutes]);
    const added = plan.filter(k => !this.activeRoutes.has(k));
    if (!added.length) return;
    for (const key of added) this.activeRoutes.add(key);
    this.log(`Compatible arrivals join: ${added.map(routeName).join(' + ')}. Phase timer unchanged.`,'logJoin',{routes:added});
  }
  blockedBy(key) {
    return [...this.activeRoutes].find(active => routesConflict(key,active));
  }
  smartGreenLimits() {
    const hasCars = [...this.activeRoutes].some(k => !isWalkRoute(k));
    const min = hasCars ? this.timings.minGreen : this.timings.walk;
    return { hasCars, min, max: Math.max(min,this.timings.maxGreen) };
  }
  keepSmartGreen(hasCars) {
    if (this.demandPolicy) return this.demandPolicy.keepGreen(this, hasCars);
    // A moving car about to reach the sensor counts through the brief gap between cars.
    const approaching = new Set(this.cars.filter(c => !c.served && c.s + (c.v ?? 0)*.9 >= 240).map(c => c.group));
    const active = [...this.activeRoutes].reduce((n,key) =>
      n + (isWalkRoute(key) || approaching.has(key) ? this.routeCount(key) : 0),0);
    if (!active) return false;
    let competing = 0;
    for (const [key,since] of this.requests) {
      if (this.activeRoutes.has(key)) continue;
      if (this.time - since >= LONG_REQUEST_WAIT) return false;
      competing = Math.max(competing,this.routeCount(key));
    }
    return (hasCars && !competing) || active >= Math.max(4,competing*1.5);
  }
  hasPhaseDemand() { return this.requests.size > 0; }
  advanceSmartPhase() {
    if (this.state === 'IDLE') {
      if (this.hasPhaseDemand() && !this.junctionOccupied()) this.beginSmartPhase();
    } else if (this.state === 'GREEN') {
      const {hasCars,min,max} = this.smartGreenLimits();
      if (this.elapsed >= max || (this.elapsed >= min && !this.keepSmartGreen(hasCars))) {
        this.state = hasCars ? 'AMBER' : 'PED_CLEAR'; this.elapsed = 0;
        this.log(hasCars ? 'Smart green closes. Active vehicle lanes turn amber; walk signals turn red.' : 'Walk closes. Waiting for everyone already crossing to finish.',hasCars?'logClose':'logWalkClose');
      }
    } else if (this.state === 'AMBER' && this.elapsed >= this.timings.amber) {
      this.state='ALL_RED'; this.elapsed=0; this.log('Clearance: admitted vehicles and people finish their routes.','logClear');
    } else if (['ALL_RED','PED_CLEAR'].includes(this.state) && this.elapsed >= (this.state === 'PED_CLEAR' ? this.timings.pedestrianClear : this.timings.allRed)) {
      if (!this.junctionOccupied()) {
        this.state='IDLE';this.elapsed=0;this.current=null;this.activeRoutes.clear();
        if(this.hasPhaseDemand())this.beginSmartPhase();
      } else if (this.demandPolicy && this.hasPhaseDemand()) {
        this.beginSmartPhase(this.demandPolicy.plan(this, [], this.requests, true));
      }
    }
  }
  junctionOccupied() {
    return this.cars.some(c => c.served && c.s < clearanceDistance(c)) || this.pedestrians.some(p => p.crossing);
  }
  step(dt) {
    if (!(dt > 0) || dt > .1) throw new Error('Use fixed simulation steps of at most 0.1 seconds.');
    this.time += dt; this.elapsed += dt;
    if (this.auto) {
      this.arrivalClock += dt;
      if (this.arrivalClock >= this.arrivalPeriod) {
        this.arrivalClock = 0;
        if (this.random() < .24) this.addPedestrian(['N', 'E', 'S', 'W'][Math.floor(this.random() * 4)]);
        else {
          const direction = SIDES[Math.floor(this.random() * 4)];
          const movement = this.mode !== 'straight' && this.random() < .35 ? 'left' : 'straight';
          this.addCar(direction, movement);
        }
      }
    }
    // New arrivals can join an open crossing; a closed signal never admits them.
    if (this.mode === 'smart') {this.updateRequests();if(this.state === 'GREEN')this.joinSmartRoutes();}
    this.admitPedestrians();
    for (const dir of ['N', 'S', 'E', 'W']) for (const movement of (this.mode !== 'straight' ? ['straight', 'left'] : ['straight'])) {
      const lane = this.cars.filter(c => c.direction === dir && (c.movement ?? 'straight') === movement).sort((a, b) => b.s - a.s);
      let front = Infinity;
      for (const car of lane) {
        const permitted = car.served || this.vehicleSignal(car.direction,car.movement ?? 'straight') === 'green';
        const stopLine = this.mode === 'smart' ? 296 : 310;
        const limit = Math.min(front - laneGap(movement), permitted ? Infinity : stopLine);
        const distance = Math.max(0, limit - car.s);
        const desired = Math.min(movement === 'left' ? 100 : 130, Math.sqrt(2 * 180 * distance));
        const v = car.v ?? 0;
        car.v = desired > v ? Math.min(desired, v + 120 * dt) : Math.max(desired, v - 180 * dt);
        const previous = car.s;
        car.previousS = previous;
        car.s = Math.max(car.s, Math.min(car.s + car.v * dt, limit));
        if (car.s - previous < .01) car.v = 0;
        if (car.s - previous < 3 * dt && !car.served) car.wait += dt;
        if (!car.served && car.s > stopLine) {
          car.served = true; this.servedCars++;
          if(this.mode === 'smart')this.phaseServed.add(car.group);
          this.waitSamples.push({ id: car.id, time: this.time, kind: 'vehicle', wait: car.wait });
        }
        front = car.s;
      }
    }
    this.cars = this.cars.filter(c => c.s < routeLength(c));
    this.admitQueuedCars();
    for (const p of this.pedestrians) { p.previousProgress = p.progress; if (p.crossing) p.progress += dt / CROSSING_SECONDS; }
    this.pedestrians = this.pedestrians.filter(p => {
      if (p.crossing && p.progress >= 1) { this.servedPeople++; return false; } return true;
    });
    this.updateRequests();
    if(this.mode === 'smart'){this.advanceSmartPhase();return;}
    if (this.state === 'IDLE') {
      const group = this.selectGroup();
      if (group && !this.junctionOccupied()) this.begin(group);
    } else if (this.state === 'GREEN') {
      const other = this.groups.some(g => g !== this.current && this.requests.has(g));
      if (this.elapsed >= this.timings.maxGreen || (this.elapsed >= this.timings.minGreen && (other || !this.demand(this.current)))) {
        this.state = 'AMBER'; this.elapsed = 0; this.log(`${this.current} amber. Waiting vehicles stop.`,'logAmber',{route:this.current});
      }
    } else if (this.state === 'AMBER' && this.elapsed >= this.timings.amber) {
      const last = this.current; this.state = 'ALL_RED'; this.elapsed = 0; this.current = null;
      if (this.demand(last)) this.record(last);
      this.log('All-red clearance: traffic already inside keeps moving.','logClear');
    } else if (this.state === 'WALK' && this.elapsed >= this.timings.walk) {
      this.state = 'PED_CLEAR'; this.current = null; this.elapsed = 0;
      this.log('Pedestrian clearance. All vehicles remain red.','logPedClear');
    } else if ((this.state === 'ALL_RED' || this.state === 'PED_CLEAR') && this.elapsed >= (this.state === 'PED_CLEAR' ? this.timings.pedestrianClear : this.timings.allRed) && !this.junctionOccupied()) {
      this.state = 'IDLE'; this.elapsed = 0;
      const group = this.selectGroup();
      if (group) this.begin(group);
    }
  }
  loadScenario(name) {
    this.reset();
    if(this.mode === 'smart'){this.loadSmartScenario(name);return;}
    if (name === 'quiet') { this.addCar('N'); this.addCar('E'); }
    if (name === 'pedestrian') { this.addPedestrian('N'); this.addPedestrian('W'); this.addCar('E'); }
    if (name === 'busy') { for (const d of ['N', 'S', 'E', 'W']) this.addCar(d); this.addPedestrian('S'); this.auto = true; this.arrivalPeriod = 1.8; }
    if (name === 'simultaneous') { this.cars = ['N', 'E'].map(d => ({ id: this.nextId++, direction: d, group: groupFor(d), s: 310, wait: 0, served: false })); this.record('NS'); this.record('EW'); this.addPedestrian('N'); this.addPedestrian('E'); }
    if (this.mode === 'left-turns') {
      if (name === 'busy') for (const d of SIDES) this.addCar(d, 'left');
      if (name === 'simultaneous') {
        for (const d of SIDES) {
          this.addCar(d, 'left');
          this.cars.at(-1).s = this.cars.at(-1).previousS = 310;
          this.record(groupFor(d, 'left'));
        }
      }
    }
    this.log(`Scenario loaded: ${name} · ${this.mode === 'left-turns' ? 'protected left turns' : 'straight only'}.`,'logScenario',{scene:name,mode:this.mode});
  }
  loadSmartScenario(name) {
    if(name==='quiet'){this.addCar('N','left');this.addCar('W');}
    if(name==='pedestrian'){this.addPedestrian('N');this.addPedestrian('W');this.addCar('E','left');}
    if(name==='busy'){for(const d of SIDES){this.addCar(d);this.addCar(d,'left');}this.addPedestrian('N');this.addPedestrian('S');this.auto=true;this.arrivalPeriod=1.8;}
    if(name==='simultaneous'){
      for(const [d,m] of [['N','left'],['W','straight'],['S','straight']]){
        this.addCar(d,m);const c=this.cars.at(-1);c.s=c.previousS=296;this.record(c.group);
      }
      this.addPedestrian('S');
    }
    this.log(`Scenario loaded: ${name} · smart compatible routes.`,'logScenario',{scene:name,mode:this.mode});
  }
  average(kind) {
    const a = this.waitSamples.filter(s => s.kind === kind); return a.length ? a.reduce((s, r) => s + r.wait, 0) / a.length : null;
  }
}
