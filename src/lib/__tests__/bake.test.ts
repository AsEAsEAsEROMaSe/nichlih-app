import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { searchSections } from '../checkpoints';
import { thin } from '../geo';
import { hotelsNearSection } from '../hotelSource';
import { fetchRoutes } from '../osrm';
import { parseHotels } from '../overpass';
import { locateHotels, planTrip, summarize } from '../planner';

/**
 * Готує приклад плану для головної сторінки з живого маршруту і власного набору готелів:
 * BAKE=1 node node_modules/vitest/vitest.mjs run src/lib/__tests__/bake.test.ts
 * Результат у src/data/hero.json. У звичайному прогоні пропускається.
 */
describe.skipIf(!process.env.BAKE)('приклад плану для головної', () => {
  it('маршрут вітрини', async () => {
    const [fromName, fLat, fLon, toName, tLat, tLon, hours] = (process.env.BAKE_ROUTE ?? 'Одеса,46.4825,30.7233,Гданськ,54.352,18.6466,6').split(',');
    const o = { dayLimitSec: Number(hours) * 3600, windowSec: 3600, stepSec: 900, startDate: '2026-11-23', budget: 120 };
    const [route] = await fetchRoutes([Number(fLat), Number(fLon)], [Number(tLat), Number(tLon)]);
    const all = parseHotels(JSON.parse(readFileSync('public/data/hotels.json', 'utf8')));
    const found = new Map(searchSections(route, o).flatMap((s) => hotelsNearSection(all, route, s, 10)).map((h) => [h.id, h]));
    const located = locateHotels(route, [...found.values()]);
    // Для вітрини беремо найкращий за оцінкою готель з виразною назвою (не просто «Готель»).
    const showy = (n: string) => n.length >= 7 && !/^(готель|мотель|hotel|motel|\d)/i.test(n);
    const choices: Record<number, string> = {};
    let days = planTrip(route, located, o, choices);
    for (let i = 0; i < days.length; i++) {
      const pick = days[i].candidates.find((c) => showy(c.name));
      if (pick) choices[i] = pick.id;
      days = planTrip(route, located, o, choices);
    }
    const s = summarize(route, days);
    const out = {
      from: fromName,
      to: toName,
      distanceKm: s.distanceKm,
      driveSec: Math.round(route.duration),
      majorShare: Math.round(route.majorShare * 100),
      cost: s.cost,
      line: thin(route.coords, 260).map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)]),
      days: days.map((d) => ({
        index: d.index,
        driveSec: Math.round(d.stopT - d.startT),
        km: Math.round((d.stopM - d.startM) / 1000),
        endFrac: +(d.stopT / route.duration).toFixed(4),
        options: d.candidates.length,
        hotel: d.chosen && {
          name: d.chosen.name, lat: d.chosen.lat, lon: d.chosen.lon, kind: d.chosen.kind,
          stars: d.chosen.stars ?? null, price: d.chosen.price, detourMin: d.chosen.detourMin,
        },
      })),
    };
    writeFileSync('src/data/hero.json', JSON.stringify(out));
    console.log(`${fromName} → ${toName}: ${out.distanceKm} км, ${(out.driveSec / 3600).toFixed(1)} год, ${out.majorShare}% трасами, ${out.cost} €`);
    for (const d of out.days) console.log(`  день ${d.index + 1}: ${(d.driveSec / 3600).toFixed(1)} год, ${d.km} км`, d.hotel ? `→ ${d.hotel.name} (${d.hotel.kind}, ${d.hotel.stars ?? 'без'} зірок), ${d.hotel.price} €, гак ${d.hotel.detourMin} хв, варіантів ${d.options}` : '→ фініш');
    expect(out.days.length).toBeGreaterThan(1);
  }, 120000);
});
