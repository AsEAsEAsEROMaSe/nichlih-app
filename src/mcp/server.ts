import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HotelSources } from '../lib/hotelSource';
import { sortCandidates } from '../lib/planner';
import { priceParts } from '../lib/pricing';
import { OCCUPIED_POINT, OCCUPIED_ROUTE, planRoute, safeRoutes, TripError, type TripPlan } from '../lib/trip';
import type { Candidate, Day, Hotel, LatLon, Place, Route } from '../lib/types';
import { inZones } from '../lib/zones';

/**
 * MCP-сервер «Нічліг»: агент планує автоподорож з ночівлями.
 * Чотири інструменти, усі лише читають дані. Мережа і файли приходять через deps,
 * тому сервер однаково працює з stdio, з HTTP і в тестах.
 */

export interface ServerDeps {
  fetchRoutes: (from: LatLon, to: LatLon) => Promise<Route[]>;
  searchPlaces: (q: string) => Promise<Place[]>;
  sources: HotelSources;
  /** Сьогоднішня дата, щоб тести не залежали від годинника. */
  today: () => string;
  /** Кеш між запитами. У режимі HTTP сервер створюється на кожен запит, а кеш має жити довше. */
  cache?: ServerCache;
}

export interface ServerCache {
  routes: Map<string, { at: number; routes: Route[]; from: Place; to: Place }>;
  hotels: Map<string, Hotel>;
}

export const createCache = (): ServerCache => ({ routes: new Map(), hotels: new Map() });

/** Тексти відмов з ядра українською (їх бачить інтерфейс); агенту віддаємо англійською. */
const ENGLISH: Record<string, string> = {
  [OCCUPIED_POINT]: 'This point is in a temporarily occupied territory of Ukraine. Nichlih does not plan routes there.',
  [OCCUPIED_ROUTE]: 'Every route found passes through occupied territory. Try a different start or destination.',
};

export const VERSION = '0.1.0';

const NOTES = [
  'Prices are demo estimates from a model (type, stars, season, weekday), not live hotel rates. Confirm with the hotel.',
  'Drive times assume no traffic. Detour is estimated from distance to the route.',
  'Temporarily occupied territories of Ukraine are excluded: no routes into or through them, no hotels there.',
  'Hotel data © OpenStreetMap contributors, ODbL. Routing: OSRM.',
];

const ROUTE_TTL_MS = 24 * 3600 * 1000;
const ROUTE_CACHE_MAX = 200;

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 1) }] });
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true });

