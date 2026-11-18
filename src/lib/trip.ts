import { searchSections, type PlanParams } from './checkpoints';
import { findHotels, type HotelSources } from './hotelSource';
import { locateHotels, planTrip, summarize, type TripSummary } from './planner';
import type { Day, Hotel, LatLon, Route } from './types';
import { inZones, routeCrossesZones } from './zones';

/**
 * Поїздка від двох точок до готового плану: маршрут, готелі, дні.
 * Спільне для інтерфейсу й сервера MCP; джерела даних підставляються ззовні.
 */

export const WINDOW_SEC = 3600;
export const STEP_SEC = 900;
export const RADIUS_KM = 10;
export const WIDE_RADIUS_KM = 25;

export const planParamsFor = (dayHours: number): PlanParams => ({
  dayLimitSec: dayHours * 3600,
  windowSec: WINDOW_SEC,
  stepSec: STEP_SEC,
});

export class TripError extends Error {}

export const OCCUPIED_POINT = 'Точка лежить на тимчасово окупованій території. Туди маршрути не будуємо.';
export const OCCUPIED_ROUTE = 'Усі знайдені маршрути проходять через окуповану територію. Спробуйте іншу точку.';

/** Маршрути між точками без тих, що заходять в окуповані зони. Кидає TripError, якщо лишилось нуль. */
export async function safeRoutes(
  from: LatLon,
  to: LatLon,
  fetchRoutes: (a: LatLon, b: LatLon) => Promise<Route[]>,
  src: Pick<HotelSources, 'zones'>,
): Promise<Route[]> {
  const zones = await src.zones();
  if (inZones(zones, from[0], from[1]) || inZones(zones, to[0], to[1])) throw new TripError(OCCUPIED_POINT);
  const routes = (await fetchRoutes(from, to)).filter((r) => !routeCrossesZones(zones, r));
  if (routes.length === 0) throw new TripError(OCCUPIED_ROUTE);
  return routes;
}

export interface TripOptionsInput {
  startDate: string;
  dayHours: number;
  /** Найбільша ціна за ніч, євро. */
  budget: number;
  guestHouses: boolean;
  /** Ручний вибір: номер дня (з нуля) → ідентифікатор готелю. */
  choices?: Record<number, string>;
}

export interface TripPlan {
  route: Route;
  hotels: Hotel[];
  days: Day[];
  summary: TripSummary;
  liveSections: number;
}

/** Готелі вздовж маршруту і план по днях. Розширений пошук: ширше вікно й радіус. */
export async function planRoute(route: Route, o: TripOptionsInput, src: HotelSources, wide = false): Promise<TripPlan> {
  const p = planParamsFor(o.dayHours);
  const sections = searchSections(route, wide ? { ...p, windowSec: p.windowSec * 2 } : p);
  const found = await findHotels(route, sections, wide ? WIDE_RADIUS_KM : RADIUS_KM, src);
  const usable = o.guestHouses ? found.hotels : found.hotels.filter((h) => h.kind !== 'guest_house');
  const days = planTrip(route, locateHotels(route, usable), { ...p, startDate: o.startDate, budget: o.budget }, o.choices);
  return { route, hotels: found.hotels, days, summary: summarize(route, days), liveSections: found.liveSections };
}
