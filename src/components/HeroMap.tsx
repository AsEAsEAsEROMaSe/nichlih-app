import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { tileXY } from '../lib/tiles';
import type { LatLon } from '../lib/types';

export interface HeroStop {
  night: number;
  name: string;
  lat: number;
  lon: number;
  price: number;
  /** Частка шляху від старту, 0…1: коли мітка з'являється під час малювання маршруту. */
  frac: number;
}

interface Props {
  line: LatLon[];
  stops: HeroStop[];
}

const DRAW_MS = 3200;
const LOOP_MS = 15000;
const READY_MS = 2500;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function aerialTile(lat: number, lon: number): string {
  const { x, y } = tileXY(lat, lon, 16);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/${Math.floor(y)}/${Math.floor(x)}`;
}

/**
 * Жива нічна карта для першого екрана: маршрут малюється на очах, на точках ночівлі
 * спливають картки готелів, уздовж дороги їде вогник. Карта лише для показу, без керування.
 */
export function HeroMap({ line, stops }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || line.length < 2) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const map = L.map(el, {
      zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false,
      boxZoom: false, keyboard: false, zoomSnap: 0.1, attributionControl: false,
    });
    L.control.attribution({ position: 'topright', prefix: false }).addAttribution('© OpenStreetMap').addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const glow = L.polyline(line, { color: '#ffb23e', weight: 14, opacity: 0.35, className: 'hero-route-glow', interactive: false }).addTo(map);
    const route = L.polyline(line, { color: '#ffc866', weight: 4, className: 'hero-route', interactive: false }).addTo(map);
    for (const p of [glow, route]) p.getElement()?.setAttribute('pathLength', '1');

    const dot = (cls: string) => L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="hero-end ${cls}"></div>` });
    L.marker(line[0], { icon: dot('start'), interactive: false }).addTo(map);
    L.marker(line[line.length - 1], { icon: dot('finish'), interactive: false }).addTo(map);
    stops.forEach((s, i) => {
      const html = `<div class="hero-stop ${i % 2 ? 'left' : 'right'}" style="animation-delay:${Math.round(s.frac * DRAW_MS)}ms">
        <span class="hero-stop-dot"></span>
        <div class="hero-stop-card"><img src="${aerialTile(s.lat, s.lon)}" alt="" />
          <div><small>Ніч ${s.night}</small><b>${esc(s.name)}</b><span>${s.price} € за ніч</span></div>
        </div></div>`;
      L.marker([s.lat, s.lon], { icon: L.divIcon({ className: '', iconSize: [0, 0], html }), interactive: false }).addTo(map);
    });

    // Вогник їде в екранних пікселях без округлення: Leaflet ставить мітки з точністю до пікселя,
    // і рух по кадрах виходить сходинками. Тут лише transform, тож браузер не перемальовує карту.
    let px: L.Point[] = [];
    const cum = [0];
    const measure = () => {
      const origin = map.getPixelOrigin();
      px = line.map((p) => map.project(p).subtract(origin));
      cum.length = 1;
      for (let i = 1; i < px.length; i++) cum.push(cum[i - 1] + px[i].distanceTo(px[i - 1]));
    };

    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const wide = w >= 900;
      map.invalidateSize({ animate: false });
      map.fitBounds(L.latLngBounds(line), {
        animate: false,
        paddingTopLeft: wide ? [w * 0.55, 60] : [36, h * 0.52],
        paddingBottomRight: wide ? [290, 130] : [36, 80],
      });
      measure();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    const car = L.DomUtil.create('div', 'hero-car', map.getPanes().markerPane);
    car.style.display = 'none';
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      t0 ||= now;
      const total = cum[cum.length - 1];
      const target = (((now - t0) % LOOP_MS) / LOOP_MS) * total;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < target) i++;
      const k = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const x = px[i - 1].x + (px[i].x - px[i - 1].x) * k;
      const y = px[i - 1].y + (px[i].y - px[i - 1].y) * k;
      car.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    // Анімація стоїть на паузі (див. styles.css), доки не прийдуть плитки карти,
    // інакше маршрут малюється по порожньому фону. Повільна мережа не тримає довше READY_MS.
    let start = 0;
    const ready = () => {
      if (el.classList.contains('tiles-ready')) return;
      el.classList.add('tiles-ready');
      if (!still) start = window.setTimeout(() => {
        car.style.display = '';
        raf = requestAnimationFrame(tick);
      }, DRAW_MS);
    };
    tiles.once('load', ready);
    const fallback = window.setTimeout(ready, READY_MS);

    return () => {
      clearTimeout(fallback);
      clearTimeout(start);
      cancelAnimationFrame(raf);
      ro.disconnect();
      map.remove();
    };
  }, [line, stops]);

  return <div className="hero-map" ref={box} aria-hidden="true" />;
}
