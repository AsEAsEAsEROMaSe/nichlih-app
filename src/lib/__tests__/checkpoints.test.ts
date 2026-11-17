import { describe, expect, it } from 'vitest';
import { checkpointsBetween, effectiveWindow, indexAtTime, nightWindow, searchSections } from '../checkpoints';
import { H, straightRoute } from './helpers';

const p = { dayLimitSec: 6 * H, windowSec: H, stepSec: 900 };

describe('indexAtTime', () => {
  it('знаходить найближчу за часом точку і не виходить за межі', () => {
    const t = [0, 10, 20, 30];
    expect(indexAtTime(t, -5)).toBe(0);
    expect(indexAtTime(t, 14)).toBe(1);
    expect(indexAtTime(t, 16)).toBe(2);
    expect(indexAtTime(t, 99)).toBe(3);
  });
});

describe('nightWindow', () => {
  it('не потрібне, якщо до фінішу можна доїхати за день', () => {
    expect(nightWindow(0, 6 * H, p)).toBeNull();
    expect(nightWindow(5 * H, 10 * H, p)).toBeNull();
  });
  it('займає останню годину перед лімітом', () => {
    expect(nightWindow(0, 10 * H, p)).toEqual({ from: 5 * H, to: 6 * H });
    expect(nightWindow(2 * H, 10 * H, p)).toEqual({ from: 7 * H, to: 8 * H });
  });
  it('вікно не довше за половину дня', () => {
    expect(effectiveWindow({ dayLimitSec: H, windowSec: H, stepSec: 900 })).toBe(H / 2);
  });
});

describe('checkpointsBetween', () => {
  it('ставить точки через кожні п\'ятнадцять хвилин у порядку руху', () => {
    const cps = checkpointsBetween(straightRoute(10), 5 * H, 6 * H, 900);
    expect(cps.map((c) => c.t / 60)).toEqual([300, 315, 330, 345, 360]);
    for (let i = 1; i < cps.length; i++) expect(cps[i].idx).toBeGreaterThan(cps[i - 1].idx);
  });
});

describe('searchSections', () => {
  it('порожньо для поїздки на один день', () => {
    expect(searchSections(straightRoute(5), p)).toEqual([]);
  });
  it('одна ніч: остання година першого дня', () => {
    expect(searchSections(straightRoute(8), p)).toEqual([{ from: 5 * H, to: 6 * H }]);
  });
  it('друга ніч ширша, бо перший день міг закінчитись раніше', () => {
    expect(searchSections(straightRoute(14), p)).toEqual([
      { from: 5 * H, to: 6 * H },
      { from: 10 * H, to: 12 * H },
    ]);
  });
  it('ділянки не виходять за кінець маршруту і не перекриваються', () => {
    const route = straightRoute(40);
    const s = searchSections(route, p);
    for (let i = 0; i < s.length; i++) {
      expect(s[i].to).toBeLessThanOrEqual(route.duration);
      expect(s[i].from).toBeLessThan(s[i].to);
      if (i) expect(s[i].from).toBeGreaterThan(s[i - 1].to);
    }
  });
});
