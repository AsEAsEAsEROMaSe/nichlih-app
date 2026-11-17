import { describe, expect, it } from 'vitest';
import { searchSections } from '../checkpoints';
import { fetchRoutes } from '../osrm';
import { fetchHotels, sectionLine } from '../overpass';
import { locateHotels, planTrip, summarize } from '../planner';

/** Прогін на живих сервісах: LIVE=1 npm test. У звичайному прогоні пропускається. */
describe.skipIf(!process.env.LIVE)('живі сервіси: Львів до Гданська', () => {
  it('будує план з готелями на кожну ніч', async () => {
    const o = { dayLimitSec: 5 * 3600, windowSec: 3600, stepSec: 900, startDate: '2026-11-20', budget: 300 };
    const [route] = await fetchRoutes([49.8397, 24.0297], [54.352, 18.6466]);
    console.log('маршрут', Math.round(route.distance / 1000), 'км', (route.duration / 3600).toFixed(1), 'год',
      'точок', route.coords.length, 'трасами', Math.round(route.majorShare * 100) + '%');
    const sections = searchSections(route, o);
    const hotels = await fetchHotels(sections.map((s) => sectionLine(route, s.from, s.to)), 10000);
    console.log('ділянок', sections.length, 'готелів', hotels.length);
    const days = planTrip(route, locateHotels(route, hotels), o);
    for (const d of days) {
      console.log(`день ${d.index + 1}: ${((d.stopT - d.startT) / 3600).toFixed(1)} год`,
        d.chosen ? `→ ${d.chosen.name}, ${d.chosen.price} €, гак ${d.chosen.detourMin} хв, варіантів ${d.candidates.length}` : d.last ? '→ фініш' : '→ готелів нема');
    }
    console.log(summarize(route, days));
    expect(days.length).toBeGreaterThan(1);
    for (const d of days) expect(d.stopT - d.startT).toBeLessThanOrEqual(o.dayLimitSec + 1);
  }, 180000);
});
