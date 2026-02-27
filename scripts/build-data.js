#!/usr/bin/env node
/**
 * Preprocesses Elron GTFS static feed files into a single compact JSON bundle
 * for fast offline lookups in the React Native app.
 *
 * All long string IDs (trip_id, route_id, service_id) are remapped to short
 * integer indices to keep the output small.
 *
 * Output: src/data/gtfs.json
 * Usage:  node scripts/build-data.js
 */

const fs = require('fs');
const path = require('path');

const ELRON_DIR = path.join(__dirname, '../elron');
const OUT_FILE = path.join(__dirname, '../src/data/gtfs.json');

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields (including commas inside quotes)
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length === 0) return [];
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCSVLine(line);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const fields = [];
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

function readCSV(filename) {
  return parseCSV(fs.readFileSync(path.join(ELRON_DIR, filename), 'utf-8'));
}

// ---------------------------------------------------------------------------
// Load raw GTFS
// ---------------------------------------------------------------------------
console.log('Loading GTFS files...');
const rawRoutes = readCSV('routes.txt');
const rawTrips = readCSV('trips.txt');
const rawStopTimes = readCSV('stop_times.txt');
const rawStops = readCSV('stops.txt');
const rawCalendar = readCSV('calendar.txt');
const rawCalendarDates = readCSV('calendar_dates.txt');

console.log(`  routes: ${rawRoutes.length}, trips: ${rawTrips.length}, stop_times: ${rawStopTimes.length}, stops: ${rawStops.length}`);

// ---------------------------------------------------------------------------
// Build ID lookup maps (string → compact integer index)
// ---------------------------------------------------------------------------
const routeIdMap = new Map();   // original route_id   → index
const tripIdMap = new Map();    // original trip_id    → index
const serviceIdMap = new Map(); // original service_id → index

rawRoutes.forEach((r, i) => routeIdMap.set(r.route_id, i));
rawTrips.forEach((t, i) => { tripIdMap.set(t.trip_id, i); serviceIdMap.set(t.service_id, serviceIdMap.size > 0 && serviceIdMap.has(t.service_id) ? serviceIdMap.get(t.service_id) : serviceIdMap.size); });
// Rebuild serviceIdMap properly
serviceIdMap.clear();
rawCalendar.forEach((c, i) => serviceIdMap.set(c.service_id, i));

// ---------------------------------------------------------------------------
// Filter to train stops only
// ---------------------------------------------------------------------------
const usedStopIds = new Set(rawStopTimes.map(st => st.stop_id));
console.log(`Train stops used in stop_times: ${usedStopIds.size}`);

const stopIdMap = new Map(); // original stop_id → compact index
const stops = [];
for (const s of rawStops) {
  if (!usedStopIds.has(s.stop_id)) continue;
  const idx = stops.length;
  stopIdMap.set(s.stop_id, idx);
  stops.push([s.stop_name, parseFloat(s.stop_lat), parseFloat(s.stop_lon)]);
  // [name, lat, lon]
}
console.log(`Filtered stops: ${stops.length}`);

// ---------------------------------------------------------------------------
// Routes: [shortName, longName, color]
// ---------------------------------------------------------------------------
const routes = rawRoutes.map(r => [
  r.route_short_name,
  r.route_long_name,
  r.route_color || 'ff711d',
]);

// ---------------------------------------------------------------------------
// Calendar: array indexed by serviceIdMap
// Bit-packed weekdays: Mon=bit0, Tue=bit1, ..., Sun=bit6
// ---------------------------------------------------------------------------
const calendar = rawCalendar.map(c => ({
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
const calendarDates = {};
for (const row of rawCalendarDates) {
  const sIdx = serviceIdMap.get(row.service_id);
  if (sIdx === undefined) continue;
  if (!calendarDates[sIdx]) calendarDates[sIdx] = {};
  calendarDates[sIdx][row.date] = parseInt(row.exception_type);
}

// ---------------------------------------------------------------------------
// Trips: [routeIdx, serviceIdx, directionId, headsign, shortName]
// ---------------------------------------------------------------------------
const trips = rawTrips.map(t => {
  const sIdx = serviceIdMap.get(t.service_id);
  return [
    routeIdMap.get(t.route_id) ?? -1,
    sIdx ?? -1,
    parseInt(t.direction_id),
    t.trip_headsign,
    t.trip_short_name,
  ];
});

// ---------------------------------------------------------------------------
// Stop times
// stopTimesByTrip: { tripIdx: [[stopIdx, seq, dep]] }  (arr omitted, same as dep for trains)
// stopTimesByStop: { stopIdx: [[tripIdx, seq, dep]] }
// ---------------------------------------------------------------------------
const stopTimesByTrip = {};
const stopTimesByStop = {};

for (const st of rawStopTimes) {
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
  stopTimesByTrip[k].sort((a, b) => a[1] - b[1]);
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const output = { stops, routes, trips, stopTimesByTrip, stopTimesByStop, calendar, calendarDates };
fs.writeFileSync(OUT_FILE, JSON.stringify(output));
const sizeKB = Math.round(fs.statSync(OUT_FILE).size / 1024);
console.log(`\nWrote ${OUT_FILE} (${sizeKB} KB)`);
console.log('Done!');
