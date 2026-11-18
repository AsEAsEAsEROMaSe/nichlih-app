import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inZones, parseZones, routeCrossesZones } from '../zones';

// Квадрат 10×10 з діркою 2×2 посередині, координати [довгота, широта].
const square = {
  features: [
    {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
          [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
        ],
      },
    },
    { geometry: { type: 'Point', coordinates: [1, 1] } },
  ],
};

describe('зони окупації', () => {
  const zones = parseZones(square);

  it('бере лише полігони, точки відкидає', () => {
    expect(zones).toHaveLength(1);
    expect(parseZones(null)).toEqual([]);
  });

  it('точка всередині, ззовні і в дірці', () => {
    expect(inZones(zones, 2, 2)).toBe(true);
    expect(inZones(zones, 12, 2)).toBe(false);
    expect(inZones(zones, 5, 5)).toBe(false);
  });

  it('маршрут, що заходить у зону, помічається', () => {
    const outside = { coords: [[-1, -1], [-1, 11]] as [number, number][] };
    const through = { coords: [[-1, 2], [2, 2], [11, 2]] as [number, number][] };
    expect(routeCrossesZones(zones, outside, 1)).toBe(false);
    expect(routeCrossesZones(zones, through, 1)).toBe(true);
  });

  // Справжній файл зон: окуповані міста всередині, підконтрольні ззовні.
  it('справжні зони: Крим і Донецьк окуповані, Запоріжжя, Херсон і Харків ні', () => {
    const real = parseZones(JSON.parse(readFileSync('public/data/occupied.json', 'utf8')));
    expect(inZones(real, 44.6, 33.52)).toBe(true); // Севастополь
    expect(inZones(real, 48.0, 37.8)).toBe(true); // Донецьк
    expect(inZones(real, 46.85, 35.37)).toBe(true); // Мелітополь
    expect(inZones(real, 47.84, 35.14)).toBe(false); // Запоріжжя
    expect(inZones(real, 46.64, 32.61)).toBe(false); // Херсон
    expect(inZones(real, 49.99, 36.23)).toBe(false); // Харків
    expect(inZones(real, 49.84, 24.03)).toBe(false); // Львів
  });
});
