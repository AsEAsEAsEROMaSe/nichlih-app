/** Дробові координати плитки веб-меркатора для точки: ціла частина це номер плитки. */
export function tileXY(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const r = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  };
}

export interface TilePlacement {
  x: number;
  y: number;
  /** Зсув лівого верхнього кута плитки від центру рамки, пікселі. */
  left: number;
  top: number;
}

/** Плитки, які треба намалювати, щоб точка опинилась у центрі рамки width на height. */
export function tilesAround(lat: number, lon: number, zoom: number, width: number, height: number, size = 256): TilePlacement[] {
  const { x, y } = tileXY(lat, lon, zoom);
  const out: TilePlacement[] = [];
  const x0 = Math.floor(x - width / 2 / size);
  const x1 = Math.floor(x + width / 2 / size);
  const y0 = Math.floor(y - height / 2 / size);
  const y1 = Math.floor(y + height / 2 / size);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) out.push({ x: tx, y: ty, left: (tx - x) * size, top: (ty - y) * size });
  return out;
}
