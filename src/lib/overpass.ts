import { checkpointAt } from './checkpoints';
import type { Hotel, HotelKind, LatLon, Route } from './types';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const KINDS: HotelKind[] = ['hotel', 'motel', 'guest_house'];
/** Крок точок ламаної для запиту: густіше за контрольні точки, щоб коридор ішов уздовж дороги. */
const QUERY_STEP_SEC = 300;
const MAX_RESULTS = 600;
/** Публічний сервер тримає запит у черзі до пів хвилини, довше чекати нема сенсу. */
const REQUEST_TIMEOUT_MS = 45000;

const fmt = (n: number) => n.toFixed(4);

/** Ламана ділянки маршруту між двома моментами часу. */
export function sectionLine(route: Route, from: number, to: number): LatLon[] {
  const out: LatLon[] = [];
  for (let t = from; t < to; t += QUERY_STEP_SEC) out.push(checkpointAt(route, t).coord);
  out.push(checkpointAt(route, to).coord);
  return out;
}

/** Один запит на всю поїздку: готелі в радіусі від кожної ділянки, де можлива ночівля. */
export function buildQuery(lines: LatLon[][], radiusM: number): string {
  const filter = `["tourism"~"^(${KINDS.join('|')})$"]["name"]`;
  const parts = lines
    .filter((l) => l.length > 0)
    .map((l) => `  nwr${filter}(around:${Math.round(radiusM)},${l.map((c) => `${fmt(c[0])},${fmt(c[1])}`).join(',')});`);
  return `[out:json][timeout:60];\n(\n${parts.join('\n')}\n);\nout tags center ${MAX_RESULTS};`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const clean = (s: string | undefined, max: number) => (s ? s.trim().slice(0, max) : undefined);

/** Перетворює відповідь Overpass на готелі; усе зайве й непридатне відкидається. */
export function parseHotels(data: unknown): Hotel[] {
  const elements = (data as { elements?: OverpassElement[] })?.elements;
  if (!Array.isArray(elements)) return [];
  const seen = new Set<string>();
  const out: Hotel[] = [];
  for (const e of elements) {
    const tags = e.tags ?? {};
    const kind = tags.tourism as HotelKind;
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const name = clean(tags.name, 80);
    const id = `${e.type}/${e.id}`;
    if (!KINDS.includes(kind) || !name || typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (!/^(node|way|relation)\/\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const stars = parseInt(tags.stars ?? '', 10);
    const site = clean(tags.website ?? tags['contact:website'], 200);
    out.push({
      id, name, lat, lon, kind,
      stars: stars >= 1 && stars <= 5 ? stars : undefined,
      parking: tags.parking !== undefined && tags.parking !== 'no' ? true : undefined,
      website: site && /^https?:\/\//i.test(site) ? site : undefined,
      phone: clean(tags.phone ?? tags['contact:phone'], 30),
    });
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Публічні сервери Overpass бувають зайняті: пробуємо по черзі з паузою, що росте. */
export async function fetchHotels(lines: LatLon[][], radiusM: number): Promise<Hotel[]> {
  if (lines.length === 0) return [];
  const body = new URLSearchParams({ data: buildQuery(lines, radiusM) });
  let lastError = 'невідома помилка';
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.ok) return parseHotels(await res.json());
      lastError = `сервер відповів ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (attempt < 2) await sleep(1500 * 2 ** attempt);
  }
  throw new Error(`Сервер карт зайнятий (${lastError}). Спробуйте ще раз за хвилину.`);
}
