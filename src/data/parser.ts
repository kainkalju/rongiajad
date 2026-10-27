import gtfsRaw from './gtfs.json';
import type { GtfsData, Stop, Route, Departure, TimetableEntry, DayType } from './types';

let gtfs: GtfsData = gtfsRaw as unknown as GtfsData;

export function initGtfs(data: GtfsData): void {
  gtfs = data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM:SS" (including ≥24h) into minutes-since-midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Format minutes-since-midnight as "HH:MM" */
export function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format a Date as YYYYMMDD string */
function dateToYYYYMMDD(d: Date): number {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${day}`);
}

/** JS weekday (0=Sun…6=Sat) → calendar bitmask bit position (Mon=0…Sun=6) */
const JS_DAY_TO_BIT = [6, 0, 1, 2, 3, 4, 5]; // Sun→6, Mon→0, …

function isServiceActive(serviceIdx: number, dateNum: number, jsDay: number): boolean {
  // Check exception
  const exceptions = gtfs.calendarDates[serviceIdx];
  if (exceptions) {
    const exc = exceptions[String(dateNum)];
    if (exc === 1) return true;
    if (exc === 2) return false;
  }
  const svc = gtfs.calendar[serviceIdx];
  if (!svc) return false;
  if (dateNum < svc.start || dateNum > svc.end) return false;
  const bit = 1 << JS_DAY_TO_BIT[jsDay];
  return (svc.days & bit) !== 0;
}

// ---------------------------------------------------------------------------
// Stop accessors
// ---------------------------------------------------------------------------

export function getStop(idx: number): Stop {
  const [name, lat, lon] = gtfs.stops[idx];
  return { idx, name, lat, lon };
}

export function getAllStops(): Stop[] {
  return gtfs.stops.map(([name, lat, lon], idx) => ({ idx, name, lat, lon }));
}

export function getRoute(idx: number): Route {
  const [shortName, longName, color] = gtfs.routes[idx];
  return { idx, shortName, longName, color };
}

export function getRouteByShortName(shortName: string): Route | undefined {
  const idx = gtfs.routes.findIndex(r => r[0] === shortName);
  return idx === -1 ? undefined : { idx, shortName: gtfs.routes[idx][0], longName: gtfs.routes[idx][1], color: gtfs.routes[idx][2] };
}

/**
 * Pick the stop record for a saved favourite.
 * Elron publishes two stop_ids per station name (one platform per direction).
 * Stored coordinates win, so a later feed cannot attach the favourite to the other platform.
 * An older favourite with no coordinates keeps its index when that index is still this station.
 */
export function resolveStop(
  name: string,
  opts?: { lat?: number; lon?: number; preferIdx?: number }
): Stop | undefined {
  const matches: Stop[] = [];
  gtfs.stops.forEach(([stopName, lat, lon], idx) => {
    if (stopName === name) matches.push({ idx, name: stopName, lat, lon });
  });
  if (matches.length === 0) return undefined;
  if (opts?.lat != null && opts?.lon != null) {
    const lat = opts.lat;
    const lon = opts.lon;
    return matches.reduce((best, s) =>
      haversine(lat, lon, s.lat, s.lon) < haversine(lat, lon, best.lat, best.lon) ? s : best
    );
  }
  if (opts?.preferIdx != null) {
    const same = matches.find(s => s.idx === opts.preferIdx);
    if (same) return same;
  }
  return matches[0];
}

export function getTrip(tripIdx: number): [number, number, number, string, string] | undefined {
  return gtfs.trips[tripIdx] as [number, number, number, string, string] | undefined;
}

// ---------------------------------------------------------------------------
// Haversine — returns distance in km
// ---------------------------------------------------------------------------
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Return nearest N train stops sorted by distance */
export function getNearestStops(
  lat: number,
  lon: number,
  limit = 3
): (Stop & { distanceKm: number })[] {
  return gtfs.stops
    .map(([name, sLat, sLon], idx) => ({
      idx,
      name,
      lat: sLat,
      lon: sLon,
      distanceKm: haversine(lat, lon, sLat, sLon),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Departures at a stop
// ---------------------------------------------------------------------------

function buildDeparture(
  tripIdx: number,
  stopIdx: number,
  dep: string
): Departure | null {
  const trip = gtfs.trips[tripIdx];
  if (!trip) return null;
  const [routeIdx, , , headsign, tripShortName] = trip;
  const route = getRoute(routeIdx);

  const stopTimes = gtfs.stopTimesByTrip[tripIdx];
  const originStop = stopTimes ? gtfs.stops[stopTimes[0][0]]?.[0] ?? '' : '';
  const terminalStop = stopTimes
    ? gtfs.stops[stopTimes[stopTimes.length - 1][0]]?.[0] ?? ''
    : '';

  return {
    tripIdx,
    stopIdx,
    dep,
    depMinutes: timeToMinutes(dep),
    route,
    headsign,
    tripShortName,
    originStop,
    terminalStop,
  };
}

/**
 * Get upcoming departures at a stop for a given day.
 * Returns departures sorted by departure time, split into today and tomorrow.
 */
export function getUpcomingDepartures(
  stopIdx: number,
  now: Date,
  limit = 20,
  directionId?: number,
  region?: string | null
): { today: Departure[]; tomorrow: Departure[] } {
  const todayNum = dateToYYYYMMDD(now);
  const todayJSDay = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowNum = dateToYYYYMMDD(tomorrow);
  const tomorrowJSDay = tomorrow.getDay();

  const stopTimes = gtfs.stopTimesByStop[stopIdx] ?? [];

  const todayDeps: Departure[] = [];
  const tomorrowDeps: Departure[] = [];

  for (const [tripIdx, , dep] of stopTimes) {
    const trip = gtfs.trips[tripIdx];
    if (!trip) continue;
    if (directionId !== undefined && trip[2] !== directionId) continue;
    const serviceIdx = trip[1];
    if (region != null && (gtfs.calendar[serviceIdx]?.region ?? null) !== region) continue;

    const depMins = timeToMinutes(dep);

    if (isServiceActive(serviceIdx, todayNum, todayJSDay)) {
      if (depMins >= nowMins) {
        const d = buildDeparture(tripIdx, stopIdx, dep);
        if (d) todayDeps.push(d);
      }
    }

    if (isServiceActive(serviceIdx, tomorrowNum, tomorrowJSDay)) {
      const d = buildDeparture(tripIdx, stopIdx, dep);
      if (d) tomorrowDeps.push(d);
    }
  }

  todayDeps.sort((a, b) => a.depMinutes - b.depMinutes);
  tomorrowDeps.sort((a, b) => a.depMinutes - b.depMinutes);

  return {
    today: todayDeps,
    tomorrow: tomorrowDeps.slice(0, limit),
  };
}

// ---------------------------------------------------------------------------
// Line timetable at a stop
// ---------------------------------------------------------------------------

/** Get timetable grid for a specific route at a specific stop */
export function getLineTimetableAtStop(
  stopIdx: number,
  routeIdx: number,
  dayType: DayType,
  directionId?: 0 | 1,
  date?: Date
): TimetableEntry[] {
  const stopTimes = gtfs.stopTimesByStop[stopIdx] ?? [];
  const minutesByHour: Record<number, number[]> = {};
  const todayNum = date ? dateToYYYYMMDD(date) : null;

  for (const [tripIdx, , dep] of stopTimes) {
    const trip = gtfs.trips[tripIdx];
    if (!trip) continue;
    const [tRouteIdx, serviceIdx, tDirectionId] = trip;
    if (tRouteIdx !== routeIdx) continue;
    if (directionId !== undefined && tDirectionId !== directionId) continue;

    if (!isServiceOfDayType(serviceIdx, dayType)) continue;

    if (todayNum !== null) {
      const svc = gtfs.calendar[serviceIdx];
      if (svc && (todayNum < svc.start || todayNum > svc.end)) continue;
    }

    const depMins = timeToMinutes(dep);
    const h = Math.floor(depMins / 60) % 24;
    const m = depMins % 60;
    if (!minutesByHour[h]) minutesByHour[h] = [];
    minutesByHour[h].push(m);
  }

  return Object.keys(minutesByHour)
    .map(Number)
    .sort((a, b) => a - b)
    .map(hour => ({
      hour,
      minutes: [...new Set(minutesByHour[hour])].sort((a, b) => a - b),
    }));
}

function isServiceOfDayType(serviceIdx: number, dayType: DayType): boolean {
  const svc = gtfs.calendar[serviceIdx];
  if (!svc) return false;
  if (dayType === 'weekday') {
    // Has any Mon–Fri service
    return (svc.days & 0b0011111) !== 0;
  } else if (dayType === 'saturday') {
    return (svc.days & 32) !== 0;
  } else {
    return (svc.days & 64) !== 0;
  }
}

// ---------------------------------------------------------------------------
// Stop list for a line
// ---------------------------------------------------------------------------

/** Get ordered list of stops for a route and GTFS direction_id. */
export function getStopsForRoute(
  routeIdx: number,
  directionId: 0 | 1 = 0
): Stop[] {
  // Find a canonical trip for this route+direction.
  // direction_id is not a stable compass direction across feed versions.
  const tripIdx = gtfs.trips.findIndex(
    t => t[0] === routeIdx && t[2] === directionId
  );
  if (tripIdx === -1) return [];

  const stopTimes = gtfs.stopTimesByTrip[tripIdx] ?? [];
  return stopTimes.map(([sIdx]) => getStop(sIdx));
}

export function getDirectionEndpoints(
  routeIdx: number,
  directionId: 0 | 1
): { origin: string; terminal: string } | null {
  const stops = getStopsForRoute(routeIdx, directionId);
  if (stops.length === 0) return null;
  return { origin: stops[0].name, terminal: stops[stops.length - 1].name };
}

/** direction_id whose canonical trip runs origin → terminal, if either does. */
export function findDirectionByEndpoints(
  routeIdx: number,
  origin: string,
  terminal: string
): 0 | 1 | undefined {
  for (const directionId of [0, 1] as const) {
    const ends = getDirectionEndpoints(routeIdx, directionId);
    if (ends && ends.origin === origin && ends.terminal === terminal) return directionId;
  }
  return undefined;
}

function normalizePlace(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * direction_id that best matches the route long name's place order
 * ("Tallinn - Tartu" → Tallinn → Tartu). Falls back to 0.
 * Elron does not keep direction_id 0 aligned with that order, and may swap it between feeds.
 */
export function preferredDirection(routeIdx: number, longName: string): 0 | 1 {
  const name = normalizePlace(longName);
  const score = (directionId: 0 | 1): number => {
    const ends = getDirectionEndpoints(routeIdx, directionId);
    if (!ends) return -100;
    const origin = normalizePlace(ends.origin);
    const terminal = normalizePlace(ends.terminal);
    const originPos = origin ? name.indexOf(origin) : -1;
    const terminalPos = terminal ? name.indexOf(terminal) : -1;
    let value = 0;
    if (originPos >= 0) value += 2;
    if (terminalPos >= 0) value += 2;
    if (originPos >= 0 && terminalPos >= 0 && originPos < terminalPos) value += 5;
    if (originPos >= 0 && terminalPos >= 0 && originPos > terminalPos) value -= 3;
    if (originPos === 0) value += 2;
    return value;
  };
  return score(1) > score(0) ? 1 : 0;
}

/**
 * Recover the direction a favourite should open after route indices or direction_id values change.
 * Saved origin → terminal wins. Older favourites that only stored the long name use place order.
 */
export function resolveRouteDirection(
  routeIdx: number,
  hint: { longName?: string; originStop?: string; terminalStop?: string }
): { directionId: 0 | 1; originStop: string; terminalStop: string } {
  const byEndpoints =
    hint.originStop && hint.terminalStop
      ? findDirectionByEndpoints(routeIdx, hint.originStop, hint.terminalStop)
      : undefined;
  const directionId = byEndpoints ?? preferredDirection(routeIdx, hint.longName ?? '');
  const ends = getDirectionEndpoints(routeIdx, directionId);
  return {
    directionId,
    originStop: ends?.origin ?? hint.originStop ?? '',
    terminalStop: ends?.terminal ?? hint.terminalStop ?? '',
  };
}

/** The direction that actually calls at this stop record, when only one of them does. */
export function directionServingStop(routeIdx: number, stopIdx: number): 0 | 1 | undefined {
  const on0 = getStopsForRoute(routeIdx, 0).some(s => s.idx === stopIdx);
  const on1 = getStopsForRoute(routeIdx, 1).some(s => s.idx === stopIdx);
  if (on0 && !on1) return 0;
  if (on1 && !on0) return 1;
  return undefined;
}

// ---------------------------------------------------------------------------
// Routes served at a stop
// ---------------------------------------------------------------------------

export function getRoutesAtStop(stopIdx: number, region?: string | null): Route[] {
  const stopTimes = gtfs.stopTimesByStop[stopIdx] ?? [];
  const routeIdxSet = new Set<number>();
  for (const [tripIdx] of stopTimes) {
    const trip = gtfs.trips[tripIdx];
    if (!trip) continue;
    if (region != null && (gtfs.calendar[trip[1]]?.region ?? null) !== region) continue;
    routeIdxSet.add(trip[0]);
  }
  return Array.from(routeIdxSet).map(getRoute);
}

/** Returns unique (route, directionId) pairs for trips that actually stop here. */
export function getRouteDirectionsAtStop(stopIdx: number): { route: Route; directionId: number }[] {
  const stopTimes = gtfs.stopTimesByStop[stopIdx] ?? [];
  const seen = new Set<string>();
  const result: { route: Route; directionId: number }[] = [];
  for (const [tripIdx] of stopTimes) {
    const trip = gtfs.trips[tripIdx];
    if (!trip) continue;
    const [routeIdx, , directionId] = trip;
    const key = `${routeIdx}-${directionId}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ route: getRoute(routeIdx), directionId });
    }
  }
  return result;
}

