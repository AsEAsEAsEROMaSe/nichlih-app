import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { hotelAt, straightRoute } from '../../lib/__tests__/helpers';
import type { HotelSources } from '../../lib/hotelSource';
import type { Hotel, LatLon, Place, Route } from '../../lib/types';
import { parseZones } from '../../lib/zones';
import { createServer, type ServerDeps } from '../server';

/**
 * Сервер MCP перевіряємо справжнім клієнтом через транспорт у пам'яті:
 * так перевіряються і схеми інструментів, і те, що агент реально отримає.
 * Мережі нема: маршрут, пошук місць і готелі підставлені.
 */

const route = straightRoute(20); // 1800 км на схід уздовж 50-ї паралелі, 90 км/год
const START: LatLon = route.coords[0];
const END: LatLon = route.coords[route.coords.length - 1];

const hotels: Hotel[] = [
  hotelAt(route, 6.5, 0.5, { name: 'Ніч перша', stars: 3 }),
  hotelAt(route, 6.8, 3, { name: 'Ніч перша, дешевша', kind: 'guest_house' }),
  hotelAt(route, 13.5, 0.5, { name: 'Ніч друга' }),
];

/** Квадрат [довгота, широта] навколо точки, щоб зробити її «окупованою». */
const squareAround = ([lat, lon]: LatLon, d = 0.05) => ({
  features: [{ geometry: { type: 'Polygon', coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]] } }],
});

const places: Record<string, Place> = {
  start: { name: 'Старт', lat: START[0], lon: START[1] },
  finish: { name: 'Фініш', lat: END[0], lon: END[1] },
};

async function connect(over: Partial<ServerDeps> = {}, zones: unknown = { features: [] }) {
  const sources: HotelSources = {
    dataset: async () => hotels,
    zones: async () => parseZones(zones),
    live: async () => [],
  };
  const deps: ServerDeps = {
    fetchRoutes: vi.fn(async (): Promise<Route[]> => [route]),
    searchPlaces: vi.fn(async (q: string) => (places[q] ? [places[q]] : [])),
    sources,
    today: () => '2026-11-18',
    ...over,
  };
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(deps).connect(a);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
    const text = r.content[0].text;
    return { error: r.isError ? text : undefined, data: r.isError ? undefined : JSON.parse(text) };
  };
  return { client, call, deps };
}

