export function validCenter(center) {
  return Array.isArray(center) && center.length === 2 && center.every(Number.isFinite) && Math.abs(center[0]) <= 90 && Math.abs(center[1]) <= 180;
}

export function validFence(center, radius) {
  return validCenter(center) && Number.isInteger(Number(radius)) && Number(radius) >= 50 && Number(radius) <= 50000;
}

export function crossedFence(old, next) {
  return Boolean(old?.is_active && next?.is_active &&
    ["INSIDE", "OUTSIDE"].includes(old.position) &&
    ["INSIDE", "OUTSIDE"].includes(next.position) && old.position !== next.position &&
    ["latitude", "longitude", "radius_m"].every((key) => old[key] === next[key]) &&
    Date.parse(next.last_recorded_at) > Date.parse(old.last_recorded_at));
}
