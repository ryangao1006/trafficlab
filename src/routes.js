// Right-hand traffic. New mode has separate outer through / inner left lanes.
// Distances are path length in model pixels, shared by movement and rendering.
const RADIUS = 155;
export const TURN_START = 370;
export const TURN_END = TURN_START + Math.PI * RADIUS / 2;
export const LEFT_DESTINATION = Object.freeze({ N: 'East', E: 'South', S: 'West', W: 'North' });
export const laneGap = movement => movement === 'left' ? 72 : 59;
export const isLeft = car => car.movement === 'left';
export const clearanceDistance = car => isLeft(car) ? TURN_END + 70 : 700;
export const routeLength = car => isLeft(car) ? TURN_END + 440 : 1070;
export function vehiclePose(car, distance = car.s, mode = 'straight') {
  let x = mode !== 'straight' ? 415 : 435, y = distance, r = Math.PI;
  if (isLeft(car)) {
    x = 475;
    if (distance >= TURN_START && distance < TURN_END) {
      const angle = (distance - TURN_START) / RADIUS;
      x = 630 - RADIUS * Math.cos(angle);
      y = 370 + RADIUS * Math.sin(angle);
      r = Math.PI - angle;
    } else if (distance >= TURN_END) {
      x = 630 + distance - TURN_END; y = 525; r = Math.PI / 2;
    }
  }
  const turns = { N: 0, E: 1, S: 2, W: 3 }[car.direction];
  for (let i = 0; i < turns; i++) [x, y] = [1000 - y, x];
  return { x, y, r: r + turns * Math.PI / 2 };
}
