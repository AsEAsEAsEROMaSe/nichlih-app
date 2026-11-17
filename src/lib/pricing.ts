import type { Hotel } from './types';

/**
 * Демонстраційна модель ціни за ніч у євро.
 * Справжні ціни готелів доступні лише партнерам, тому ціну рахує формула:
 * тип закладу, зірки, сезон, день тижня і стабільний розкид для кожного готелю.
 */
const BASE = { hotel: 45, motel: 32, guest_house: 28 } as const;
const STARS: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1, 4: 1.5, 5: 2.4 };

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seasonFactor(dateISO: string): number {
  const [, m, d] = dateISO.split('-').map(Number);
  if (m >= 6 && m <= 8) return 1.2;
  if ((m === 12 && d >= 20) || (m === 1 && d <= 10)) return 1.25;
  return 1;
}

/** Ночі з п'ятниці на суботу і з суботи на неділю дорожчі. */
export function weekendFactor(dateISO: string): number {
  const day = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
  return day === 5 || day === 6 ? 1.15 : 1;
}

export interface PriceParts {
  base: number;
  stars: number;
  jitter: number;
  season: number;
  weekend: number;
  total: number;
}

/** З чого складається ціна: показуємо це користувачу, щоб цифра не здавалась взятою зі стелі. */
export function priceParts(hotel: Pick<Hotel, 'id' | 'kind' | 'stars'>, dateISO: string): PriceParts {
  const base = BASE[hotel.kind];
  const stars = STARS[Math.round(hotel.stars ?? 3)] ?? 1;
  const jitter = 0.85 + (hashId(hotel.id) % 31) / 100;
  const season = seasonFactor(dateISO);
  const weekend = weekendFactor(dateISO);
  return { base, stars, jitter, season, weekend, total: Math.round(base * stars * jitter * season * weekend) };
}

export function nightPrice(hotel: Pick<Hotel, 'id' | 'kind' | 'stars'>, dateISO: string): number {
  return priceParts(hotel, dateISO).total;
}

export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
