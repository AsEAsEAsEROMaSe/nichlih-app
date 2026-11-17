import { fitProjector, svgPath } from '../lib/shape';
import type { LatLon } from '../lib/types';

/** Маленька схема маршруту для карток: дві точки і лінія між ними. */
export function RouteSketch({ seed = 0 }: { seed?: number }) {
  const bend = 14 + (seed % 3) * 9;
  return (
    <svg className="sketch" viewBox="0 0 120 56" aria-hidden="true">
      <path d={`M12 44 C40 ${44 - bend} 70 ${40 + bend / 2} 108 12`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
      <circle cx="12" cy="44" r="6" fill="currentColor" />
      <circle cx="62" cy={30 + (seed % 2 ? 3 : -2)} r="5" fill="#ffb23e" stroke="#fff" strokeWidth="2" />
      <circle cx="108" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

/** Справжній обрис маршруту з мітками ночівель: для карток збережених поїздок. */
export function RouteShape({ line, stops = [], width = 320, height = 130 }: { line: LatLon[]; stops?: LatLon[]; width?: number; height?: number }) {
  const project = fitProjector(line, width, height, 16);
  const d = svgPath(line, project);
  const [sx, sy] = project(line[0]);
  const [ex, ey] = project(line[line.length - 1]);
  return (
    <svg className="shape" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={d} fill="none" stroke="#ffb23e" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" />
      <path d={d} fill="none" stroke="#ffc866" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx} cy={sy} r="5" fill="#0a1626" stroke="#fff" strokeWidth="2.5" />
      {stops.map((s, i) => {
        const [x, y] = project(s);
        return <circle key={i} cx={x} cy={y} r="4.5" fill="#ffb23e" stroke="#fff" strokeWidth="2" />;
      })}
      <circle cx={ex} cy={ey} r="5" fill="#ffb23e" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}

/** Екран очікування: дорога, що промальовується, замість безликого кружка. */
export function Loader({ text }: { text: string }) {
  return (
    <div className="loader" role="status">
      <svg viewBox="0 0 240 90" aria-hidden="true">
        <path className="loader-road" pathLength={1} d="M12 70 C60 70 64 20 120 20 S180 72 228 28" />
        <circle cx="12" cy="70" r="6" />
        <circle className="loader-end" cx="228" cy="28" r="6" />
      </svg>
      <p>{text}</p>
    </div>
  );
}
