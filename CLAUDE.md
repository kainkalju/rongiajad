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
  elron/          # Bundled GTFS data files (static, updated per release)
  screenshots/    # UI reference designs
  src/
    screens/      # HomeScreen, SearchScreen, StopScreen, LineScreen, SelectedLineScreen, AboutScreen
    components/   # DepartureRow, StopList, TimetableGrid, SearchBar
    data/         # GTFS parser, query helpers, runtime update pipeline
    store/        # App state (favourites, last location)
```

**Navigation:** Stack navigator (React Navigation)
- Home (tabs: Favourites / Schedule / Map)
- Search (modal overlay)
- Stop detail (tabs: Now / Lines)
- Line detail (tabs: Weekday / Saturday / Sunday)
- Selected line — full stop sequence for a specific trip, with the origin stop highlighted; tapping any stop navigates to Stop detail filtered to the same direction
- About — app info, data source credit, runtime GTFS update button

**State management:** Zustand for favourites and current location. Favourites (`favStops`, `favRoutes`) are persisted across restarts via `zustand/middleware persist` + `@react-native-async-storage/async-storage` (v2.2.0, pinned for Expo compatibility). Location state is intentionally not persisted.

**Location:** `expo-location` for GPS; find nearest stop by haversine distance to `stops.txt` coordinates

**Runtime GTFS update pipeline** (`src/data/`):
- `buildGtfs.ts` — in-memory CSV parser; filters to Elron (`agency_id = '10520953'`) then builds the same compact `GtfsData` structure as the build-time script
- `gtfsLoader.ts` — called at app startup; reads `gtfs.json` from device document directory (if present) and calls `initGtfs()` to hot-swap bundled data
- `gtfsUpdater.ts` — full update pipeline: HEAD check (`checkGtfsUpdateAvailable`), download → unzip (JSZip) → process → save; progress callbacks drive the About screen UI
- `parser.ts` — `gtfs` ref is now mutable; `initGtfs(data)` replaces it at runtime; all query functions automatically see the new data
- Download source: `https://eu-gtfs.remix.com/elron.zip`
- Update timestamp stored in `AsyncStorage` under key `gtfs_updated_at` (ISO string)

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

**Key query patterns:**

1. **Nearest stop** — haversine distance from GPS coords to every stop in `stops.txt`
2. **Upcoming departures at a stop** — join `stop_times` → `trips` → `calendar` filtered by today's `service_id` and current time; optional `directionId` param filters to one travel direction
3. **Line timetable at a stop** — group departures by hour; separate tabs for Tööpäev / Laupäev / Pühapäev
4. **Stop list for a line** — ordered `stop_times` rows for one `trip_id` (canonical trip per direction)
5. **Search** — fuzzy match on `stop_name` and `route_short_name` / `route_long_name`
6. **Trip stop sequence** — all stops with departure times for a single `trip_id` (`getStopsWithTimesForTrip`)

**Time handling:** `stop_times` uses `HH:MM:SS` including values ≥ 24:00 for overnight trips. Parse as minutes-since-midnight for arithmetic. Timezone is always `Europe/Tallinn`.

---

## UI Design

Brand colour: `#ff711d` (Elron orange). White text on orange surfaces.

**Screenshots (reference designs):**

| File | Screen | Description |
|------|--------|-------------|
| `frontpage-unknown-location.webp` | Home — no GPS | Orange header with search bar ("Otsi peatusi ja liine"). Three tabs: **Lemmikud** (Favourites), **Graafik** (Schedule), **Kaart** (Map). Empty state shows dashed-border card "+ Lisa enda lemmikpeatus ja liin". |
| `frontpage-based-on-gps-location.webp` | Home — GPS active | Favourites tab populated via GPS: train icon + nearest station name ("Tartu rongijaam") + pagination dots for multiple stations. Departure rows show bold time range (`15:16 – 17:18`), route label (`Tartu → Tallinn (ekspress)`), and countdown (`35 min`) right-aligned. Section header "Homsed väljumised" separates tomorrow's trains. |
| `search-destination.webp` | Search | Full-screen overlay, back arrow + text input + clear (×). Results in two sections: **Peatused** (Stops) — stop name bold, matching routes shown as small orange pill chips with arrows (`Tartu → Tallinn (ekspress)`). **Liinid** (Lines) — line entries below. |
| `selected-train-stop-departures.webp` | Stop detail | Orange header: back arrow, stop name, favourite star (☆), location pin. Sub-tabs **Praegu** (Now) / **Liinid** (Lines). Departure rows same layout as home: time range + route + countdown. Tomorrow section header below current departures. |
| `selected-line-list-of-stops.webp` | Line — stop list | Header: back, line name ("Tallinn – Tartu (ekspress)"), location pin. Vertical dashed timeline on left; stop names listed in sequence. |
| `selected-line-departure-times.webp` | Line — timetable | Header: back, route name ("Tartu – Tallinn"), stop name subtitle ("Kaarepere"), favourite star. Day-type tabs: **Tööpäev** / **Laupäev** / **Pühapäev**. Two-column grid: bold hour on left, minutes on right. Current hour highlighted in orange. |
| `att.GDRL1u2Un3CevuZo7HBC3_JJoPlXf5cmie3lmQnxS2A.png.JPEG` | Selected line — trip stops | Orange header: back arrow, title format `{shortName} - {originStop} - {terminalStop}` (e.g. "R15 - Tallinn - Paldiski"), favourite star (☆/★). Flat list of all stops in trip order: departure time on the left, stop name on the right. Currently selected stop highlighted in orange. Tapping a stop navigates to StopScreen filtered to the same direction. Screen navigated to by tapping a departure row. |
| *(About screen)* | About / Teave | Grey background, orange header with back arrow. Info rows: version, co-author, disclaimer, inspiration, data source (https://peatus.ee/content/teenusest), last-updated date. Bottom section: checks remote Last-Modified on mount → shows "Kontrollin uuendusi..." spinner → "Sõiduplaanid on ajakohased" (green) or "Uuenda sõiduplaane" button (orange). During update: button shows spinner, step labels cycle in Estonian, downloaded KB shown. On error: red message + retry button. |

**Component patterns:**
- Departure row: `[train icon] [bold time range]  [route label]  [countdown bold right]`
- Route chip: orange rounded pill, white text, `→` separator between origin and destination
- Timeline: vertical dashed line with grey dots at each stop
- Timetable grid: left column = hour (bold, orange if current), right column = space-separated minutes (grey)
- Tab bar inside screens: underline indicator on active tab, same orange header background
