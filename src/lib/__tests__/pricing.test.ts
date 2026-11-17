import { describe, expect, it } from 'vitest';
import { addDays, nightPrice, seasonFactor, weekendFactor } from '../pricing';

const h = (over = {}) => ({ id: 'node/42', kind: 'hotel' as const, stars: 3, ...over });

describe('модель цін', () => {
  it('та сама ціна для того самого готелю і дати', () => {
    expect(nightPrice(h(), '2026-11-18')).toBe(nightPrice(h(), '2026-11-18'));
  });
  it('вихідні не дешевші за будні', () => {
    expect(weekendFactor('2026-11-20')).toBeGreaterThan(1); // п'ятниця
    expect(weekendFactor('2026-11-18')).toBe(1); // середа
    expect(nightPrice(h(), '2026-11-21')).toBeGreaterThanOrEqual(nightPrice(h(), '2026-11-18'));
  });
  it('більше зірок коштує дорожче', () => {
    const prices = [1, 2, 3, 4, 5].map((stars) => nightPrice(h({ stars }), '2026-11-18'));
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]);
  });
  it('готель дорожчий за мотель, мотель за гостьовий будинок', () => {
    const p = (kind: 'hotel' | 'motel' | 'guest_house') => nightPrice(h({ kind }), '2026-11-18');
    expect(p('hotel')).toBeGreaterThan(p('motel'));
    expect(p('motel')).toBeGreaterThan(p('guest_house'));
  });
  it('літо і новорічні свята дорожчі', () => {
    expect(seasonFactor('2026-07-10')).toBeGreaterThan(1);
    expect(seasonFactor('2026-12-31')).toBeGreaterThan(1);
    expect(seasonFactor('2027-01-05')).toBeGreaterThan(1);
    expect(seasonFactor('2026-11-18')).toBe(1);
  });
  it('без зірок рахується як три зірки', () => {
    expect(nightPrice(h({ stars: undefined }), '2026-11-18')).toBe(nightPrice(h(), '2026-11-18'));
  });
  it('розкид між готелями в межах п\'ятнадцяти відсотків', () => {
    for (let i = 0; i < 200; i++) {
      const p = nightPrice(h({ id: `node/${i}` }), '2026-11-18');
      expect(p).toBeGreaterThanOrEqual(Math.round(45 * 0.85));
      expect(p).toBeLessThanOrEqual(Math.round(45 * 1.15));
    }
  });
  it('addDays переходить через місяць і рік', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
