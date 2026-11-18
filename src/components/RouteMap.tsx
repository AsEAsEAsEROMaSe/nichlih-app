import L, { type LatLngBoundsExpression } from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { indexAtTime } from '../lib/checkpoints';
import { thin } from '../lib/geo';
import type { Candidate, Day, LatLon, Route } from '../lib/types';

/** Кольори днів підібрано під нічну карту: перший день бурштиновий, як у фірмовому маршруті. */
export const DAY_COLORS = ['#ffb23e', '#4cc3ff', '#b79bff', '#ff7f96', '#5fe0a0', '#ff9be0'];
export const dayColor = (i: number) => DAY_COLORS[i % DAY_COLORS.length];

const MOON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const nightIcon = (n: number) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="pin-night">${MOON}<b>${n}</b></div>` });
const priceIcon = (price: number, on: boolean, hot: boolean) =>
  L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="pin-price${on ? ' on' : ''}${hot ? ' hot' : ''}">${price} €</div>` });
const endIcon = (kind: 'start' | 'finish') => L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="hero-end ${kind}"></div>` });

// Плитки OSM без ключа. CARTO перевірено 18.11.2026: без ключа віддає заглушку «API KEY REQUIRED».
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function Fit({ points }: { points: LatLon[] }) {
  const map = useMap();
  const key = points.length ? `${points[0]}|${points[points.length - 1]}|${points.length}` : '';
  useEffect(() => {
    const fit = () => points.length && map.fitBounds(points as LatLngBoundsExpression, { padding: [48, 48], animate: false, maxZoom: 14 });
    fit();
    // Карта міняє розмір при перемиканні «телефон / десктоп»: перераховуємо і підганяємо межі.
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      fit();
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Анімації ліній чекають на плитки карти (див. styles.css), але не довше 2,5 с. */
function TilesReady() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ready = () => el.classList.add('tiles-ready');
    const layers: L.TileLayer[] = [];
    map.eachLayer((l) => { if (l instanceof L.TileLayer) layers.push(l); });
    layers.forEach((l) => l.once('load', ready));
    const t = window.setTimeout(ready, 2500);
    return () => {
      clearTimeout(t);
      layers.forEach((l) => l.off('load', ready));
    };
  }, [map]);
  return null;
}

/** Лінії маршруту промальовуються: довжину шляху зводимо до одиниці, далі працює CSS. */
function DrawLines({ token }: { token: string }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().querySelectorAll('path.day-line').forEach((p) => p.setAttribute('pathLength', '1'));
  }, [map, token]);
  return null;
}

interface Props {
  route: Route;
  days: Day[];
  /** Якщо задано, карта показує вікно ночівлі цього дня з цінами всіх варіантів. */
  focus?: Day;
  onPick?: (c: Candidate) => void;
  /** Готель, на який навели в списку: його мітка підсвічується. */
  hotId?: string;
  /** Показати одну точку зблизька (сторінка готелю). */
  spot?: LatLon;
}

export function RouteMap({ route, days, focus, onPick, hotId, spot }: Props) {
  const full = useMemo(() => thin(route.coords, 1500), [route]);
  const segments = useMemo(
    () =>
      days.map((d) => {
        const a = indexAtTime(route.cumTime, d.startT);
        const b = indexAtTime(route.cumTime, d.stopT);
        return { index: d.index, line: thin(route.coords.slice(a, b + 1), 800) };
      }),
    [route, days],
  );
  const shown = focus ? focus.candidates.slice(0, 40) : [];
  const fit: LatLon[] = spot
    ? [[spot[0] - 0.03, spot[1] - 0.05], [spot[0] + 0.03, spot[1] + 0.05]]
    : focus
      ? [...focus.checkpoints.map((c) => c.coord), ...shown.map((c): LatLon => [c.lat, c.lon])]
      : full;

  return (
    <MapContainer className="map" center={route.coords[0]} zoom={6} scrollWheelZoom zoomControl={false}>
      <TileLayer url={TILES} attribution={ATTRIBUTION} />
      <TilesReady />
      <Fit points={fit.length ? fit : full} />
      <DrawLines token={segments.map((s) => s.index).join()} />
      <Polyline positions={full} pathOptions={{ color: '#050d18', weight: 9, opacity: 0.85, interactive: false }} />
      {focus && <Polyline positions={full} pathOptions={{ color: '#5d7089', weight: 4, interactive: false }} />}
      {segments.map((s, i) => (
        <Polyline key={s.index} positions={s.line} pathOptions={{ color: dayColor(s.index), weight: 5, className: `day-line d${Math.min(i, 5)}`, interactive: false }} />
      ))}
      <Marker position={route.coords[0]} icon={endIcon('start')}><Tooltip>Старт</Tooltip></Marker>
      <Marker position={route.coords[route.coords.length - 1]} icon={endIcon('finish')}><Tooltip>Фініш</Tooltip></Marker>
      {shown.map((c) => {
        const on = c.id === focus?.chosen?.id;
        const hot = c.id === hotId;
        return (
          <Marker
            key={`${c.id}-${on}-${hot}`}
            position={[c.lat, c.lon]}
            icon={priceIcon(c.price, on, hot)}
            zIndexOffset={hot ? 2000 : on ? 1000 : 0}
            eventHandlers={onPick ? { click: () => onPick(c) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -14]}>{c.name}</Tooltip>
          </Marker>
        );
      })}
      {!focus &&
        days.map(
          (d) =>
            d.chosen && (
              <Marker key={`${d.index}-${d.chosen.id}`} position={[d.chosen.lat, d.chosen.lon]} icon={nightIcon(d.index + 1)} zIndexOffset={500}>
                <Tooltip direction="top" offset={[0, -22]}>{`Ніч ${d.index + 1}: ${d.chosen.name}`}</Tooltip>
              </Marker>
            ),
        )}
    </MapContainer>
  );
}
