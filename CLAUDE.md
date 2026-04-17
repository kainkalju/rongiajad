# Project "rongiajad"

Mobile application - Elron train schedule based on user location

## Architecture

**Framework:** React Native with Expo (cross-platform, iOS + Android)

**Key principles:**
- Offline-first: all schedule data is bundled with the app; optional runtime update downloads fresh data
- GPS-based nearest stop detection using device location services
- Language: Estonian (UI strings in Estonian)

**Project structure:**
```
rongiajad/
  elron/               # Bundled GTFS source files (routes, stops, trips, calendar…)
  scripts/
    build-data.js      # CLI: GTFS CSV → src/data/gtfs.json  (run: npm run build-data)
  src/
    navigation/
      index.tsx        # Stack navigator setup (screen order, animations)
      types.ts         # RootStackParamList — all screen param types
    screens/
      HomeScreen.tsx        # Nearest stops + departures + favourites
      SearchScreen.tsx      # Modal search (stops & routes)
      StopScreen.tsx        # Single stop: Praegu tab + Liinid tab
      LineScreen.tsx        # Route detail: stop timeline + timetable grid
      SelectedLineScreen.tsx# Single trip: all stops with times
      AboutScreen.tsx       # App info + GTFS update UI
    components/
      DepartureRow.tsx  # Departure list item (time, route, countdown)
      RouteChip.tsx     # Orange pill badge (origin → terminal)
      SearchBar.tsx     # Orange search input with clear button
      StopTimeline.tsx  # Vertical dashed stop list (LineScreen)
      TimetableGrid.tsx # Hour × minutes grid (LineScreen)
    data/
      types.ts          # GtfsData, Stop, Route, Departure, TimetableEntry, DayType
      parser.ts         # All query functions + time helpers (primary data interface)
      gtfs.json         # Pre-built data bundle (~1 MB, bundled at build time)
      gtfsLoader.ts     # App startup: load saved gtfs.json from device storage
      gtfsUpdater.ts    # Runtime update pipeline: download → unzip → process → save
      buildGtfs.ts      # In-memory CSV parser (used by updater, mirrors build-data.js)
    store/
      index.ts          # Zustand store: location, favStops, favRoutes
```

**Navigation:** Native stack (React Navigation), no header chrome (custom headers in each screen)
- `Home` — tabs: **Lemmikud** (Favourites) / **Graafik** (Schedule)
- `Search` — modal, slide from bottom
- `Stop` — tabs: **Praegu** (Now) / **Liinid** (Lines)
- `Line` — views: stop timeline / timetable grid; day tabs + direction toggle
- `SelectedLine` — full stop sequence for one trip; selected stop highlighted; tap stop → `Stop`
- `About` — app info, data source credit, runtime GTFS update button

**State management:** Zustand for favourites and current location. `favStops` and `favRoutes` are persisted via `zustand/middleware persist` + `@react-native-async-storage/async-storage` (v2.2.0, pinned for Expo compatibility). Location state is intentionally not persisted.

**Location:** `expo-location` for GPS; nearest stop found by haversine distance against all stops.

**Runtime GTFS update pipeline** (`src/data/`):
- `buildGtfs.ts` — in-memory CSV parser; filters to Elron (`agency_id = '10520953'`) then builds the same compact `GtfsData` structure as the build-time script
- `gtfsLoader.ts` — called at app startup; reads `gtfs.json` from device document directory (if present) and calls `initGtfs()` to hot-swap bundled data
- `gtfsUpdater.ts` — full update pipeline: HEAD check (`checkGtfsUpdateAvailable`), download → unzip (JSZip) → process → save; progress callbacks drive the About screen UI
- `parser.ts` — `gtfs` ref is mutable; `initGtfs(data)` replaces it at runtime; all query functions automatically see the new data
- Download source: `https://eu-gtfs.remix.com/elron.zip`
- Update timestamp stored in `AsyncStorage` under key `gtfs_updated_at` (ISO string)

---

## File Navigation Guide

Quick-reference for locating code when making fixes or changes.

### Screens