/**
 * Same as getRouteDirectionsAtStop, but grouped by Elron region (Ida / Lääne / Edel).
 * Region comes from the service_id prefix (stored on the calendar entry).
 * A (route, directionId) pair whose trips span multiple regions gets one entry per region.
 */
export function getRouteDirectionsAtStopGrouped(
  stopIdx: number
): { region: string | null; items: { route: Route; directionId: number }[] }[] {
  const stopTimes = gtfs.stopTimesByStop[stopIdx] ?? [];
  const byRegion = new Map<string, { route: Route; directionId: number }[]>();
  const seen = new Set<string>();

  for (const [tripIdx] of stopTimes) {
    const trip = gtfs.trips[tripIdx];
    if (!trip) continue;
    const [routeIdx, serviceIdx, directionId] = trip;
    const region = gtfs.calendar[serviceIdx]?.region ?? null;
    const key = `${region ?? ''}|${routeIdx}-${directionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bucket = region ?? '';
    if (!byRegion.has(bucket)) byRegion.set(bucket, []);
    byRegion.get(bucket)!.push({ route: getRoute(routeIdx), directionId });
  }

  const order = ['Ida-Lõuna', 'Lääne', 'Edel'];
  const groups: { region: string | null; items: { route: Route; directionId: number }[] }[] = [];
  for (const r of order) {
    const items = byRegion.get(r);
    if (items && items.length) groups.push({ region: r, items });
  }
  const other = byRegion.get('');
  if (other && other.length) groups.push({ region: null, items: other });
  return groups;
}

// ---------------------------------------------------------------------------
// All stops with times for a specific trip
// ---------------------------------------------------------------------------

export function getStopsWithTimesForTrip(tripIdx: number): { stop: Stop; dep: string }[] {
  const stopTimes = gtfs.stopTimesByTrip[tripIdx] ?? [];
  return stopTimes.map(([sIdx, , dep]) => ({ stop: getStop(sIdx), dep }));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function searchStops(query: string, limit = 10): Stop[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return gtfs.stops
    .map(([name, lat, lon], idx) => ({ idx, name, lat, lon }))
    .filter(s => s.name.toLowerCase().includes(q))
    .slice(0, limit);
}

export function searchRoutes(query: string, limit = 10): Route[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return gtfs.routes
    .map(([shortName, longName, color], idx) => ({ idx, shortName, longName, color }))
    .filter(
      r =>
        r.shortName.toLowerCase().includes(q) ||
        r.longName.toLowerCase().includes(q)
    )
    .slice(0, limit);
}
