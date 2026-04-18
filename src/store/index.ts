import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Stop, Route } from '../data/types';

type Location = { lat: number; lon: number } | null;

type FavStop = { stopIdx: number; name: string; region?: string | null };
type FavRoute = { routeIdx: number; shortName: string; longName: string };

type AppStore = {
  // Location
  location: Location;
  setLocation: (loc: Location) => void;

  // Favourite stops
  favStops: FavStop[];
  addFavStop: (stop: Stop, region?: string | null) => void;
  removeFavStop: (stopIdx: number, region?: string | null) => void;
  isFavStop: (stopIdx: number, region?: string | null) => boolean;

  // Favourite routes
  favRoutes: FavRoute[];
  addFavRoute: (route: Route) => void;
  removeFavRoute: (routeIdx: number) => void;
  isFavRoute: (routeIdx: number) => boolean;
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      location: null,
      setLocation: loc => set({ location: loc }),

      favStops: [],
      addFavStop: (stop, region) => {
        const { favStops } = get();
        const key = `${stop.idx}:${region ?? ''}`;
        if (favStops.some(s => `${s.stopIdx}:${s.region ?? ''}` === key)) return;
        set({ favStops: [...favStops, { stopIdx: stop.idx, name: stop.name, region: region ?? null }] });
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
      addFavRoute: route => {
        const { favRoutes } = get();
        if (favRoutes.some(r => r.routeIdx === route.idx)) return;
        set({
          favRoutes: [
            ...favRoutes,
            { routeIdx: route.idx, shortName: route.shortName, longName: route.longName },
          ],
        });
      },
      removeFavRoute: routeIdx =>
        set(s => ({ favRoutes: s.favRoutes.filter(x => x.routeIdx !== routeIdx) })),
      isFavRoute: routeIdx => get().favRoutes.some(r => r.routeIdx === routeIdx),
    }),
    {
      name: 'rongiajad-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ favStops: state.favStops, favRoutes: state.favRoutes }),
    }
  )
);
