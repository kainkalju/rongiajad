# GTFS Data — How It Works

This document covers how the app imports, updates, and queries Elron train schedule data.

---

## Overview

The app uses a **compact, offline-first GTFS bundle** (`src/data/gtfs.json`). All string IDs from the original GTFS feed (route_id, trip_id, service_id, stop_id) are replaced with compact integer indices to keep the file small (~1 MB for 243 stops, 26 routes, 1570 trips).

There are two paths to get schedule data into the app:

1. **Build-time** — developer runs `npm run build-data`, which reads raw CSV files from `elron/` and writes `src/data/gtfs.json` (bundled into the app binary)
2. **Runtime update** — user triggers an update in the About screen; the app downloads a fresh GTFS ZIP, processes it in-memory, and hot-swaps it without restart

---

## Data Schema

All query functions read from a single in-memory `GtfsData` object:

```typescript
type GtfsData = {
  stops: [string, number, number][];              // [name, lat, lon]
  routes: [string, string, string][];             // [shortName, longName, color]
  trips: [number, number, number, string, string][]; // [routeIdx, serviceIdx, directionId, headsign, shortName]
  stopTimesByTrip: Record<string, [number, number, string][]>; // tripIdx → [[stopIdx, seq, "HH:MM:SS"]]
  stopTimesByStop: Record<string, [number, number, string][]>; // stopIdx → [[tripIdx, seq, "HH:MM:SS"]]
  calendar: { days: number; start: number; end: number; region?: string | null }[]; // days = bitmask Mon=1…Sun=64; region = 'Ida-Lõuna' | 'Lääne' | 'Edel' | null
  calendarDates: Record<string, Record<string, number>>;       // serviceIdx → {YYYYMMDD: 1|2}
};
```

**Calendar bitmask** — weekdays are packed into a single integer:

| Bit | Value | Day       |
|-----|-------|-----------|
| 0   | 1     | Monday    |
| 1   | 2     | Tuesday   |
| 2   | 4     | Wednesday |
| 3   | 8     | Thursday  |
| 4   | 16    | Friday    |
| 5   | 32    | Saturday  |
| 6   | 64    | Sunday    |

**Calendar dates exceptions:** `1` = service added on this date, `2` = service removed.

**Time format:** departure times are stored as `"HH:MM:SS"` strings. Values ≥ `"24:00:00"` are valid and represent overnight trains running past midnight.

---

## Build-Time Import (`scripts/build-data.js`)

Run with `npm run build-data`. Reads the six CSV files from `elron/` and writes `src/data/gtfs.json`.

**Pipeline steps:**

1. Parse all six CSV files (`routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt`, `calendar.txt`, `calendar_dates.txt`) with a custom CSV parser that handles quoted fields
2. Filter to only stops actually used in `stop_times.txt`
3. Build four ID maps: `routeIdMap`, `tripIdMap`, `serviceIdMap`, `stopIdMap` — each mapping the original string ID to a compact integer index
4. Build the compact arrays:
   - `stops[]` — `[name, lat, lon]` tuples
   - `routes[]` — `[shortName, longName, color]` tuples
   - `trips[]` — `[routeIdx, serviceIdx, directionId, headsign, shortName]` tuples
   - `calendar[]` — `{ days, start, end, region }` objects with bitmask weekdays, integer YYYYMMDD dates, and an Elron region label derived from the `service_id` prefix (`'Ida-Lõuna'`, `'Lääne'`, `'Edel'`, or `null`)
   - `calendarDates{}` — nested object keyed by serviceIdx then YYYYMMDD
5. Build two inverted index maps from `stop_times.txt`:
   - `stopTimesByTrip[tripIdx]` — all stop times for one trip, sorted by sequence
   - `stopTimesByStop[stopIdx]` — all trip departures at one stop
6. Write the result as JSON to `src/data/gtfs.json`

> The build script (`build-data.js`) and the runtime builder (`src/data/buildGtfs.ts`) implement the same algorithm. The difference is data source: one reads from disk, the other from in-memory strings extracted from a ZIP.

---

## Runtime Update Pipeline

