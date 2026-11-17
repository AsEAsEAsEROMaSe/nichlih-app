import type { LatLon } from './types';

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Найближча точка ламаної до заданої координати.
 * Спершу грубий прохід з кроком, потім уточнення довкола найкращої точки:
 * маршрут на тисячу кілометрів має десятки тисяч точок, а готелів сотні.
 */
export function nearestIndex(coords: LatLon[], p: LatLon): { idx: number; km: number } {
  const n = coords.length;
  if (n === 0) return { idx: -1, km: Infinity };
  const cosLat = Math.cos(rad(p[0]));
  const d2 = (c: LatLon) => {
    const dy = c[0] - p[0];
    const dx = (c[1] - p[1]) * cosLat;
    return dx * dx + dy * dy;
  };
  const step = Math.max(1, Math.floor(n / 3000));
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i += step) {
    const d = d2(coords[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const lo = Math.max(0, best - step);
  const hi = Math.min(n - 1, best + step);
  for (let i = lo; i <= hi; i++) {
    const d = d2(coords[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { idx: best, km: haversineKm(coords[best], p) };
}

/** Проріджує ламану до приблизно max точок, зберігаючи першу й останню. */
export function thin<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.round(i * step)]);
  return out;
}
