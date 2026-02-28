import type { GtfsData } from './types';

const ELRON_AGENCY_ID = '10520953';

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields (including commas inside quotes)
// ---------------------------------------------------------------------------
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length === 0) return [];
  const headers = splitCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Build GtfsData from in-memory file contents.
 * Filters to Elron (agency_id = '10520953') to work against the full Estonian PT feed.
 *
 * @param files — map of filename → file content string
 */
export function buildGtfsData(files: Record<string, string>): GtfsData {
  const rawRoutes = parseCSV(files['routes.txt'] ?? '');
  const rawTrips = parseCSV(files['trips.txt'] ?? '');
  const rawStopTimes = parseCSV(files['stop_times.txt'] ?? '');
  const rawStops = parseCSV(files['stops.txt'] ?? '');
  const rawCalendar = parseCSV(files['calendar.txt'] ?? '');
  const rawCalendarDates = parseCSV(files['calendar_dates.txt'] ?? '');

  // 1. Filter routes by Elron agency_id
  const elronRoutes = rawRoutes.filter(r => r.agency_id === ELRON_AGENCY_ID);
  const elronRouteIdSet = new Set(elronRoutes.map(r => r.route_id));

  // 2. Filter trips by elron route_ids → collect service_ids
  const elronTrips = rawTrips.filter(t => elronRouteIdSet.has(t.route_id));
  const elronTripIdSet = new Set(elronTrips.map(t => t.trip_id));
  const elronServiceIdSet = new Set(elronTrips.map(t => t.service_id));

  // 3. Filter stop_times by elron trip_ids
  const elronStopTimes = rawStopTimes.filter(st => elronTripIdSet.has(st.trip_id));

  // 4. Filter stops by stop_ids used in elron stop_times
  const usedStopIds = new Set(elronStopTimes.map(st => st.stop_id));
  const elronStops = rawStops.filter(s => usedStopIds.has(s.stop_id));

  // 5. Filter calendar / calendar_dates by elron service_ids
  const elronCalendar = rawCalendar.filter(c => elronServiceIdSet.has(c.service_id));
  const elronCalendarDates = rawCalendarDates.filter(cd => elronServiceIdSet.has(cd.service_id));

  // ---------------------------------------------------------------------------
  // Build ID maps (string → compact integer index)
  // ---------------------------------------------------------------------------
  const routeIdMap = new Map<string, number>();
  elronRoutes.forEach((r, i) => routeIdMap.set(r.route_id, i));

  const serviceIdMap = new Map<string, number>();
  elronCalendar.forEach((c, i) => serviceIdMap.set(c.service_id, i));

  const tripIdMap = new Map<string, number>();
  elronTrips.forEach((t, i) => tripIdMap.set(t.trip_id, i));

  const stopIdMap = new Map<string, number>();
  const stops: [string, number, number][] = [];
  for (const s of elronStops) {
    const idx = stops.length;
    stopIdMap.set(s.stop_id, idx);
    stops.push([s.stop_name, parseFloat(s.stop_lat), parseFloat(s.stop_lon)]);
  }

  // ---------------------------------------------------------------------------
  // Routes: [shortName, longName, color]
  // ---------------------------------------------------------------------------
  const routes: [string, string, string][] = elronRoutes.map(r => [
    r.route_short_name,
    r.route_long_name,
    r.route_color || 'ff711d',
  ]);

  // ---------------------------------------------------------------------------
  // Calendar: array indexed by serviceIdMap
  // Bit-packed weekdays: Mon=bit0, Tue=bit1, ..., Sun=bit6
  // ---------------------------------------------------------------------------
  const calendar = elronCalendar.map(c => ({
    days: (c.monday === '1' ? 1 : 0)
        | (c.tuesday === '1' ? 2 : 0)
        | (c.wednesday === '1' ? 4 : 0)
        | (c.thursday === '1' ? 8 : 0)
        | (c.friday === '1' ? 16 : 0)
        | (c.saturday === '1' ? 32 : 0)
        | (c.sunday === '1' ? 64 : 0),
    start: parseInt(c.start_date),
    end: parseInt(c.end_date),
  }));

  // ---------------------------------------------------------------------------
  // Calendar dates: { serviceIdx: { YYYYMMDD: exceptionType } }
  // ---------------------------------------------------------------------------
  const calendarDates: Record<number, Record<string, number>> = {};
  for (const row of elronCalendarDates) {
    const sIdx = serviceIdMap.get(row.service_id);
    if (sIdx === undefined) continue;
    if (!calendarDates[sIdx]) calendarDates[sIdx] = {};
    calendarDates[sIdx][row.date] = parseInt(row.exception_type);
  }

  // ---------------------------------------------------------------------------
  // Trips: [routeIdx, serviceIdx, directionId, headsign, shortName]
  // ---------------------------------------------------------------------------
  const trips: [number, number, number, string, string][] = elronTrips.map(t => [
    routeIdMap.get(t.route_id) ?? -1,
    serviceIdMap.get(t.service_id) ?? -1,
    parseInt(t.direction_id),
    t.trip_headsign,
    t.trip_short_name,
  ]);

  // ---------------------------------------------------------------------------
  // Stop times
  // ---------------------------------------------------------------------------
  const stopTimesByTrip: Record<number, [number, number, string][]> = {};
  const stopTimesByStop: Record<number, [number, number, string][]> = {};

  for (const st of elronStopTimes) {
    const tIdx = tripIdMap.get(st.trip_id);
    const sIdx = stopIdMap.get(st.stop_id);
    if (tIdx === undefined || sIdx === undefined) continue;

    const seq = parseInt(st.stop_sequence);
    const dep = st.departure_time;

    if (!stopTimesByTrip[tIdx]) stopTimesByTrip[tIdx] = [];
    stopTimesByTrip[tIdx].push([sIdx, seq, dep]);

    if (!stopTimesByStop[sIdx]) stopTimesByStop[sIdx] = [];
    stopTimesByStop[sIdx].push([tIdx, seq, dep]);
  }

  // Sort by sequence
  for (const k of Object.keys(stopTimesByTrip)) {
    stopTimesByTrip[Number(k)].sort((a, b) => a[1] - b[1]);
  }

  return { stops, routes, trips, stopTimesByTrip, stopTimesByStop, calendar, calendarDates } as unknown as GtfsData;
}