### Check for updates (`gtfsUpdater.ts → checkGtfsUpdateAvailable`)

```typescript
const result = await checkGtfsUpdateAvailable(localIso); // 'available' | 'current' | 'failed'
```

Sends a `HEAD` request to `https://eu-gtfs.remix.com/elron.zip` and compares the `Last-Modified` response header against the locally stored `gtfs_updated_at` key in AsyncStorage. Returns `'available'` if the remote feed is newer, `'current'` if not, or `'failed'` if the request errored.

### Run an update (`gtfsUpdater.ts → updateGtfsData`)

```typescript
await updateGtfsData(
  (step) => console.log('Step:', step),   // 'downloading' | 'unzipping' | 'processing' | 'saving' | 'done'
  (info) => console.log('Info:', info),   // e.g. "Allalaaditud: 2048 KB"
);
```

**Pipeline steps:**

1. **downloading** — `File.downloadFileAsync` saves `gtfs_update.zip` to device document directory
2. **unzipping** — reads the ZIP as base64, passes to JSZip, extracts the six needed `.txt` files as strings
3. **processing** — calls `buildGtfsData(files)` from `buildGtfs.ts`; returns a `GtfsData` object
4. **saving** — writes `gtfs.json` to device document directory; stores current timestamp in AsyncStorage under key `gtfs_updated_at`
5. **done** — calls `initGtfs(data)` to hot-swap the in-memory reference; all query functions immediately see the new data. `AboutScreen` then calls `bumpGtfsVersion()` on the Zustand store, which triggers `HomeScreen` and `StopScreen` to re-fetch departures immediately via their `useEffect` deps.

The ZIP file is deleted on completion (or on error) to free disk space.

### App startup (`gtfsLoader.ts → loadSavedGtfs`)

Called once at app startup. Reads `gtfs.json` from device document directory (if it exists) and calls `initGtfs(data)`. If absent or unreadable, the bundled `gtfs.json` (compiled into the app binary) is used silently.

---

## Query Functions (`src/data/parser.ts`)

All functions read from the module-level `gtfs` variable, which is replaced atomically by `initGtfs(data)`.

### Time helpers

```typescript
timeToMinutes("06:32:00") // → 392
timeToMinutes("25:10:00") // → 1510  (overnight, > 24h)
minutesToHHMM(392)        // → "06:32"
```

### Service active check (internal)

`isServiceActive(serviceIdx, dateNum, jsDay)` — used internally by departure queries:

1. If `calendarDates[serviceIdx][dateNum]` exists: return `true` if exception type is 1, `false` if 2
2. Otherwise check `calendar[serviceIdx]`: verify `start ≤ dateNum ≤ end` and the weekday bitmask matches

### Nearest stops

```typescript
const stops = getNearestStops(59.437, 24.745, 3);
// Returns up to 3 stops sorted by haversine distance:
// [{ idx, name, lat, lon, distanceKm }, ...]
```

Iterates all stops, computes haversine distance in km, sorts ascending, slices to `limit`.

### Departures at a stop

```typescript
const { today, tomorrow } = getUpcomingDepartures(stopIdx, new Date(), 20, directionId?, region?);
```

- Iterates `stopTimesByStop[stopIdx]`
- For each entry checks `isServiceActive` for today and tomorrow
- Today: only departures where `depMinutes >= nowMins`
- Tomorrow: all departures, capped at `limit`
- Optionally filters by `directionId` (0 = outbound, 1 = inbound)
- Optionally filters by `region` (`'Ida-Lõuna'`, `'Lääne'`, `'Edel'`) via `calendar[serviceIdx].region`
- Both lists are sorted by `depMinutes` ascending
- Each `Departure` object includes `originStop` and `terminalStop` (first/last stop of the trip)

### Timetable grid for a route at a stop

```typescript
const entries = getLineTimetableAtStop(stopIdx, routeIdx, 'weekday', directionId?);
// Returns: [{ hour: 6, minutes: [12, 48] }, { hour: 7, minutes: [32] }, ...]
```

