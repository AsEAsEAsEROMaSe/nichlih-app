import { describe, expect, it } from 'vitest';
import { fmtDuration, fmtKm, plural } from '../format';

describe('формат', () => {
  it('множина днів', () => {
    const f: [string, string, string] = ['день', 'дні', 'днів'];
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25, 111].map((n) => plural(n, f))).toEqual(
      ['день', 'дні', 'дні', 'днів', 'днів', 'днів', 'день', 'дні', 'днів', 'днів']);
  });
  it('тривалість і відстань', () => {
    expect(fmtDuration(45 * 60)).toBe('45 хв');
    expect(fmtDuration(2 * 3600)).toBe('2 год');
    expect(fmtDuration(5 * 3600 + 20 * 60)).toBe('5 год 20 хв');
    expect(fmtKm(541400)).toBe('541 км');
  });
});