| What to change | File |
|---|---|
| Home screen layout, GPS stop picker, refresh logic | `src/screens/HomeScreen.tsx` |
| Favourite stops/routes list on home | `src/screens/HomeScreen.tsx` — `LemmikudTab` component |
| Search results (stops section, routes section) | `src/screens/SearchScreen.tsx` |
| Stop departure list ("Praegu" tab) | `src/screens/StopScreen.tsx` — `DeparturesList` component |
| Routes at a stop ("Liinid" tab) | `src/screens/StopScreen.tsx` — `LinesList` component |
| Route stop timeline (vertical list) | `src/screens/LineScreen.tsx` + `src/components/StopTimeline.tsx` |
| Route timetable grid (hours × minutes) | `src/screens/LineScreen.tsx` + `src/components/TimetableGrid.tsx` |
| Day tabs (Tööpäev / Laupäev / Pühapäev) | `src/screens/LineScreen.tsx` |
| Direction toggle (⇄) | `src/screens/LineScreen.tsx` |
| Single trip stop list with times | `src/screens/SelectedLineScreen.tsx` |
| About / app info | `src/screens/AboutScreen.tsx` |
| GTFS update UI (button, progress, error) | `src/screens/AboutScreen.tsx` |
| Screen transitions / modal animation | `src/navigation/index.tsx` |
| Navigation param types | `src/navigation/types.ts` |

### Components

| Component | File | Used in |
|---|---|---|
| Departure row (time + route + countdown) | `src/components/DepartureRow.tsx` | HomeScreen, StopScreen |
| Orange route badge pill | `src/components/RouteChip.tsx` | SearchScreen |
| Search input with clear button | `src/components/SearchBar.tsx` | SearchScreen |
| Vertical stop timeline | `src/components/StopTimeline.tsx` | LineScreen |
| Hour × minutes timetable grid | `src/components/TimetableGrid.tsx` | LineScreen |

### Data & queries

| What to change | File | Key function |
|---|---|---|
| Nearest stop from GPS | `src/data/parser.ts` | `getNearestStops(lat, lon, limit?)` |
| Today's / tomorrow's departures at a stop | `src/data/parser.ts` | `getUpcomingDepartures(stopIdx, now, limit?, directionId?)` |
| Timetable grid data by day type | `src/data/parser.ts` | `getLineTimetableAtStop(stopIdx, routeIdx, dayType, directionId?)` |
| All stops for a route (ordered) | `src/data/parser.ts` | `getStopsForRoute(routeIdx, directionId?)` |
| All stops + times for one trip | `src/data/parser.ts` | `getStopsWithTimesForTrip(tripIdx)` |
| Routes serving a stop | `src/data/parser.ts` | `getRoutesAtStop(stopIdx)` |
| Route directions at a stop | `src/data/parser.ts` | `getRouteDirectionsAtStop(stopIdx)` |
| Search stops by name | `src/data/parser.ts` | `searchStops(query, limit?)` |
| Search routes by name | `src/data/parser.ts` | `searchRoutes(query, limit?)` |
| Time string → minutes | `src/data/parser.ts` | `timeToMinutes(t)` (handles ≥24:00) |
| Minutes → "HH:MM" | `src/data/parser.ts` | `minutesToHHMM(mins)` |
| Hot-swap GTFS data | `src/data/parser.ts` | `initGtfs(data)` |
| Load persisted GTFS on startup | `src/data/gtfsLoader.ts` | `loadSavedGtfs()` |
| Download + install fresh GTFS | `src/data/gtfsUpdater.ts` | `updateGtfsData(onStep, onInfo)` |
| Check if update is available | `src/data/gtfsUpdater.ts` | `checkGtfsUpdateAvailable(localIso)` |
| Rebuild gtfs.json from source files | `scripts/build-data.js` | `npm run build-data` |

### Store

| What to change | File | Relevant fields |
|---|---|---|
| Favourite stops (add / remove / check) | `src/store/index.ts` | `favStops`, `addFavStop`, `removeFavStop`, `isFavStop` |
| Favourite routes (add / remove / check) | `src/store/index.ts` | `favRoutes`, `addFavRoute`, `removeFavRoute`, `isFavRoute` |
| Current GPS location | `src/store/index.ts` | `location`, `setLocation` |