Groups all departures for this `routeIdx` at this `stopIdx` by hour. Day type filtering uses `isServiceOfDayType`:
- `'weekday'` — any Mon–Fri bits set (`days & 0b0011111 !== 0`)
- `'saturday'` — bit 5 set (`days & 32`)
- `'sunday'` — bit 6 set (`days & 64`)

Current hour is highlighted in orange in the UI (`TimetableGrid.tsx`).

### Stops for a route

```typescript
const stops = getStopsForRoute(routeIdx, 0); // direction 0 = outbound
// Returns: [{ idx, name, lat, lon }, ...]
```

Finds the first matching trip for `routeIdx + directionId`, then reads `stopTimesByTrip[tripIdx]` and maps each `[stopIdx, seq, dep]` to a `Stop` object.

### Routes at a stop

```typescript
const routes = getRoutesAtStop(stopIdx, region?);
// Returns: [{ idx, shortName, longName, color }, ...]
```

Collects unique `routeIdx` values from all entries in `stopTimesByStop[stopIdx]`. Optional `region` filter restricts to routes whose trips belong to that Elron corridor.

### Route directions at a stop

```typescript
const dirs = getRouteDirectionsAtStop(stopIdx);
// Returns: [{ route: Route, directionId: 0 | 1 }, ...]
```

Deduplicates by `routeIdx-directionId` key. Used to show direction tabs in `StopScreen`.

```typescript
const groups = getRouteDirectionsAtStopGrouped(stopIdx);
// Returns: [{ region: 'Ida-Lõuna' | 'Lääne' | 'Edel' | null, items: { route, directionId }[] }, ...]
```

Same data as `getRouteDirectionsAtStop`, but grouped by Elron region and ordered Ida-Lõuna → Lääne → Edel. Region is resolved via the `calendar[serviceIdx].region` field. Used by `SearchScreen` to render direction subheadings under each matching stop.

### All stops with times for a trip

```typescript
const stops = getStopsWithTimesForTrip(tripIdx);
// Returns: [{ stop: Stop, dep: "HH:MM:SS" }, ...]
```

Reads `stopTimesByTrip[tripIdx]` (already sorted by sequence) and maps each entry to `{ stop, dep }`. Used by `SelectedLineScreen` to render the full trip stop list.

### Search

```typescript
const stops = searchStops("tartu", 10);
// Returns: [{ idx, name, lat, lon }, ...] — substring match on stop name

const routes = searchRoutes("ekspress", 10);
// Returns: [{ idx, shortName, longName, color }, ...] — substring match on shortName or longName
```

Both functions lowercase the query and the field before comparing. Return empty array for blank queries.

---

## Examples

### Find nearest stops to a GPS coordinate

```typescript
import { getNearestStops } from '@/data/parser';

const nearest = getNearestStops(59.4370, 24.7454, 3);
// nearest[0] = { idx: 42, name: "Balti jaam", lat: 59.4401, lon: 24.7377, distanceKm: 0.38 }
```

### Get upcoming departures at a stop

```typescript
import { getUpcomingDepartures } from '@/data/parser';

const { today, tomorrow } = getUpcomingDepartures(42, new Date(), 20);
// today[0] = {
//   tripIdx: 107,
//   stopIdx: 42,
//   dep: "15:16:00",
//   depMinutes: 916,
//   route: { idx: 3, shortName: "R12", longName: "Tallinn–Tartu", color: "ff711d" },
//   headsign: "Tartu",
//   tripShortName: "1234",
//   originStop: "Balti jaam",
//   terminalStop: "Tartu",
// }
```

### Get weekday timetable for a route at a stop

```typescript
import { getLineTimetableAtStop } from '@/data/parser';

const timetable = getLineTimetableAtStop(42, 3, 'weekday');
// [
//   { hour: 6,  minutes: [12, 48] },
//   { hour: 7,  minutes: [32] },
//   { hour: 15, minutes: [16, 52] },
// ]
```

### Get all stops on a route (outbound)

```typescript
import { getStopsForRoute } from '@/data/parser';

const stops = getStopsForRoute(3, 0);
// [
//   { idx: 42, name: "Balti jaam", lat: 59.44, lon: 24.74 },
//   { idx: 18, name: "Ülemiste", lat: 59.42, lon: 24.77 },
//   ...
//   { idx: 91, name: "Tartu", lat: 58.37, lon: 26.73 },
// ]
```

