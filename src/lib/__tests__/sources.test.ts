import { describe, expect, it } from 'vitest';
import { parsePlaces } from '../geocode';
import { isMajorRef, parseOsrmRoute, routeUrl } from '../osrm';
import { buildQuery, parseHotels, sectionLine } from '../overpass';
import { H, straightRoute } from './helpers';

describe('isMajorRef', () => {
  it.each(['E40', 'E 40', 'М-06', 'M 06', 'Н-02', 'A4', 'S7', 'DK94', 'М-06; E 40', 'T-14-03; E 40'])(
    'велика дорога: %s', (ref) => expect(isMajorRef(ref)).toBe(true));
  it.each(['', undefined, 'T-14-03', 'О140512', 'P-15', '1234', 'С141013'])(
    'не велика дорога: %s', (ref) => expect(isMajorRef(ref)).toBe(false));
});

describe('parseOsrmRoute', () => {
  const raw = {
    distance: 3000,
    duration: 300,
    geometry: { coordinates: [[20, 50], [20.01, 50], [20.02, 50], [20.03, 50]] as [number, number][] },
    legs: [{
      annotation: { duration: [50, 100, 150] },
      steps: [{ distance: 1000, ref: 'T-01' }, { distance: 2000, ref: 'E 40' }],
    }],
  };
  it('міняє порядок координат на широта, довгота', () => {
    expect(parseOsrmRoute(raw).coords[1]).toEqual([50, 20.01]);
  });
  it('накопичений час і відстань сходяться з підсумком', () => {
    const r = parseOsrmRoute(raw);
    expect(r.cumTime).toEqual([0, 50, 150, 300]);
    expect(r.cumDist[3]).toBeCloseTo(3000, 5);
  });
  it('рахує частку великих доріг', () => {
    expect(parseOsrmRoute(raw).majorShare).toBeCloseTo(2 / 3, 5);
  });
  it('без анотацій ділить час пропорційно відстані', () => {
    const r = parseOsrmRoute({ ...raw, legs: [{}] });
    expect(r.cumTime[3]).toBeCloseTo(300, 5);
    expect(r.cumTime[1]).toBeCloseTo(100, 0);
    expect(r.majorShare).toBe(0);
  });
  it('адреса запиту: довгота перед широтою', () => {
    expect(routeUrl([49.84, 24.03], [50.45, 30.52])).toContain('/driving/24.03,49.84;30.52,50.45?');
  });
});

describe('Overpass', () => {
  it('один запит з ділянкою на кожну можливу ніч', () => {
    const q = buildQuery([[[50, 20], [50, 20.5]], [[50, 23], [50, 23.5]]], 10000);
    expect(q.match(/around:10000/g)).toHaveLength(2);
    expect(q).toContain('nwr["tourism"~"^(hotel|motel|guest_house)$"]["name"](around:10000,50.0000,20.0000,50.0000,20.5000);');
    expect(q.startsWith('[out:json]')).toBe(true);
  });
  it('ламана ділянки йде від початку до кінця з кроком п\'ять хвилин', () => {
    const line = sectionLine(straightRoute(10), 5 * H, 6 * H);
    expect(line).toHaveLength(13);
    expect(line[0][1]).toBeLessThan(line[12][1]);
  });
  it('розбирає готелі й відкидає сміття', () => {
    const hotels = parseHotels({
      elements: [
        { type: 'node', id: 1, lat: 50, lon: 20, tags: { tourism: 'hotel', name: ' Готель Львів ', stars: '4', website: 'https://x.ua' } },
        { type: 'way', id: 2, center: { lat: 50.1, lon: 20.1 }, tags: { tourism: 'motel', name: 'Мотель', stars: 'багато', website: 'javascript:alert(1)' } },
        { type: 'node', id: 3, lat: 50, lon: 20, tags: { tourism: 'hotel' } },
        { type: 'node', id: 4, lat: 50, lon: 20, tags: { tourism: 'museum', name: 'Музей' } },
        { type: 'node', id: 5, tags: { tourism: 'hotel', name: 'Без координат' } },
        { type: 'node', id: 1, lat: 50, lon: 20, tags: { tourism: 'hotel', name: 'Дубль' } },
        { type: 'evil', id: 6, lat: 50, lon: 20, tags: { tourism: 'hotel', name: 'Чужий тип' } },
      ],
    });
    expect(hotels.map((h) => h.id)).toEqual(['node/1', 'way/2']);
    expect(hotels[0]).toMatchObject({ name: 'Готель Львів', stars: 4, website: 'https://x.ua' });
    expect(hotels[1]).toMatchObject({ lat: 50.1, stars: undefined, website: undefined });
  });
  it('довгі назви обрізаються, непридатна відповідь дає порожній список', () => {
    const [h] = parseHotels({ elements: [{ type: 'node', id: 1, lat: 1, lon: 1, tags: { tourism: 'hotel', name: 'x'.repeat(500) } }] });
    expect(h.name).toHaveLength(80);
    expect(parseHotels(null)).toEqual([]);
    expect(parseHotels({ elements: 'ні' })).toEqual([]);
  });
});

describe('parsePlaces', () => {
  it('складає назву і прибирає дублікати', () => {
    const f = (name: string, state?: string) => ({ geometry: { coordinates: [24, 49.8] }, properties: { name, state, country: 'Україна' } });
    const places = parsePlaces({ features: [f('Львів', 'Львівська область'), f('Львів', 'Львівська область'), f('Київ', 'Київ')] });
    expect(places).toEqual([
      { name: 'Львів, Львівська область, Україна', lat: 49.8, lon: 24 },
      { name: 'Київ, Україна', lat: 49.8, lon: 24 },
    ]);
    expect(parsePlaces({})).toEqual([]);
  });
});