### Navigation params

| Screen | Params |
|---|---|
| `Home` | `undefined` |
| `Search` | `undefined` |
| `Stop` | `{ stopIdx: number; directionId?: number }` |
| `Line` | `{ routeIdx: number; stopIdx?: number }` |
| `SelectedLine` | `{ tripIdx: number; stopIdx: number }` |
| `About` | `undefined` |

### Types (`src/data/types.ts`)

```typescript
GtfsData   — compact integer-indexed store; all query functions read from this
Stop       — { idx, name, lat, lon }
Route      — { idx, shortName, longName, color }
Departure  — { tripIdx, stopIdx, dep, depMinutes, route, headsign, tripShortName, originStop, terminalStop }
TimetableEntry — { hour: number; minutes: number[] }
DayType    — 'weekday' | 'saturday' | 'sunday'
```

---

## Data

Source: GTFS (General Transit Feed Specification) static feed from Elron, stored offline in `elron/`

**Files and their roles:**

| File | Description |
|------|-------------|
| `agency.txt` | Operator: ELRON (id 10520953), timezone Europe/Tallinn |
| `routes.txt` | Train lines (R12, RE14, E34, etc.) with short/long names and brand colour `#ff711d` |
| `stops.txt` | All stops with `stop_id`, `stop_name`, `stop_lat`, `stop_lon` |
| `trips.txt` | Individual train runs — links `route_id` + `service_id` + `direction_id` |
| `stop_times.txt` | Arrival/departure time at each stop for every trip |
| `calendar.txt` | Service patterns: weekday / Saturday / Sunday validity ranges |
| `calendar_dates.txt` | Public holiday exceptions to the regular calendar |
| `shapes.txt` | Route polyline geometry for map display |
| `feed_info.txt` | Feed version/validity metadata |

**Compact data schema (gtfs.json):**
- `stops[idx]` = `[name, lat, lon]`
- `routes[idx]` = `[shortName, longName, color]`
- `trips[idx]` = `[routeIdx, serviceIdx, directionId, headsign, shortName]`
- `calendar[serviceIdx]` = `{ days (bitmask Mon=bit0…Sun=bit6), start, end }`
- `calendarDates[serviceIdx][YYYYMMDD]` = exception type 1 (add) | 2 (remove)
- `stopTimesByTrip[tripIdx]` = `[[stopIdx, seq, dep], ...]`
- `stopTimesByStop[stopIdx]` = `[[tripIdx, seq, dep], ...]`

**Key query patterns:**

1. **Nearest stop** — haversine distance from GPS coords to every stop
2. **Upcoming departures at a stop** — join `stopTimesByStop` → `trips` → `calendar` filtered by today's service and current time; optional `directionId` param filters to one direction; `today` is unbounded, `tomorrow` capped at `limit`
3. **Line timetable at a stop** — group departures by hour; separate tabs for Tööpäev / Laupäev / Pühapäev
4. **Stop list for a line** — ordered entries from `stopTimesByTrip` for one canonical trip per direction
5. **Search** — substring match on `stop_name` and `route_short_name` / `route_long_name`
6. **Trip stop sequence** — all stops with departure times for a single `trip_id` (`getStopsWithTimesForTrip`)

**Time handling:** `stop_times` uses `HH:MM:SS` including values ≥ 24:00 for overnight trips. Parse as minutes-since-midnight for arithmetic. Timezone is always `Europe/Tallinn`.

---

## UI Design

Brand colour: `#ff711d` (Elron orange). White text on orange surfaces.

**Screenshots (reference designs):**

