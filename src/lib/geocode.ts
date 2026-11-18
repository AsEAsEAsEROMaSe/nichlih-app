import type { Place } from './types';

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
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&osm_tag=place`;
  const res = await fetch(url, { signal, headers });
  if (!res.ok) throw new Error(`Пошук місць відповів ${res.status}`);
  return parsePlaces(await res.json());
}
