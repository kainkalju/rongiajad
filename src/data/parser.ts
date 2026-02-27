import gtfsRaw from './gtfs.json';
import type { GtfsData, Stop, Route, Departure, TimetableEntry, DayType } from './types';

const gtfs = gtfsRaw as unknown as GtfsData;

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
  limit = 20
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
    const serviceIdx = trip[1];

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
    today: todayDeps.slice(0, limit),
    tomorrow: tomorrowDeps.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Line timetable at a stop
// ---------------------------------------------------------------------------

/** Get timetable grid for a specific route at a specific stop */
export function getLineTimetableAtStop(
  stopIdx: number,
  routeIdx: number,
  dayType: DayType
): TimetableEntry[] {
  const stopTimes = gtfs.stopTimesByStop[stopIdx] ?? [];
  const minutesByHour: Record<number, number[]> = {};

  for (const [tripIdx, , dep] of stopTimes) {
    const trip = gtfs.trips[tripIdx];
    if (!trip) continue;
    const [tRouteIdx, serviceIdx] = trip;
    if (tRouteIdx !== routeIdx) continue;

    if (!isServiceOfDayType(serviceIdx, dayType)) continue;

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
      minutes: minutesByHour[hour].sort((a, b) => a - b),
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

/** Get ordered list of stops for a route (direction 0 = outbound) */
export function getStopsForRoute(
  routeIdx: number,
  directionId: 0 | 1 = 0
): Stop[] {
  // Find a canonical trip for this route+direction
  const tripIdx = gtfs.trips.findIndex(
    t => t[0] === routeIdx && t[2] === directionId
  );
  if (tripIdx === -1) return [];

  const stopTimes = gtfs.stopTimesByTrip[tripIdx] ?? [];
  return stopTimes.map(([sIdx]) => getStop(sIdx));
}

// ---------------------------------------------------------------------------
// Routes served at a stop
// ---------------------------------------------------------------------------

export function getRoutesAtStop(stopIdx: number): Route[] {
  const stopTimes = gtfs.stopTimesByStop[stopIdx] ?? [];
  const routeIdxSet = new Set<number>();
  for (const [tripIdx] of stopTimes) {
    const trip = gtfs.trips[tripIdx];
    if (trip) routeIdxSet.add(trip[0]);
  }
  return Array.from(routeIdxSet).map(getRoute);
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