| File | Screen | Description |
|------|--------|-------------|
| `frontpage-unknown-location.webp` | Home — no GPS | Orange header with search bar ("Otsi peatusi ja liine"). Tabs: **Lemmikud** (Favourites), **Graafik** (Schedule). Empty state shows dashed-border card "+ Lisa enda lemmikpeatus ja liin". |
| `frontpage-based-on-gps-location.webp` | Home — GPS active | Graafik tab: nearest station name + pagination dots for multiple stations. Departure rows show time (`15:16`), route label (`Tartu → Tallinn (ekspress)`), and countdown (`35 min`) right-aligned. Section header "Homsed väljumised" separates tomorrow's trains. |
| `search-destination.webp` | Search | Full-screen overlay, back arrow + text input + clear (×). Results in two sections: **Peatused** (Stops) — stop name bold, matching routes shown as small orange pill chips. **Liinid** (Lines) — line entries below. |
| `selected-train-stop-departures.webp` | Stop detail | Orange header: back arrow, stop name, favourite star (☆). Sub-tabs **Praegu** (Now) / **Liinid** (Lines). Departure rows same layout as home. Tomorrow section header below current departures. |
| `selected-line-list-of-stops.webp` | Line — stop list | Header: back, line name ("Tallinn – Tartu (ekspress)"). Vertical dashed timeline on left; stop names listed in sequence. |
| `selected-line-departure-times.webp` | Line — timetable | Header: back, route name, stop name subtitle, favourite star. Day-type tabs: **Tööpäev** / **Laupäev** / **Pühapäev**. Two-column grid: bold hour on left, minutes on right. Current hour highlighted in orange. |
| `att.GDRL1u2Un3CevuZo7HBC3_JJoPlXf5cmie3lmQnxS2A.png.JPEG` | Selected line — trip stops | Orange header: back arrow, title `{shortName} - {originStop} - {terminalStop}`, favourite star. Flat list: departure time left, stop name right. Selected stop highlighted in orange. Tapping a stop → StopScreen with same direction. |
| *(About screen)* | About / Teave | Grey background, orange header. Info rows: version, co-author, disclaimer, data source. Bottom: update check spinner → "Sõiduplaanid on ajakohased" (green) or "Uuenda sõiduplaane" button (orange). Progress labels cycle in Estonian during update. |

**Component patterns:**
- Departure row: `[train icon] [time]  [origin → terminal]  [countdown right]`
- Route chip: orange rounded pill, white text, `→` separator
- Timeline: vertical dashed line with grey dots at each stop
- Timetable grid: left column = hour (bold, orange if current), right column = space-separated minutes
- Tab bar inside screens: underline indicator on active tab, same orange header background

---

## Troubleshooting

### iOS build fails: `hermes-engine` script — Node not found

**Symptom:** `xcodebuild.log` contains a line like:
```
/opt/homebrew/Cellar/node@24/24.13.1/bin/node: No such file or directory
Command PhaseScriptExecution failed with a nonzero exit code
```

**Cause:** `ios/.xcode.env.local` pins a hardcoded Cellar path to a specific Node patch version. When Homebrew upgrades Node (e.g. `24.13.1` → `24.14.1`), that path no longer exists.

**Fix:** Update `ios/.xcode.env.local` to use the stable opt symlink instead:
```
export NODE_BINARY=/opt/homebrew/opt/node@24/bin/node
```
This symlink always points to the currently installed version and survives patch upgrades.

---

## Version bump checklist

When releasing a new version, update **all four** of these in lockstep:

| # | File | What to change |
|---|------|----------------|
| 1 | `package.json` | `"version"` field — source of truth (e.g. `"1.0.1"`) |
| 2 | `app.json` | `expo.version` — controls the version Expo/EAS uses for both platforms |
| 3 | `src/screens/AboutScreen.tsx` | Hardcoded string in the **"Rakenduse versioon"** row (`<Text style={styles.value}>x.x.x</Text>`) |
| 4 | `ios/Rongiajad.xcodeproj/project.pbxproj` | `MARKETING_VERSION` (two occurrences — Debug and Release configs) |

> `CURRENT_PROJECT_VERSION` in the pbxproj is the build number (integer); increment it alongside `MARKETING_VERSION` for App Store submissions.

> Android `versionCode` / `versionName` are derived from `app.json` by Expo — no separate file to edit.
