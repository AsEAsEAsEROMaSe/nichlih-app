import { checkpointsBetween, indexAtTime, nightWindow, effectiveWindow, type PlanParams } from './checkpoints';
import { nearestIndex } from './geo';
import { addDays, nightPrice } from './pricing';
import type { Candidate, Day, Hotel, LocatedHotel, Route } from './types';

/** Середня швидкість на під'їзді до готелю і поправка на те, що дорога не пряма. */
const DETOUR_KMH = 50;
const DETOUR_WINDING = 1.3;
/** День не може бути коротшим за це, інакше план не рухається вперед. */
const MIN_DAY_SEC = 30 * 60;

export function detourMinutes(offKm: number): number {
  return Math.round(((2 * offKm * DETOUR_WINDING) / DETOUR_KMH) * 60);
}

/** Прив'язує готелі до маршруту: де саме вони відносно дороги і який гак. */
export function locateHotels(route: Route, hotels: Hotel[]): LocatedHotel[] {
  return hotels.map((h) => {
    const { idx, km } = nearestIndex(route.coords, [h.lat, h.lon]);
    return { ...h, routeT: route.cumTime[idx], offKm: km, detourMin: detourMinutes(km) };
  });
}

/** Оцінка готелю: менший гак і ціна краще, зірки й парковка дають бонус. */
export function scoreHotel(h: LocatedHotel, price: number): number {
  return h.detourMin * 1.5 + price * 0.3 - (h.stars ?? 3) * 4 - (h.parking ? 3 : 0);
}

function toCandidates(hotels: LocatedHotel[], date: string, budget: number): Candidate[] {
  return hotels
    .map((h) => {
      const price = nightPrice(h, date);
      return { ...h, price, score: scoreHotel(h, price) };
    })
    .filter((c) => c.price <= budget)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
}

export type SortMode = 'best' | 'price' | 'near';

/** Порядок списку готелів на сторінці ночі. Вихідний масив не змінюється. */
export function sortCandidates(list: Candidate[], mode: SortMode): Candidate[] {
  const by: Record<SortMode, (a: Candidate, b: Candidate) => number> = {
    best: (a, b) => a.score - b.score,
    price: (a, b) => a.price - b.price || a.score - b.score,
    near: (a, b) => a.detourMin - b.detourMin || a.price - b.price,
  };
  return [...list].sort((a, b) => by[mode](a, b) || a.id.localeCompare(b.id));
}

export interface TripOptions extends PlanParams {
  startDate: string;
  /** Найбільша ціна за ніч, євро. */
  budget: number;
}

/**
 * Ділить маршрут на дні й на кожну ніч вибирає готель.
 * choices: готель, який користувач вибрав вручну для дня з цим номером.
 * Жоден день не довший за ліміт; якщо у вікні готелів нема, день скорочується.
 */
export function planTrip(
  route: Route,
  hotels: LocatedHotel[],
  o: TripOptions,
  choices: Record<number, string> = {},
): Day[] {
  const total = route.duration;
  const W = effectiveWindow(o);
  const days: Day[] = [];
  const mAt = (t: number) => route.cumDist[indexAtTime(route.cumTime, t)];
  let s = 0;

  for (let i = 0; i < 60; i++) {
    const date = addDays(o.startDate, i);
    const win = nightWindow(s, total, o);
    if (!win) {
      days.push({
        index: i, date, startT: s, stopT: total, startM: mAt(s), stopM: route.distance,
        last: true, checkpoints: [], candidates: [], relaxed: false,
      });
      break;
    }

    let relaxed = false;
    let pool = hotels.filter((h) => h.routeT >= win.from && h.routeT <= win.to);
    let candidates = toCandidates(pool, date, o.budget);
    if (candidates.length === 0) {
      // У вікні порожньо: беремо останні готелі перед вікном, день буде коротшим.
      const earlier = hotels.filter((h) => h.routeT > s + MIN_DAY_SEC && h.routeT < win.from);
      const affordable = toCandidates(earlier, date, o.budget);
      if (affordable.length) {
        const latest = Math.max(...affordable.map((h) => h.routeT));
        pool = earlier.filter((h) => h.routeT >= latest - W);
        candidates = toCandidates(pool, date, o.budget);
        relaxed = true;
      }
    }

    const chosen = candidates.find((c) => c.id === choices[i]) ?? candidates[0];
    const stopT = chosen ? chosen.routeT : win.to;
    days.push({
      index: i, date, startT: s, stopT, startM: mAt(s), stopM: mAt(stopT), last: false,
      window: win, checkpoints: checkpointsBetween(route, win.from, win.to, o.stepSec),
      candidates, chosen, relaxed,
    });
    s = stopT;
  }
  return days;
}

export interface TripSummary {
  days: number;
  nights: number;
  distanceKm: number;
  driveSec: number;
  cost: number;
  missingNights: number;
}

export function summarize(route: Route, days: Day[]): TripSummary {
  const nights = days.filter((d) => !d.last);
  return {
    days: days.length,
    nights: nights.length,
    distanceKm: Math.round(route.distance / 1000),
    driveSec: route.duration,
    cost: nights.reduce((s, d) => s + (d.chosen?.price ?? 0), 0),
    missingNights: nights.filter((d) => !d.chosen).length,
  };
}
