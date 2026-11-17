import { haversineKm } from './geo';
import type { LatLon, Route } from './types';

const BASE = 'https://router.project-osrm.org';

/**
 * Номер дороги міжнародного або національного значення:
 * E40, М-06, M 06, Н-02, A4, S7, DK94.
 */
const MAJOR_REF = /(^|[;,/]\s*)(E|М|M|Н|H|A|S|DK)[\s-]?\d{1,3}(?=$|[^\d])/i;

export function isMajorRef(ref: string | undefined | null): boolean {
  return !!ref && MAJOR_REF.test(ref.trim());
}

interface OsrmStep {
  distance: number;
  ref?: string;
  intersections?: { classes?: string[] }[];
}
interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { annotation?: { duration?: number[] }; steps?: OsrmStep[] }[];
}

export function parseOsrmRoute(r: OsrmRoute): Route {
  const coords: LatLon[] = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const n = coords.length;

  const cumDist = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cumDist[i] = cumDist[i - 1] + haversineKm(coords[i - 1], coords[i]) * 1000;
  const geomLen = cumDist[n - 1] || 1;
  for (let i = 0; i < n; i++) cumDist[i] = (cumDist[i] / geomLen) * r.distance;

  // Час по кожному відрізку з анотацій OSRM; якщо їх нема, ділимо пропорційно відстані.
  const seg = r.legs.flatMap((l) => l.annotation?.duration ?? []);
  const cumTime = new Array<number>(n).fill(0);
  if (seg.length === n - 1 && n > 1) {
    for (let i = 1; i < n; i++) cumTime[i] = cumTime[i - 1] + seg[i - 1];
    const sum = cumTime[n - 1] || 1;
    for (let i = 0; i < n; i++) cumTime[i] = (cumTime[i] / sum) * r.duration;
  } else {
    for (let i = 0; i < n; i++) cumTime[i] = (cumDist[i] / (r.distance || 1)) * r.duration;
  }

  const steps = r.legs.flatMap((l) => l.steps ?? []);
  const major = steps.reduce(
    (s, st) =>
      isMajorRef(st.ref) || st.intersections?.some((x) => x.classes?.includes('motorway'))
        ? s + st.distance
        : s,
    0,
  );

  return {
    coords,
    cumTime,
    cumDist,
    duration: r.duration,
    distance: r.distance,
    majorShare: r.distance > 0 ? Math.min(1, major / r.distance) : 0,
  };
}

export function routeUrl(from: LatLon, to: LatLon): string {
  const pts = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  return `${BASE}/route/v1/driving/${pts}?overview=full&geometries=geojson&annotations=duration&steps=true&alternatives=true`;
}

/** Найшвидші маршрути авто, перший найшвидший. */
export async function fetchRoutes(from: LatLon, to: LatLon): Promise<Route[]> {
  const res = await fetch(routeUrl(from, to));
  if (!res.ok) throw new Error(`Сервіс маршрутів відповів ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Маршрут між цими точками не знайдено');
  return (data.routes as OsrmRoute[]).map(parseOsrmRoute).sort((a, b) => a.duration - b.duration);
}
