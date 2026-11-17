import type { LatLon } from './types';

/**
 * Вписує маршрут у рамку width на height зі збереженням пропорцій.
 * Повертає функцію, що переводить координату в точку рамки: нею ж ставимо мітки ночівель.
 */
export function fitProjector(line: LatLon[], width: number, height: number, pad = 10): (p: LatLon) => [number, number] {
  if (line.length === 0) return () => [width / 2, height / 2];
  const midLat = line.reduce((s, p) => s + p[0], 0) / line.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = line.map((p) => p[1] * k);
  const ys = line.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return ([lat, lon]) => [offX + (lon * k - minX) * scale, offY + (-lat - minY) * scale];
}

export function svgPath(line: LatLon[], project: (p: LatLon) => [number, number]): string {
  return line.map((p, i) => `${i ? 'L' : 'M'}${project(p).map((v) => v.toFixed(1)).join(' ')}`).join('');
}
