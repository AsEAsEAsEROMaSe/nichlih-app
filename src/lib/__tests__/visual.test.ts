import { describe, expect, it } from 'vitest';
import { sortCandidates } from '../planner';
import { nightPrice, priceParts } from '../pricing';
import { fitProjector, svgPath } from '../shape';
import type { Candidate, LatLon } from '../types';

describe('розбір ціни', () => {
  it('частини множаться рівно в ціну за ніч', () => {
    for (const [id, kind, stars, date] of [['node/1', 'hotel', 4, '2026-07-11'], ['way/77', 'motel', undefined, '2026-11-18'], ['node/9', 'guest_house', 2, '2026-12-31']] as const) {
      const h = { id, kind, stars };
      const p = priceParts(h, date);
      expect(Math.round(p.base * p.stars * p.jitter * p.season * p.weekend)).toBe(p.total);
      expect(p.total).toBe(nightPrice(h, date));
    }
  });
  it('у будень поза сезоном надбавок нема', () => {
    const p = priceParts({ id: 'node/1', kind: 'hotel', stars: 3 }, '2026-11-18');
    expect([p.season, p.weekend, p.stars]).toEqual([1, 1, 1]);
  });
});

describe('сортування готелів', () => {
  const c = (id: string, score: number, price: number, detourMin: number) => ({ id, score, price, detourMin }) as Candidate;
  const list = [c('a', 5, 40, 9), c('b', 1, 60, 3), c('c', 3, 30, 3)];
  it('рекомендовані за оцінкою, дешевші за ціною, ближчі за гаком', () => {
    expect(sortCandidates(list, 'best').map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(sortCandidates(list, 'price').map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(sortCandidates(list, 'near').map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });
  it('не змінює вихідний список', () => {
    sortCandidates(list, 'price');
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('обрис маршруту', () => {
  const line: LatLon[] = [[46.48, 30.72], [50.0, 28.6], [50.8, 25.3], [54.35, 18.65]];
  it('усі точки в межах рамки з відступом', () => {
    const f = fitProjector(line, 280, 120, 10);
    for (const p of line) {
      const [x, y] = f(p);
      expect(x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(x).toBeLessThanOrEqual(270 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(y).toBeLessThanOrEqual(110 + 1e-6);
    }
  });
  it('північ угорі, захід ліворуч', () => {
    const f = fitProjector(line, 280, 120);
    expect(f(line[3])[1]).toBeLessThan(f(line[0])[1]);
    expect(f(line[3])[0]).toBeLessThan(f(line[0])[0]);
  });
  it('одна точка і порожній маршрут не ламають розрахунок', () => {
    expect(fitProjector([[50, 20]], 100, 60)([50, 20]).every(Number.isFinite)).toBe(true);
    expect(fitProjector([], 100, 60)([50, 20])).toEqual([50, 30]);
  });
  it('шлях SVG починається з M і має відрізок на кожну точку', () => {
    const d = svgPath(line, fitProjector(line, 280, 120));
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/L/g)).toHaveLength(3);
  });
});