describe('MCP-сервер', () => {
  it('віддає чотири інструменти, усі лише для читання', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['find_place', 'hotel_details', 'night_options', 'plan_trip']);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('plan_trip ділить дорогу на дні і ставить готель на кожну ніч', async () => {
    const { call } = await connect();
    const { data } = await call('plan_trip', { from: 'start', to: 'finish', max_drive_hours: 7 });
    expect(data.from).toBe('Старт');
    expect(data.days).toHaveLength(3);
    expect(data.days[0].night.name).toBe('Ніч перша');
    expect(data.days[0].drive_hours).toBeLessThanOrEqual(7);
    expect(data.days[1].night.name).toBe('Ніч друга');
    expect(data.days[2].arrives).toBe('destination');
    expect(data.totals.nights).toBe(2);
    expect(data.totals.lodging_eur).toBe(data.days[0].night.price_eur + data.days[1].night.price_eur);
    expect(data.notes.join(' ')).toMatch(/demo/);
  });

  it('координати «lat,lon» не йдуть у пошук місць', async () => {
    const { call, deps } = await connect();
    const { data } = await call('plan_trip', { from: `${START[0]},${START[1]}`, to: `${END[0]},${END[1]}` });
    expect(data.days.length).toBeGreaterThan(1);
    expect(deps.searchPlaces).not.toHaveBeenCalled();
  });

  it('повтор тієї самої поїздки бере маршрут з кешу', async () => {
    const { call, deps } = await connect();
    await call('plan_trip', { from: 'start', to: 'finish' });
    await call('night_options', { from: 'start', to: 'finish', night: 1 });
    expect(deps.fetchRoutes).toHaveBeenCalledTimes(1);
  });

  it('hotel_choices міняє готель на ніч', async () => {
    const { call } = await connect();
    const first = await call('plan_trip', { from: 'start', to: 'finish', max_drive_hours: 7 });
    const other = hotels[1].id;
    expect(first.data.days[0].night.hotel_id).not.toBe(other);
    const second = await call('plan_trip', { from: 'start', to: 'finish', max_drive_hours: 7, hotel_choices: { '1': other } });
    expect(second.data.days[0].night.hotel_id).toBe(other);
  });

  it('без гостьових будинків їх нема і серед варіантів', async () => {
    const { call } = await connect();
    const { data } = await call('night_options', { from: 'start', to: 'finish', max_drive_hours: 7, night: 1, include_guest_houses: false });
    expect(data.hotels.map((h: { kind: string }) => h.kind)).not.toContain('guest_house');
  });

  it('night_options сортує за ціною і не вигадує неіснуючих ночей', async () => {
    const { call } = await connect();
    const { data } = await call('night_options', { from: 'start', to: 'finish', max_drive_hours: 7, night: 1, sort: 'price' });
    const prices = data.hotels.map((h: { price_eur: number }) => h.price_eur);
    expect(prices).toEqual([...prices].sort((x, y) => x - y));
    const missing = await call('night_options', { from: 'start', to: 'finish', max_drive_hours: 7, night: 9 });
    expect(missing.error).toMatch(/night 9 does not exist/);
  });

  it('не будує маршрут в окуповану точку і пояснює це англійською', async () => {
    const { call, deps } = await connect({}, squareAround(END));
    const { error } = await call('plan_trip', { from: 'start', to: 'finish' });
    expect(error).toMatch(/occupied territory/);
    expect(deps.fetchRoutes).not.toHaveBeenCalled();
  });

  it('відкидає маршрут, що проходить крізь окуповану зону', async () => {
    const middle = route.coords[Math.floor(route.coords.length / 2)];
    const { call } = await connect({}, squareAround(middle));
    const { error } = await call('plan_trip', { from: 'start', to: 'finish' });
    expect(error).toMatch(/passes through occupied territory/);
  });

  it('find_place позначає окуповані місця', async () => {
    const { call } = await connect({}, squareAround(END));
    const { data } = await call('find_place', { query: 'finish' });
    expect(data.places[0].occupied).toBe(true);
  });

  it('невідоме місце й невідомий готель дають зрозумілу помилку, а не збій', async () => {
    const { call } = await connect();
    expect((await call('plan_trip', { from: 'Атлантида', to: 'finish' })).error).toMatch(/Place not found/);
    expect((await call('hotel_details', { hotel_id: 'node/1' })).error).toMatch(/Unknown hotel_id/);
  });

  it('hotel_details показує розбір ціни і що вона демонстраційна', async () => {
    const { call } = await connect();
    const { data } = await call('hotel_details', { hotel_id: hotels[0].id, date: '2026-07-04' });
    expect(data.name).toBe('Ніч перша');
    expect(data.price.season_factor).toBe(1.2);
    expect(data.price.source).toMatch(/demo/);
  });

  it('збій зовнішнього сервісу повертається як помилка інструмента', async () => {
    const { call } = await connect({ fetchRoutes: async () => { throw new Error('OSRM 502'); } });
    const { error } = await call('plan_trip', { from: 'start', to: 'finish' });
    expect(error).toMatch(/Upstream service error: OSRM 502/);
  });

  it('схема відкидає неправильні аргументи', async () => {
    const { client } = await connect();
    const r = (await client.callTool({ name: 'plan_trip', arguments: { from: 'start', to: 'finish', max_drive_hours: 30 } })) as { isError?: boolean };
    expect(r.isError).toBe(true);
  });
});

