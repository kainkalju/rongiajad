import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Stop, Route } from '../data/types';
import { getRouteByShortName, resolveRouteDirection, resolveStop } from '../data/parser';

type Location = { lat: number; lon: number } | null;

export type FavStop = {
  stopIdx: number;
  name: string;
  region?: string | null;
  lat?: number;
  lon?: number;
};
export type FavRoute = {
  routeIdx: number;
  shortName: string;
  longName: string;
  /** GTFS direction_id last resolved for originStop → terminalStop. Not stable across feeds. */
  directionId?: 0 | 1;
  originStop?: string;
  terminalStop?: string;
};

export type FavRouteDirection = {
  directionId: 0 | 1;
  originStop: string;
  terminalStop: string;
};

type AppStore = {
  // Location
  location: Location;
  setLocation: (loc: Location) => void;

  // GTFS data version — incremented after a runtime update so screens re-fetch
  gtfsVersion: number;
  bumpGtfsVersion: () => void;
  // Re-resolves stored favourite indices after a GTFS update (indices may shift)
  reresolveFavoriteIndices: () => void;

  // Favourite stops
  favStops: FavStop[];
  addFavStop: (stop: Stop, region?: string | null) => void;
  removeFavStop: (stopIdx: number, region?: string | null) => void;
  isFavStop: (stopIdx: number, region?: string | null) => boolean;

  // Favourite routes
  favRoutes: FavRoute[];
  addFavRoute: (route: Route, direction: FavRouteDirection) => void;
  removeFavRoute: (routeIdx: number, directionId: 0 | 1) => void;
  isFavRoute: (routeIdx: number, directionId: 0 | 1) => boolean;
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      location: null,
      setLocation: loc => set({ location: loc }),

      gtfsVersion: 0,
      bumpGtfsVersion: () => set(s => ({ gtfsVersion: s.gtfsVersion + 1 })),
      reresolveFavoriteIndices: () => {
        const { favRoutes, favStops } = get();
        const newRoutes = favRoutes.map(r => {
          const found = getRouteByShortName(r.shortName);
          if (!found) return r;
          const direction = resolveRouteDirection(found.idx, {
            longName: r.longName,
            originStop: r.originStop,
            terminalStop: r.terminalStop,
          });
          return {
            routeIdx: found.idx,
            shortName: found.shortName,
            longName: found.longName,
            directionId: direction.directionId,
            originStop: direction.originStop,
            terminalStop: direction.terminalStop,
          };
        });
        const newStops = favStops.map(s => {
          const found = resolveStop(s.name, { lat: s.lat, lon: s.lon, preferIdx: s.stopIdx });
          if (!found) return s;
          return {
            ...s,
            stopIdx: found.idx,
            lat: s.lat ?? found.lat,
            lon: s.lon ?? found.lon,
          };
        });
        if (
          JSON.stringify(newRoutes) === JSON.stringify(favRoutes) &&
          JSON.stringify(newStops) === JSON.stringify(favStops)
        ) {
          return;
        }
        set({ favRoutes: newRoutes, favStops: newStops });
      },

      favStops: [],
      addFavStop: (stop, region) => {
        const { favStops } = get();
        const key = `${stop.idx}:${region ?? ''}`;
        if (favStops.some(s => `${s.stopIdx}:${s.region ?? ''}` === key)) return;
        set({
          favStops: [...favStops, {
            stopIdx: stop.idx,
            name: stop.name,
            region: region ?? null,
            lat: stop.lat,
            lon: stop.lon,
          }],
        });
      },
      removeFavStop: (stopIdx, region) =>
        set(s => ({
          favStops: s.favStops.filter(x =>
            !(x.stopIdx === stopIdx && (x.region ?? '') === (region ?? ''))
          ),
        })),
      isFavStop: (stopIdx, region) =>
        get().favStops.some(
          s => s.stopIdx === stopIdx && (s.region ?? '') === (region ?? '')
        ),

      favRoutes: [],
      addFavRoute: (route, direction) => {
        const { favRoutes } = get();
        const sameDirection = favRoutes.some(r =>
          r.shortName === route.shortName &&
          r.originStop === direction.originStop &&
          r.terminalStop === direction.terminalStop
        );
        if (sameDirection) return;
        set({
          favRoutes: [
            ...favRoutes,
            {
              routeIdx: route.idx,
              shortName: route.shortName,
              longName: route.longName,
              directionId: direction.directionId,
              originStop: direction.originStop,
              terminalStop: direction.terminalStop,
            },
          ],
        });
      },
      removeFavRoute: (routeIdx, directionId) =>
        set(s => ({
          favRoutes: s.favRoutes.filter(x =>
            !(x.routeIdx === routeIdx && x.directionId === directionId)
          ),
        })),
      isFavRoute: (routeIdx, directionId) =>
        get().favRoutes.some(r => r.routeIdx === routeIdx && r.directionId === directionId),
    }),
    {
      name: 'rongiajad-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ favStops: state.favStops, favRoutes: state.favRoutes }), // gtfsVersion intentionally excluded
    }
  )
);
