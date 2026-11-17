import type { Hotel, LatLon, Route } from '../types';

/** Прямий маршрут на схід уздовж 50-ї паралелі зі сталою швидкістю. */
export function straightRoute(hours: number, kmh = 90, stepKm = 1): Route {
  const totalKm = hours * kmh;
  const n = Math.round(totalKm / stepKm) + 1;
  const kmPerDegLon = 111.32 * Math.cos((50 * Math.PI) / 180);
  const coords: LatLon[] = [];
  const cumTime: number[] = [];
  const cumDist: number[] = [];
  for (let i = 0; i < n; i++) {
    const km = (totalKm * i) / (n - 1);
    coords.push([50, 20 + km / kmPerDegLon]);
    cumDist.push(km * 1000);
    cumTime.push((km / kmh) * 3600);
  }
  return { coords, cumTime, cumDist, duration: hours * 3600, distance: totalKm * 1000, majorShare: 1 };
}

/** Готель біля маршруту: на якій годині шляху і на скільки кілометрів убік (на північ). */
export function hotelAt(route: Route, hour: number, offKm = 0, extra: Partial<Hotel> = {}): Hotel {
  const idx = route.cumTime.findIndex((t) => t >= hour * 3600);
  const [lat, lon] = route.coords[idx];
  return {
    id: `node/${Math.round(hour * 1000)}${Math.round(offKm * 10)}`,
    name: `Готель ${hour}`,
    lat: lat + offKm / 110.57,
    lon,
    kind: 'hotel',
    ...extra,
  };
}

export const H = 3600;
