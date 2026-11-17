import { describe, expect, it } from 'vitest';
import { tileXY, tilesAround } from '../tiles';

describe('плитки', () => {
  it('нульовий меридіан і екватор у центрі світу', () => {
    expect(tileXY(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });
  it('Львів на масштабі 17 потрапляє у відому плитку', () => {
    const { x, y } = tileXY(49.8397, 24.0297, 17);
    expect(Math.floor(x)).toBe(74284);
    expect(Math.floor(y)).toBe(44543);
  });
  it('плитки покривають рамку, точка лишається в центрі', () => {
    const t = tilesAround(49.8397, 24.0297, 17, 300, 200);
    const minL = Math.min(...t.map((p) => p.left));
    const maxR = Math.max(...t.map((p) => p.left + 256));
    const minT = Math.min(...t.map((p) => p.top));
    const maxB = Math.max(...t.map((p) => p.top + 256));
    expect(minL).toBeLessThanOrEqual(-150);
    expect(maxR).toBeGreaterThanOrEqual(150);
    expect(minT).toBeLessThanOrEqual(-100);
    expect(maxB).toBeGreaterThanOrEqual(100);
    expect(t.length).toBeLessThanOrEqual(6);
  });
  it('маленькій мініатюрі вистачає щонайбільше чотирьох плиток', () => {
    expect(tilesAround(50.45, 30.52, 17, 96, 96).length).toBeLessThanOrEqual(4);
  });
});
