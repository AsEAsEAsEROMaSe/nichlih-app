import type { ReactNode } from 'react';

const P = (d: string) => <path d={d} />;
const ICONS: Record<string, ReactNode> = {
  compass: <><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" /></>,
  map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />{P('M9 3v15M15 6v15')}</>,
  bag: <><rect x="2" y="7" width="20" height="14" rx="2" />{P('M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16')}</>,
  user: <>{P('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2')}<circle cx="12" cy="7" r="4" /></>,
  moon: P('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'),
  bed: P('M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9'),
  flag: P('M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7'),
  clock: <><circle cx="12" cy="12" r="10" />{P('M12 6v6l4 2')}</>,
  route: <><circle cx="6" cy="19" r="3" />{P('M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15')}<circle cx="18" cy="5" r="3" /></>,
  star: <polygon fill="currentColor" stroke="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />,
  phone: <><rect x="5" y="2" width="14" height="20" rx="2" />{P('M12 18h.01')}</>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2" />{P('M8 21h8M12 17v4')}</>,
  arrow: P('M5 12h14M12 5l7 7-7 7'),
  check: P('M20 6 9 17l-5-5'),
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" />{P('M7 11V7a5 5 0 0 1 10 0v4')}</>,
  sparkles: P('M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z'),
  pin: <>{P('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z')}<circle cx="12" cy="10" r="3" /></>,
  external: P('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3'),
  chevron: P('M9 18l6-6-6-6'),
  back: P('M15 18l-6-6 6-6'),
  trash: P('M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'),
  euro: P('M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2'),
  parking: <><rect x="3" y="3" width="18" height="18" rx="2" />{P('M9 17V7h4a3 3 0 0 1 0 6H9')}</>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" />{P('M16 2v4M8 2v4M3 10h18')}</>,
  call: P('M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z'),
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