### Get full stop sequence for a specific trip

```typescript
import { getStopsWithTimesForTrip } from '@/data/parser';

const stopTimes = getStopsWithTimesForTrip(107);
// [
//   { stop: { idx: 42, name: "Balti jaam", ... }, dep: "15:00:00" },
//   { stop: { idx: 18, name: "Ülemiste",   ... }, dep: "15:08:00" },
//   { stop: { idx: 91, name: "Tartu",       ... }, dep: "17:12:00" },
// ]
```

### Search for a stop or route

```typescript
import { searchStops, searchRoutes } from '@/data/parser';

searchStops("üle");
// [{ idx: 18, name: "Ülemiste", ... }, { idx: 55, name: "Ülejõe", ... }]

searchRoutes("ekspress");
// [{ idx: 1, shortName: "RE14", longName: "Tallinn–Tartu (ekspress)", color: "ff711d" }]
```

### Hot-swap GTFS data after an update

```typescript
import { updateGtfsData } from '@/data/gtfsUpdater';

await updateGtfsData(
  (step) => setStatusLabel(step),     // update UI
  (info) => setInfoLabel(info),
);
// After 'done': all parser functions automatically return data from the new feed
```

---

## Source CSV Files (`elron/`)

These files are the raw GTFS static feed from Elron, committed to the repo. They are **not shipped to the device** — only the pre-built `src/data/gtfs.json` is bundled into the app binary. The runtime updater downloads a fresh copy of these same files from `https://eu-gtfs.remix.com/elron.zip`.

Feed validity: **2026-01-26 – 2026-12-13** (as of the committed snapshot).  
Publisher: Regionaal- ja Põllumajandusministeerium.

### `agency.txt` — 1 data row

Defines the single operator.

| Column | Value |
|--------|-------|
| `agency_id` | `10520953` — used to filter Elron rows from feeds that include multiple operators |
| `agency_name` | `ELRON` |
| `agency_url` | `https://elron.ee/` |
| `agency_timezone` | `Europe/Tallinn` — all times in the feed are in this timezone |

### `routes.txt` — 26 routes

One row per train line. Only rows where `agency_id = '10520953'` are kept by the builder.

| Column | Used | Notes |
|--------|------|-------|
| `route_id` | yes | Long string ID; remapped to integer index |
| `agency_id` | filter | Must equal `10520953` |
| `route_short_name` | yes | E.g. `RE14`, `R34` — shown in the UI |
| `route_long_name` | yes | E.g. `Tallinn - Paldiski` — shown in search |
| `route_type` | no | Always `2` (rail) |
| `route_color` | yes | Hex without `#`, e.g. `ff711d` (Elron orange) |
| `route_text_color` | no | Always `FFFFFF` |
| `route_desc` | no | Holiday note, e.g. "Liin on riigipühadel käigus pühapäevase sõiduplaani järgi" |

### `trips.txt` — 1570 trips

One row per individual train run. Filtered to Elron route IDs.

| Column | Used | Notes |
|--------|------|-------|
| `trip_id` | yes | Long compound string; remapped to integer index |
| `route_id` | yes | Links to `routes.txt` |
| `service_id` | yes | Links to `calendar.txt` / `calendar_dates.txt` |
| `direction_id` | yes | `0` = outbound, `1` = inbound |
| `trip_headsign` | yes | Destination name shown on the train, e.g. `Tallinn` |
| `trip_short_name` | yes | Human-readable trip number, e.g. `Keila - Tallinn` |
| `shape_id` | no | Links to `shapes.txt` (route geometry, not used) |
| `wheelchair_accessible` | no | |
| `bikes_allowed` | no | |

### `stop_times.txt` — 25 503 rows

One row per stop per trip. Largest file in the feed.

