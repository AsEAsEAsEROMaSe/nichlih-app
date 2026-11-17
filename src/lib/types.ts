/** Координата у порядку [широта, довгота]. */
export type LatLon = [number, number];

export interface Route {
  coords: LatLon[];
  /** Накопичений час у секундах для кожної точки маршруту. */
  cumTime: number[];
  /** Накопичена відстань у метрах для кожної точки маршруту. */
  cumDist: number[];
  duration: number;
  distance: number;
  /** Частка шляху великими дорогами, від 0 до 1. */
  majorShare: number;
}

export type HotelKind = 'hotel' | 'motel' | 'guest_house';

export interface Hotel {
  /** Ідентифікатор OSM, наприклад node/123. */
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: HotelKind;
  stars?: number;
  parking?: boolean;
  website?: string;
  phone?: string;
}

export interface LocatedHotel extends Hotel {
  /** Час від старту до найближчої до готелю точки маршруту, секунди. */
  routeT: number;
  /** Відстань від готелю до маршруту, км. */
  offKm: number;
  /** Оцінка гаку туди й назад, хвилини. */
  detourMin: number;
}

export interface Candidate extends LocatedHotel {
  /** Демонстраційна ціна за ніч, євро. */
  price: number;
  /** Що менше, то краще. */
  score: number;
}

export interface Checkpoint {
  t: number;
  idx: number;
  coord: LatLon;
}

export interface Day {
  index: number;
  date: string;
  startT: number;
  stopT: number;
  startM: number;
  stopM: number;
  last: boolean;
  window?: { from: number; to: number };
  checkpoints: Checkpoint[];
  candidates: Candidate[];
  chosen?: Candidate;
  /** Готелів у вікні не було, день скорочено до ближчого готелю. */
  relaxed: boolean;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
}
