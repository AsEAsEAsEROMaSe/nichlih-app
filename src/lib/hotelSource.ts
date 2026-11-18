import { checkpointAt } from './checkpoints';
import { nearestIndex } from './geo';
import { fetchHotels, parseHotels, sectionLine } from './overpass';
import type { Hotel, LatLon, Route } from './types';
import { inZones, loadZones, type Zone } from './zones';

export interface Section {
  from: number;
  to: number;
}

/** Готелі в межах radiusKm від ділянки маршруту. Чиста функція, працює на власних даних. */
export function hotelsNearSection(all: Hotel[], route: Route, s: Section, radiusKm: number): Hotel[] {
  const i0 = checkpointAt(route, s.from).idx;
  const i1 = checkpointAt(route, s.to).idx;
  const line = route.coords.slice(i0, i1 + 1);
  if (line.length === 0) return [];
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [lat, lon] of line) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  const dLat = radiusKm / 110.57;
  const dLon = radiusKm / (111.32 * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)));
  return all.filter(
    (h) =>
      h.lat >= minLat - dLat && h.lat <= maxLat + dLat &&
      h.lon >= minLon - dLon && h.lon <= maxLon + dLon &&
      nearestIndex(line, [h.lat, h.lon]).km <= radiusKm,
  );
}

let dataset: Promise<Hotel[]> | null = null;

/** Власний набір готелів країн демо, завантажений наперед з OSM. */
export function loadDataset(): Promise<Hotel[]> {
  dataset ??= fetch(`${import.meta.env.BASE_URL}data/hotels.json`)
    .then((r) => (r.ok ? r.json() : { elements: [] }))
    .then(parseHotels)
    .catch(() => []);
  return dataset;
}

export interface HotelSearch {
  hotels: Hotel[];
  /** Скільки ділянок довелося шукати на живому сервері Overpass. */
  liveSections: number;
}

/**
 * Дві стратегії: спершу власний набір (миттєво), а для ділянок, де в ньому порожньо
 * (інші країни), один живий запит до Overpass.
 */
export interface HotelSources {
  dataset: () => Promise<Hotel[]>;
  zones: () => Promise<Zone[]>;
  live: (lines: LatLon[][], radiusM: number) => Promise<Hotel[]>;
}

/** У браузері: файли з public/data і живий Overpass. Сервер MCP підставляє свої. */
export const browserSources: HotelSources = { dataset: loadDataset, zones: loadZones, live: fetchHotels };

export async function findHotels(
  route: Route,
  sections: Section[],
  radiusKm: number,
  src: HotelSources = browserSources,
): Promise<HotelSearch> {
  const all = await src.dataset();
  const found = new Map<string, Hotel>();
  const missing: Section[] = [];
  for (const s of sections) {
    const local = hotelsNearSection(all, route, s, radiusKm);
    if (local.length === 0) missing.push(s);
    for (const h of local) found.set(h.id, h);
  }
  if (missing.length) {
    const live = await src.live(missing.map((s) => sectionLine(route, s.from, s.to)), radiusKm * 1000);
    for (const h of live) found.set(h.id, h);
  }
  // Файл уже чистий, але живий Overpass може повернути заклад з окупованої зони.
  const zones = await src.zones();
  const hotels = [...found.values()].filter((h) => !inZones(zones, h.lat, h.lon));
  return { hotels, liveSections: missing.length };
}