| Column | Used | Notes |
|--------|------|-------|
| `trip_id` | yes | Links to `trips.txt` |
| `stop_id` | yes | Links to `stops.txt` |
| `stop_sequence` | yes | Integer ordering within the trip; entries are sorted by this after parsing |
| `departure_time` | yes | `HH:MM:SS`; values ≥ `24:00:00` are valid for overnight trips |
| `arrival_time` | no | Same as departure for trains in this feed |
| `timepoint` | no | |
| `shape_dist_traveled` | no | |
| `pickup_type` | no | |
| `drop_off_type` | no | |

> Note: `trip_id` values sometimes contain commas (e.g. `"Ida,_Lõuna_..."`), so the CSV parser must handle quoted fields correctly.

### `stops.txt` — 18 062 rows (full Estonian PT feed)

All stops across all Estonian public transport operators. The builder filters this down to only stops that appear in Elron's `stop_times.txt`, leaving ~243 train stops.

| Column | Used | Notes |
|--------|------|-------|
| `stop_id` | yes | String ID; remapped to integer index |
| `stop_name` | yes | Estonian place name, e.g. `Balti jaam` |
| `stop_lat` | yes | WGS84 latitude |
| `stop_lon` | yes | WGS84 longitude |
| `stop_code` | no | |
| `stop_desc` | no | |
| `wheelchair_boarding` | no | |
| `platform_code` | no | |
| `lest_x`, `lest_y` | no | Estonian national coordinate system (L-EST97) |

### `calendar.txt` — 21 service patterns

Defines which days of the week each service pattern runs and its validity range.

| Column | Used | Notes |
|--------|------|-------|
| `service_id` | yes | Links to `trips.txt`; remapped to integer index. Prefix (`Ida,_Lõuna_`, `Laane_`, `_Edel_`) is parsed into a `region` field on the calendar entry |
| `start_date` | yes | YYYYMMDD integer, e.g. `20260212` |
| `end_date` | yes | YYYYMMDD integer |
| `monday`–`sunday` | yes | `"1"` or `"0"`; packed into a bitmask (Mon=bit0…Sun=bit6) |

Example row — a Sunday-only service running Feb–Apr 2026:
```
service_id: "Ida,_Lõuna_12.02-4.04.2026-Su"
start_date: 20260212, end_date: 20260405
monday–saturday: 0, sunday: 1  →  days bitmask = 64
```

### `calendar_dates.txt` — 20 exception rows

Overrides for public holidays. A service can be added (exception type 1) or removed (exception type 2) on a specific date regardless of the regular weekday pattern.

| Column | Used | Notes |
|--------|------|-------|
| `service_id` | yes | Links to `calendar.txt` |
| `date` | yes | YYYYMMDD string, stored as key in `calendarDates[serviceIdx]` |
| `exception_type` | yes | `1` = run on this date, `2` = do not run |

Example: `exception_type = 2` on 2026-02-24 (Estonian Independence Day) removes a Tuesday service; `exception_type = 1` on the same date adds a Sunday service in its place.

### `shapes.txt` — 22 840 rows (not used)

Route polyline geometry for map rendering. Contains lat/lon points along each route's path. Currently unused — the app has no map view.

### `feed_info.txt` — 1 data row

Feed metadata; not read by the builder or app.

| Column | Value |
|--------|-------|
| `feed_publisher_name` | Regionaal- ja Põllumajandusministeerium |
| `feed_start_date` | `20260126` |
| `feed_end_date` | `20261213` |
| `feed_version` | `Updated: Feb 12, 2026, 3:47 AM` |

---

## File Map

| File | Role |
|------|------|
| `elron/*.txt` | Source GTFS CSV files (bundled in repo, not shipped to device) |
| `scripts/build-data.js` | Build-time: CSV → `src/data/gtfs.json` |
| `src/data/gtfs.json` | Compiled data bundle, bundled into the app binary |
| `src/data/types.ts` | TypeScript types for GtfsData and all app-level entities |
| `src/data/buildGtfs.ts` | Runtime CSV parser (same logic as build-data.js, used by updater) |
| `src/data/gtfsLoader.ts` | App startup: load saved gtfs.json from device storage |
| `src/data/gtfsUpdater.ts` | Download, unzip, process, save, and hot-swap fresh GTFS data |
| `src/data/parser.ts` | All query functions; holds the mutable `gtfs` reference |
