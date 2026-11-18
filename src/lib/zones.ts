import type { LatLon, Route } from './types';

/**
 * Окуповані й сірі зони України (мапа DeepState, файл public/data/occupied.json,
 * оновлює scripts/occupied.mjs). Туди не будуємо маршрути й не пропонуємо ночівлі.
 */
export interface Zone {
  /** Кільця у порядку [довгота, широта], як у GeoJSON; перше зовнішнє, решта дірки. */
  rings: [number, number][][];
  box: [number, number, number, number];
}

export function parseZones(data: unknown): Zone[] {
  const features = (data as { features?: { geometry?: { type?: string; coordinates?: unknown } }[] })?.features;
  if (!Array.isArray(features)) return [];
  const out: Zone[] = [];
  for (const f of features) {
    if (f.geometry?.type !== 'Polygon' || !Array.isArray(f.geometry.coordinates)) continue;
    const rings = f.geometry.coordinates as [number, number][][];
    if (!rings[0]?.length) continue;
    let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of rings[0]) {
      a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y);
    }
    out.push({ rings, box: [a, b, c, d] });
  }
  return out;
}

/** Парно-непарне правило по всіх кільцях, тому дірки враховуються самі. */
export function inZones(zones: Zone[], lat: number, lon: number): boolean {
  for (const z of zones) {
    if (lon < z.box[0] || lon > z.box[2] || lat < z.box[1] || lat > z.box[3]) continue;
    let inside = false;
    for (const ring of z.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

/** Чи заходить маршрут у зони. Перевіряємо кожну n-ту точку: точки OSRM ідуть густо, десятки метрів. */
export function routeCrossesZones(zones: Zone[], route: Pick<Route, 'coords'>, step = 10): boolean {
  const pts: LatLon[] = route.coords;
  for (let i = 0; i < pts.length; i += step) if (inZones(zones, pts[i][0], pts[i][1])) return true;
  const last = pts[pts.length - 1];
  return last ? inZones(zones, last[0], last[1]) : false;
}

let cache: Promise<Zone[]> | null = null;

export function loadZones(): Promise<Zone[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/occupied.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then(parseZones)
    .catch(() => []);
  return cache;
}
