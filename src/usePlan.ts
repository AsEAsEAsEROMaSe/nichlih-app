import { useMemo } from 'react';
import { locateHotels, planTrip, summarize } from './lib/planner';
import { planParams, useStore } from './store';

/** Поточний план: маршрут, дні з готелями і підсумок. null, якщо маршрут ще не побудовано. */
export function usePlan() {
  const route = useStore((s) => s.routes[s.routeIdx]);
  const hotels = useStore((s) => s.hotels);
  const params = useStore((s) => s.params);
  const choices = useStore((s) => s.choices);

  const located = useMemo(() => {
    if (!route) return [];
    return locateHotels(route, params.guestHouses ? hotels : hotels.filter((h) => h.kind !== 'guest_house'));
  }, [route, hotels, params.guestHouses]);

  return useMemo(() => {
    if (!route) return null;
    const days = planTrip(route, located, { ...planParams(params), startDate: params.date, budget: params.budget }, choices);
    return { route, days, summary: summarize(route, days) };
  }, [route, located, params, choices]);
}
