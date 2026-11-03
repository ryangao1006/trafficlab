import { vehiclePose, clearanceDistance } from './routes.js';
const SIDES = ['N', 'E', 'S', 'W'];
export const routeKey = (direction, movement = 'straight') => `${direction}_${movement === 'left' ? 'L' : 'T'}`;
export const SMART_ROUTES = [...SIDES.flatMap(d => [routeKey(d), routeKey(d, 'left')]), ...SIDES.map(d => `P_${d}`)];
export const isWalkRoute = key => key.startsWith('P_');
export const routeActor = key => ({ direction: key[0], movement: key.endsWith('_L') ? 'left' : 'straight' });
export const routeName = key => isWalkRoute(key) ? `${key[2]} crossing` : `${key[0]} ${key.endsWith('_L') ? 'left' : 'through'}`;
const footprint = (x, y, r, w, h) => ({ x, y, ux: Math.cos(r), uy: Math.sin(r), vx: -Math.sin(r), vy: Math.cos(r), w, h });
function overlaps(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [x, y] of [[a.ux,a.uy],[a.vx,a.vy],[b.ux,b.uy],[b.vx,b.vy]]) {
    const ra = a.w * Math.abs(a.ux*x+a.uy*y) + a.h * Math.abs(a.vx*x+a.vy*y);
    const rb = b.w * Math.abs(b.ux*x+b.uy*y) + b.h * Math.abs(b.vx*x+b.vy*y);
    if (Math.abs(dx*x+dy*y) > ra + rb) return false;
  }
  return true;
}
const walks = {
  P_N: footprint(500,349,0,180,21), P_E: footprint(650,500,0,21,180),
  P_S: footprint(500,651,0,180,21), P_W: footprint(350,500,0,21,180)
};
// Swept vehicle bodies, not centre lines. Four model pixels of padding cover
// the six-pixel sampling step and a little extra space around the drawn body.
const swept = new Map(SMART_ROUTES.filter(k => !isWalkRoute(k)).map(key => {
  const car = routeActor(key), samples = [];
  for (let s = 250; s <= clearanceDistance(car) + 24; s += 6) {
    const p = vehiclePose(car,s,'smart'); samples.push(footprint(p.x,p.y,p.r,24,33));
  }
  return [key,samples];
}));
const matrix = new Map();
export function routesConflict(a, b) {
  if (a === b) return false;
  // Crosswalks are on different road arms; their pavement corners are shared
  // walking space. Queue spacing is handled when pedestrians are admitted.
  if (isWalkRoute(a) && isWalkRoute(b)) return false;
  const cacheKey = [a,b].sort().join('|');
  if (!matrix.has(cacheKey)) {
    const aa = isWalkRoute(a) ? [walks[a]] : swept.get(a);
    const bb = isWalkRoute(b) ? [walks[b]] : swept.get(b);
    if (!aa || !bb) throw new Error('Unknown route in conflict check.');
    matrix.set(cacheKey,aa.some(x => bb.some(y => overlaps(x,y))));
  }
  return matrix.get(cacheKey);
}
export const LONG_REQUEST_WAIT = 12;

export function chooseRoutes(requests, { required = [], count = () => 1, now = 0 } = {}) {
  const age = key => Math.max(0, now - (requests.get(key) ?? now));
  const pending = SMART_ROUTES.filter(key => requests.has(key) && !required.includes(key));
  pending.sort((a,b) => requests.get(a) - requests.get(b));
  const overdue = !required.length && pending.length && age(pending[0]) >= LONG_REQUEST_WAIT;
  const base = overdue ? [pending[0]] : required;
  const candidates = pending.filter(k => !base.includes(k) && base.every(a => !routesConflict(a,k)));
  // Queue size dominates while waits are short. Overdue requests anchor the phase.
  const weight = new Map(candidates.map(key => [key, Math.max(1,count(key)) + age(key)*.25]));
  let best = base, bestScore = -1, bestAge = -1;
  function search(index, chosen, score, oldest) {
    if (index === candidates.length) {
      if (score > bestScore || (score === bestScore && oldest > bestAge)) {
        best = chosen; bestScore = score; bestAge = oldest;
      }
      return;
    }
    const key = candidates[index];
    if (chosen.every(a => !routesConflict(a,key))) {
      search(index+1,[...chosen,key],score+weight.get(key),Math.max(oldest,age(key)));
    }
    search(index+1,chosen,score,oldest);
  }
  search(0,base,0,0);
  // Keep the lead route first for the preview and decision log.
  if (base.length) return best;
  return [...best].sort((a,b) => weight.get(b)-weight.get(a) ||
    requests.get(a)-requests.get(b) || SMART_ROUTES.indexOf(a)-SMART_ROUTES.indexOf(b));
}
