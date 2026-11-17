import { describe, expect, it } from 'vitest';
import { detourMinutes, locateHotels, planTrip, scoreHotel, summarize } from '../planner';
import { H, hotelAt, straightRoute } from './helpers';

const o = { dayLimitSec: 6 * H, windowSec: H, stepSec: 900, startDate: '2026-11-18', budget: 500 };

describe('planTrip', () => {
  it('поїздка в межах ліміту: один день без ночівлі', () => {
    const route = straightRoute(5);
    const days = planTrip(route, [], o);
    expect(days).toHaveLength(1);
    expect(days[0].last).toBe(true);
    expect(days[0].stopT).toBe(route.duration);
  });

  it('жоден день не довший за ліміт, останній доходить до фінішу', () => {
    const route = straightRoute(20);
    const hotels = locateHotels(route, [5.2, 5.8, 10.9, 11.5, 16.4, 17].map((h) => hotelAt(route, h)));
    const days = planTrip(route, hotels, o);
    for (const d of days) expect(d.stopT - d.startT).toBeLessThanOrEqual(o.dayLimitSec + 1);
    for (let i = 1; i < days.length; i++) expect(days[i].startT).toBe(days[i - 1].stopT);
    expect(days[days.length - 1].stopT).toBe(route.duration);
    expect(days.every((d) => d.last || d.chosen)).toBe(true);
  });

  it('наступний день починається від вибраного готелю', () => {
    const route = straightRoute(14);
    const a = hotelAt(route, 5.1);
    const b = hotelAt(route, 5.9);
    const hotels = locateHotels(route, [a, b, hotelAt(route, 10.5), hotelAt(route, 11.6)]);
    const viaA = planTrip(route, hotels, o, { 0: a.id });
    const viaB = planTrip(route, hotels, o, { 0: b.id });
    expect(viaA[0].chosen?.id).toBe(a.id);
    expect(viaA[1].startT).toBeCloseTo(5.1 * H, -2);
    expect(viaB[1].startT).toBeCloseTo(5.9 * H, -2);
    // Від ранішого готелю за другий день не доїхати, від пізнішого лишається доба.
    expect(viaA).toHaveLength(3);
    expect(viaB).toHaveLength(3);
    expect(viaA[1].chosen?.name).toBe('Готель 10.5');
  });

  it('вибір поза вікном ігнорується', () => {
    const route = straightRoute(10);
    const far = hotelAt(route, 2);
    const ok = hotelAt(route, 5.5);
    const days = planTrip(route, locateHotels(route, [far, ok]), o, { 0: far.id });
    expect(days[0].chosen?.id).toBe(ok.id);
  });

  it('якщо у вікні готелів нема, день скорочується, а не подовжується', () => {
    const route = straightRoute(10);
    const days = planTrip(route, locateHotels(route, [hotelAt(route, 2.5), hotelAt(route, 4.2)]), o);
    expect(days[0].relaxed).toBe(true);
    expect(days[0].chosen?.name).toBe('Готель 4.2');
    expect(days[0].stopT).toBeLessThan(o.dayLimitSec);
  });

  it('готелів нема зовсім: день закінчується на ліміті без готелю', () => {
    const route = straightRoute(10);
    const days = planTrip(route, [], o);
    expect(days[0].chosen).toBeUndefined();
    expect(days[0].stopT).toBe(o.dayLimitSec);
    expect(summarize(route, days).missingNights).toBe(1);
  });

  it('бюджет відсіює дорогі готелі', () => {
    const route = straightRoute(10);
    const lux = hotelAt(route, 5.5, 0, { stars: 5 });
    const cheap = hotelAt(route, 5.6, 0, { kind: 'guest_house' });
    const hotels = locateHotels(route, [lux, cheap]);
    const days = planTrip(route, hotels, { ...o, budget: 50 });
    expect(days[0].candidates.map((c) => c.id)).toEqual([cheap.id]);
  });
});

describe('ранжування', () => {
  it('за однакових умов вище готель, що ближче до траси', () => {
    const route = straightRoute(10);
    const near = hotelAt(route, 5.5, 0.5, { id: 'node/1' });
    const far = hotelAt(route, 5.5, 8, { id: 'node/1' });
    const [n, f] = locateHotels(route, [near, far]);
    expect(n.offKm).toBeLessThan(f.offKm);
    expect(scoreHotel(n, 50)).toBeLessThan(scoreHotel(f, 50));
  });
  it('гак рахується туди й назад', () => {
    expect(detourMinutes(0)).toBe(0);
    expect(detourMinutes(10)).toBe(31);
  });
  it('зірки й парковка покращують оцінку', () => {
    const route = straightRoute(10);
    const [h] = locateHotels(route, [hotelAt(route, 5.5)]);
    expect(scoreHotel({ ...h, stars: 5 }, 50)).toBeLessThan(scoreHotel({ ...h, stars: 2 }, 50));
    expect(scoreHotel({ ...h, parking: true }, 50)).toBeLessThan(scoreHotel(h, 50));
  });
});

describe('summarize', () => {
  it('рахує ночі й вартість', () => {
    const route = straightRoute(14);
    const hotels = locateHotels(route, [hotelAt(route, 5.5), hotelAt(route, 11)]);
    const days = planTrip(route, hotels, o);
    const s = summarize(route, days);
    expect(s.nights).toBe(2);
    expect(s.cost).toBe(days[0].chosen!.price + days[1].chosen!.price);
    expect(s.distanceKm).toBe(1260);
  });
});
