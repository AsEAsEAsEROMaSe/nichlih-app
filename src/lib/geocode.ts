import CITIES from '../data/cities.json';
import { haversineKm } from './geo';
import type { Place } from './types';

/**
 * Photon не знає українських назв більшості закордонних міст: «Краків» дає лише українські села.
 * Тому великі міста України й популярні міста Європи з українськими назвами лежать
 * у src/data/cities.json і йдуть першими. Вони ж рятують пошук, коли Photon не відповідає.
 */
interface KnownCity { uk: string; name: string; lat: number; lon: number }
const norm = (s: string) => s.toLocaleLowerCase('uk').replace(/[ʼ'’`]/g, '').replace(/\s+/g, ' ').trim();

export function knownCities(q: string, list: KnownCity[] = CITIES): Place[] {
  const n = norm(q);
  if (n.length < 3) return [];
  return list
    .filter((c) => norm(c.uk).startsWith(n))
    .slice(0, 3)
    .map(({ name, lat, lon }) => ({ name, lat, lon }));
}

/** Свої міста першими; однойменні результати Photon поруч (до 15 км) відкидаємо. */
export function mergePlaces(local: Place[], remote: Place[]): Place[] {
  const rest = remote.filter((r) => !local.some((l) => haversineKm([l.lat, l.lon], [r.lat, r.lon]) < 15));
  return [...local, ...rest].slice(0, 6);
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; city?: string; state?: string; country?: string };
}

export function parsePlaces(data: unknown): Place[] {
  const features = (data as { features?: PhotonFeature[] })?.features;
  if (!Array.isArray(features)) return [];
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const p = f.properties ?? {};
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!p.name || typeof lat !== 'number' || typeof lon !== 'number') continue;
    const name = [p.name, p.state !== p.name ? p.state : undefined, p.country].filter(Boolean).join(', ');
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, lat, lon });
  }
  return out;
}

/** Пошук населених пунктів за назвою (Photon, на даних OSM, підходить для підказок). */
export async function searchPlaces(q: string, signal?: AbortSignal, headers?: Record<string, string>): Promise<Place[]> {
  const local = knownCities(q);
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&osm_tag=place`;
  try {
    const res = await fetch(url, { signal, headers });
    if (!res.ok) throw new Error(`Пошук місць відповів ${res.status}`);
    return mergePlaces(local, parsePlaces(await res.json()));
  } catch (e) {
    // Скасування запиту прокидаємо далі; збій Photon не заважає показати відомі міста.
    if (local.length && (e as Error)?.name !== 'AbortError') return local;
    throw e;
  }
}
