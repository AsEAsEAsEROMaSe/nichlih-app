import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { searchSections, type PlanParams } from './lib/checkpoints';
import { todayISO } from './lib/format';
import { browserSources, findHotels } from './lib/hotelSource';
import { fetchRoutes } from './lib/osrm';
import type { TripSummary } from './lib/planner';
import { planParamsFor, RADIUS_KM, safeRoutes, WIDE_RADIUS_KM } from './lib/trip';
import type { Hotel, LatLon, Place, Route } from './lib/types';

export { RADIUS_KM, STEP_SEC, WIDE_RADIUS_KM, WINDOW_SEC } from './lib/trip';

export interface Params {
  from?: Place;
  to?: Place;
  date: string;
  dayHours: number;
  budget: number;
  guestHouses: boolean;
}

export interface SavedTrip {
  id: string;
  createdAt: string;
  params: Params;
  routeIdx: number;
  choices: Record<number, string>;
  summary: TripSummary;
  nights: { date: string; hotel: string; price: number; lat?: number; lon?: number }[];
  /** Проріджений обрис маршруту для картки поїздки. */
  line?: LatLon[];
  booked: boolean;
}

export const planParams = (p: Params): PlanParams => planParamsFor(p.dayHours);

type Status = 'idle' | 'routing' | 'hotels' | 'ready';

interface State {
  params: Params;
  routes: Route[];
  routeIdx: number;
  hotels: Hotel[];
  wide: boolean;
  liveSections: number;
  choices: Record<number, string>;
  status: Status;
  error?: string;
  hotelsError?: string;
  trips: SavedTrip[];
  profile: { name: string; premium: boolean };
  /** Який макет показувати на широкому екрані: телефон у рамці чи повний десктоп. */
  mode: 'mobile' | 'desktop';
  setMode: (m: 'mobile' | 'desktop') => void;
  setParams: (p: Partial<Params>) => void;
  build: (restore?: { routeIdx: number; choices: Record<number, string> }) => Promise<boolean>;
  loadHotels: (wide?: boolean) => Promise<void>;
  selectRoute: (i: number) => Promise<void>;
  choose: (day: number, hotelId: string) => void;
  saveTrip: (t: Omit<SavedTrip, 'id' | 'createdAt' | 'booked'>) => void;
  deleteTrip: (id: string) => void;
  bookTrip: (id: string) => void;
  setProfile: (p: Partial<State['profile']>) => void;
}

let run = 0;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      params: { date: todayISO(), dayHours: 6, budget: 120, guestHouses: true },
      routes: [],
      routeIdx: 0,
      hotels: [],
      wide: false,
      liveSections: 0,
      choices: {},
      status: 'idle',
      trips: [],
      profile: { name: '', premium: false },
      mode: 'desktop',
      setMode: (mode) => set({ mode }),

      setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),

      build: async (restore) => {
        const { from, to } = get().params;
        if (!from || !to) return false;
        const id = ++run;
        set({ status: 'routing', error: undefined, hotelsError: undefined, routes: [], hotels: [], choices: {} });
        try {
          const routes = await safeRoutes([from.lat, from.lon], [to.lat, to.lon], fetchRoutes, browserSources);
          if (id !== run) return false;
          const routeIdx = restore && restore.routeIdx < routes.length ? restore.routeIdx : 0;
          set({ routes, routeIdx, choices: restore?.choices ?? {} });
          await get().loadHotels(false);
          return true;
        } catch (e) {
          if (id === run) set({ status: 'idle', error: e instanceof Error ? e.message : String(e) });
          return false;
        }
      },

      loadHotels: async (wide = false) => {
        const { routes, routeIdx, params } = get();
        const route = routes[routeIdx];
        if (!route) return;
        const id = ++run;
        set({ status: 'hotels', hotelsError: undefined });
        try {
          const p = planParams(params);
          const sections = searchSections(route, wide ? { ...p, windowSec: p.windowSec * 2 } : p);
          const res = await findHotels(route, sections, wide ? WIDE_RADIUS_KM : RADIUS_KM);
          if (id !== run) return;
          set({ hotels: res.hotels, liveSections: res.liveSections, wide, status: 'ready' });
        } catch (e) {
          if (id === run) set({ status: 'ready', hotelsError: e instanceof Error ? e.message : String(e) });
        }
      },

      selectRoute: async (i) => {
        set({ routeIdx: i, choices: {}, hotels: [] });
        await get().loadHotels(false);
      },

      choose: (day, hotelId) =>
        set((s) => {
          // Вибір на цей день змінює старт наступних, тому пізніші ручні вибори скидаються.
          const choices: Record<number, string> = {};
          for (const [k, v] of Object.entries(s.choices)) if (Number(k) < day) choices[Number(k)] = v;
          choices[day] = hotelId;
          return { choices };
        }),

      saveTrip: (t) =>
        set((s) => ({
          trips: [{ ...t, id: crypto.randomUUID(), createdAt: new Date().toISOString(), booked: false }, ...s.trips],
        })),
      deleteTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),
      bookTrip: (id) => set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, booked: true } : t)) })),
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
    }),
    {
      name: 'nichlih',
      version: 1,
      partialize: (s) => ({ params: s.params, trips: s.trips, profile: s.profile, mode: s.mode }),
    },
  ),
);
