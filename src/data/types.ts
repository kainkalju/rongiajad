// ---- GTFS compact JSON schema ----
// stops[i]          = [name, lat, lon]
// routes[i]         = [shortName, longName, color]
// trips[i]          = [routeIdx, serviceIdx, directionId, headsign, shortName]
// stopTimesByTrip   = { tripIdx: [[stopIdx, seq, dep]] }
// stopTimesByStop   = { stopIdx: [[tripIdx, seq, dep]] }
// calendar[i]       = { days (bitmask Mon=1…Sun=64), start YYYYMMDD, end YYYYMMDD }
// calendarDates     = { serviceIdx: { YYYYMMDD: exceptionType 1|2 } }

export type GtfsData = {
  stops: [string, number, number][];              // [name, lat, lon]
  routes: [string, string, string][];             // [shortName, longName, color]
  trips: [number, number, number, string, string][]; // [routeIdx, serviceIdx, dirIdx, headsign, shortName]
  stopTimesByTrip: Record<string, [number, number, string][]>; // tripIdx → [[stopIdx, seq, dep]]
  stopTimesByStop: Record<string, [number, number, string][]>; // stopIdx → [[tripIdx, seq, dep]]
  calendar: { days: number; start: number; end: number }[];
  calendarDates: Record<string, Record<string, number>>;
};

// ---- App-level types ----

export type Stop = {
  idx: number;
  name: string;
  lat: number;
  lon: number;
};

export type Route = {
  idx: number;
  shortName: string;
  longName: string;
  color: string;
};

export type Departure = {
  tripIdx: number;
  stopIdx: number;
  dep: string;           // "HH:MM:SS" (may be ≥24h)
  depMinutes: number;    // minutes-since-midnight
  route: Route;
  headsign: string;
  tripShortName: string;
  /** The last stop name of this trip */
  terminalStop: string;
  /** The first stop name of this trip */
  originStop: string;
};

export type TimetableEntry = {
  hour: number;
  minutes: number[];
};

export type DayType = 'weekday' | 'saturday' | 'sunday';