const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** Спільні поля поїздки для plan_trip і night_options. */
const tripShape = {
  from: z.string().min(2).max(120).describe("Start: a place name ('Kyiv', 'Kraków, Poland') or coordinates 'lat,lon'"),
  to: z.string().min(2).max(120).describe('Destination, same format as from'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Departure date YYYY-MM-DD; default today'),
  max_drive_hours: z.number().min(2).max(14).default(7).describe('Most hours behind the wheel per day'),
  max_price_eur: z.number().min(10).max(1000).default(150).describe('Highest price per night, EUR'),
  include_guest_houses: z.boolean().default(true).describe('Also consider guest houses, not only hotels and motels'),
  route_option: z.number().int().min(1).max(3).default(1).describe('1 is the fastest route; 2 and 3 are alternatives if they exist'),
  hotel_choices: z
    .record(z.string(), z.string())
    .optional()
    .describe("Override the suggested hotel per night: {'1': 'node/123'} uses that hotel for night 1. Later nights are re-planned from it."),
};

type TripArgs = {
  from: string;
  to: string;
  start_date?: string;
  max_drive_hours: number;
  max_price_eur: number;
  include_guest_houses: boolean;
  route_option: number;
  hotel_choices?: Record<string, string>;
};

function hotelOut(c: Candidate) {
  return {
    hotel_id: c.id,
    name: c.name,
    kind: c.kind,
    stars: c.stars ?? null,
    price_eur: c.price,
    detour_min: Math.round(c.detourMin),
    off_route_km: round(c.offKm),
    parking: c.parking ?? null,
    website: c.website ?? null,
    phone: c.phone ?? null,
    lat: round(c.lat, 5),
    lon: round(c.lon, 5),
  };
}

function dayOut(d: Day) {
  return {
    day: d.index + 1,
    date: d.date,
    drive_km: Math.round((d.stopM - d.startM) / 1000),
    drive_hours: round((d.stopT - d.startT) / 3600),
    arrives: d.last ? 'destination' : 'overnight stop',
    night: d.last ? undefined : d.chosen ? hotelOut(d.chosen) : null,
    options_count: d.last ? undefined : d.candidates.length,
    note: d.last
      ? undefined
      : !d.chosen
        ? 'No hotel found within the budget near this stop. Try a higher max_price_eur or include_guest_houses.'
        : d.relaxed
          ? 'No hotel in the last hour of the day, so this day is shorter than the limit.'
          : undefined,
  };
}

export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: 'nichlih', version: VERSION });
  const cache = deps.cache ?? createCache();
  const routeCache = cache.routes;
  const hotelIndex = cache.hotels;

  async function resolve(text: string): Promise<Place> {
    const m = text.match(COORDS);
    if (m) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new TripError(`Coordinates out of range: ${text}`);
      return { name: `${lat}, ${lon}`, lat, lon };
    }
    const found = await deps.searchPlaces(text);
    if (!found.length) throw new TripError(`Place not found: "${text}". Try find_place or coordinates 'lat,lon'.`);
    return found[0];
  }

  /** Маршрут кешується на добу: агент часто перепитує ту саму поїздку з іншими параметрами. */
  async function routesFor(fromText: string, toText: string) {
    const key = `${fromText.trim().toLowerCase()}|${toText.trim().toLowerCase()}`;
    const hit = routeCache.get(key);
    if (hit && Date.now() - hit.at < ROUTE_TTL_MS) return hit;
    const [from, to] = await Promise.all([resolve(fromText), resolve(toText)]);
    const routes = await safeRoutes([from.lat, from.lon], [to.lat, to.lon], deps.fetchRoutes, deps.sources);
    const entry = { at: Date.now(), routes, from, to };
    if (routeCache.size >= ROUTE_CACHE_MAX) routeCache.delete(routeCache.keys().next().value!);
    routeCache.set(key, entry);
    return entry;
  }

  async function plan(a: TripArgs): Promise<{ plan: TripPlan; from: Place; to: Place; routes: number; routeIndex: number }> {
    const { routes, from, to } = await routesFor(a.from, a.to);
    const routeIndex = Math.min(a.route_option, routes.length) - 1;
    const choices: Record<number, string> = {};
    for (const [night, id] of Object.entries(a.hotel_choices ?? {})) choices[Number(night) - 1] = id;
    const opts = {
      startDate: a.start_date ?? deps.today(),
      dayHours: a.max_drive_hours,
      budget: a.max_price_eur,
      guestHouses: a.include_guest_houses,
      choices,
    };
    let result = await planRoute(routes[routeIndex], opts, deps.sources);
    // Як і в інтерфейсі: якщо на якусь ніч нічого не знайшлося, пробуємо ширший пошук.
    if (result.summary.missingNights > 0) result = await planRoute(routes[routeIndex], opts, deps.sources, true);
    for (const h of result.hotels) hotelIndex.set(h.id, h);
    return { plan: result, from, to, routes: routes.length, routeIndex };
  }

  const guard = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof TripError) return fail(ENGLISH[e.message] ?? e.message);
      return fail(`Upstream service error: ${e instanceof Error ? e.message : String(e)}. Try again in a minute.`);
    }
  };

  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

  server.registerTool(
    'find_place',
    {
      title: 'Find a place',
      description:
        'Look up a town or city by name and get its coordinates. Use it when a name is ambiguous (several towns share it); then pass "lat,lon" to plan_trip.',
      inputSchema: { query: z.string().min(2).max(120).describe('Place name, e.g. "Zaporizhzhia" or "Lviv, Ukraine"') },
      annotations: readOnly,
    },
    ({ query }) =>
      guard(async () => {
        const zones = await deps.sources.zones();
        const places = await deps.searchPlaces(query);
        return json({
          places: places.map((p) => ({
            name: p.name,
            lat: round(p.lat, 5),
            lon: round(p.lon, 5),
            occupied: inZones(zones, p.lat, p.lon) || undefined,
          })),
        });
      }),
  );

  server.registerTool(
    'plan_trip',
    {
      title: 'Plan a road trip with overnight stops',
      description:
        'Plan a multi-day car trip between two places. Splits the fastest route into days by driving time and picks a hotel near the road for every night (cheap, close to the route, good stars). Covers Ukraine and Poland best; other countries use live OpenStreetMap search. Returns days, hotels, prices and totals.',
      inputSchema: tripShape,
      annotations: readOnly,
    },
    (a) =>
      guard(async () => {
        const { plan: p, from, to, routes, routeIndex } = await plan(a);
        return json({
          from: from.name,
          to: to.name,
          route: {
            option: routeIndex + 1,
            options_available: routes,
            distance_km: p.summary.distanceKm,
            drive_hours: round(p.summary.driveSec / 3600),
            major_roads_share: round(p.route.majorShare, 2),
          },
          days: p.days.map(dayOut),
          totals: { days: p.summary.days, nights: p.summary.nights, lodging_eur: p.summary.cost, nights_without_hotel: p.summary.missingNights },
          next: 'Use night_options to see other hotels for a night, then pass hotel_choices to plan_trip to switch.',
          notes: NOTES,
        });
      }),
  );

  server.registerTool(
    'night_options',
    {
      title: 'Hotels for one night',
      description:
        'All hotels found for one night of a trip planned with plan_trip, with price, detour and contacts. Call it with the same trip arguments plus the night number.',
      inputSchema: {
        ...tripShape,
        night: z.number().int().min(1).max(30).describe('Night number, 1 is the first night'),
        sort: z.enum(['best', 'price', 'near']).default('best').describe('best: balanced score; price: cheapest first; near: smallest detour first'),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: readOnly,
    },
    (a) =>
      guard(async () => {
        const { plan: p } = await plan(a);
        const day = p.days[a.night - 1];
        if (!day || day.last) return fail(`This trip has ${p.summary.nights} night(s); night ${a.night} does not exist.`);
        const list = sortCandidates(day.candidates, a.sort).slice(0, a.limit);
        return json({
          night: a.night,
          date: day.date,
          chosen_hotel_id: day.chosen?.id ?? null,
          total_options: day.candidates.length,
          hotels: list.map(hotelOut),
          notes: NOTES.slice(0, 1),
        });
      }),
  );

  server.registerTool(
    'hotel_details',
    {
      title: 'Hotel details',
      description: 'Contacts, location and the price breakdown for one hotel id returned by plan_trip or night_options.',
      inputSchema: {
        hotel_id: z.string().regex(/^(node|way|relation)\/\d+$/).describe('Id like "node/123456"'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Night date YYYY-MM-DD for the price; default today'),
      },
      annotations: readOnly,
    },
    ({ hotel_id, date }) =>
      guard(async () => {
        let h = hotelIndex.get(hotel_id);
        if (!h) {
          for (const x of await deps.sources.dataset()) hotelIndex.set(x.id, x);
          h = hotelIndex.get(hotel_id);
        }
        if (!h) return fail(`Unknown hotel_id ${hotel_id}. Use an id from plan_trip or night_options.`);
        const night = date ?? deps.today();
        const parts = priceParts(h, night);
        return json({
          hotel_id: h.id,
          name: h.name,
          kind: h.kind,
          stars: h.stars ?? null,
          parking: h.parking ?? null,
          website: h.website ?? null,
          phone: h.phone ?? null,
          lat: h.lat,
          lon: h.lon,
          openstreetmap: `https://www.openstreetmap.org/${h.id}`,
          price: {
            date: night,
            total_eur: parts.total,
            base_eur: parts.base,
            stars_factor: parts.stars,
            season_factor: parts.season,
            weekend_factor: parts.weekend,
            hotel_factor: round(parts.jitter, 2),
            source: 'demo model, not a live rate',
          },
        });
      }),
  );

  return server;
}
