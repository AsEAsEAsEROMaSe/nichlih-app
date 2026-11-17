import type { Checkpoint, Route } from './types';

export interface PlanParams {
  /** Скільки секунд за кермом на день щонайбільше. */
  dayLimitSec: number;
  /** Вікно ночівлі: остання частина дня, де шукаємо готель. */
  windowSec: number;
  /** Крок між контрольними точками у вікні. */
  stepSec: number;
}

/** Вікно не може бути довшим за половину дня. */
export function effectiveWindow(p: PlanParams): number {
  return Math.min(p.windowSec, p.dayLimitSec / 2);
}

/** Індекс точки маршруту, найближчої за часом до t. */
export function indexAtTime(cumTime: number[], t: number): number {
  let lo = 0;
  let hi = cumTime.length - 1;
  if (hi < 0) return -1;
  if (t <= cumTime[0]) return 0;
  if (t >= cumTime[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumTime[mid] <= t) lo = mid;
    else hi = mid;
  }
  return t - cumTime[lo] <= cumTime[hi] - t ? lo : hi;
}

export function checkpointAt(route: Route, t: number): Checkpoint {
  const idx = indexAtTime(route.cumTime, t);
  return { t, idx, coord: route.coords[idx] };
}

/**
 * Вікно ночівлі для дня, що починається в момент startT.
 * null означає, що до фінішу можна доїхати сьогодні, ночівля не потрібна.
 */
export function nightWindow(startT: number, total: number, p: PlanParams): { from: number; to: number } | null {
  if (total - startT <= p.dayLimitSec) return null;
  const to = startT + p.dayLimitSec;
  return { from: to - effectiveWindow(p), to };
}

/** Контрольні точки у проміжку часу, від кінця назад з кроком step, у порядку руху. */
export function checkpointsBetween(route: Route, from: number, to: number, stepSec: number): Checkpoint[] {
  const out: Checkpoint[] = [];
  for (let t = to; t >= from - 1e-6; t -= stepSec) out.push(checkpointAt(route, t));
  return out.reverse();
}

/**
 * Ділянки маршруту, де взагалі може випасти ночівля, щоб знайти готелі одним запитом.
 * День k починається не раніше (k-1)(L-W) і не пізніше (k-1)L, тому ніч k
 * лежить між k(L-W) і kL. Ділянки, що перекриваються, зливаються.
 */
export function searchSections(route: Route, p: PlanParams): { from: number; to: number }[] {
  const L = p.dayLimitSec;
  const W = effectiveWindow(p);
  const total = route.duration;
  const out: { from: number; to: number }[] = [];
  for (let k = 1; k <= 60; k++) {
    const earliestStart = (k - 1) * (L - W);
    if (total - earliestStart <= L) break;
    const from = k * (L - W);
    const to = Math.min(k * L, total);
    const prev = out[out.length - 1];
    if (prev && from <= prev.to) prev.to = Math.max(prev.to, to);
    else out.push({ from, to });
  }
  return out;
}
