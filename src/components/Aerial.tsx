import { tilesAround } from '../lib/tiles';

const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

interface Props {
  lat: number;
  lon: number;
  /** Розмір рамки в пікселях, щоб завантажити лише потрібні плитки. */
  width: number;
  height: number;
  className?: string;
  /** Масштаб знімка: 18 зблизька, 15 околиці. */
  zoom?: number;
}

/** Знімок місця з повітря: в OSM нема фото готелів, тому показуємо справжній вигляд ділянки згори. */
export function Aerial({ lat, lon, width, height, className, zoom = 17 }: Props) {
  return (
    <div className={`aerial ${className ?? ''}`} aria-hidden="true">
      {tilesAround(lat, lon, zoom, width, height).map((t) => (
        <img
          key={`${t.x}/${t.y}`}
          src={`${TILE}/${zoom}/${t.y}/${t.x}`}
          alt=""
          decoding="async"
          draggable={false}
          style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)` }}
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
      ))}
    </div>
  );
}
