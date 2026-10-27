# Release notes

## 1.5.0
*2026-10-27*

### New
- Favourite lines show the saved direction (origin → terminal) and open that way
- Direction switch on the line stop list (Peatused), shared with the timetable
- About screen credits Cursor Grok 4.7 alongside Claude Sonnet 4.6

### Fixed
- Favourited lines no longer flip direction after a GTFS bundle update
- Favourite stops stay on the same platform when a station has two stop records
- Expo and expo-file-system updated for SDK 54 compatibility

---

## 1.4.0
*2026-05-19*

### New
- Route short name badge shown in LineScreen header

### Fixed
- Favourites opening wrong route/stop after GTFS update
- Expo and expo-file-system compatibility updates

---

## 1.3.0
*2026-04-20*

### New
- GPS location refreshes every 20 seconds on the Home screen

### Fixed
- User's selected stop is preserved across silent GPS refreshes (no more jumping back to the nearest stop mid-browse)
- Expired timetable periods filtered out from the line timetable grid

---

## 1.2.0
*2026-04-18*

### New
- Region context shown on favourite stops (e.g. Tallinn · Lääne suund)
- Search stop results grouped by Elron direction region (Ida-Lõuna / Lääne / Edel)
- Tapping a stop in search results navigates directly to the stop screen

### Fixed
- Departures refresh immediately after a runtime GTFS update

---

## 1.1.0
*2026-04-17*

### New
- Automatic weekly GTFS update check on app launch — the info button badges when new schedule data is available
- Animated pulsing dot on the info badge to draw attention to pending updates

### Fixed
- Info badge no longer keeps blinking after a successful GTFS update

---

## 1.0.1

### New
- Direction toggle on the Line timetable (Ajad) tab
- Auto-refresh on the selected trip screen every 30 seconds

### Fixed
- Today's departures no longer cut off prematurely at busy stops
- Trip screen header no longer disappears after a runtime GTFS update
- Countdown now shows hours and minutes correctly (e.g. "1 h 23 min")

---

## 1.0.0

Initial App Store release.

- GPS-based nearest stop detection
- Offline schedule data for all Elron routes
- Favourite stops and lines
- Stop departure board with today/tomorrow sections
- Line timetable grid by day type (Tööpäev / Laupäev / Pühapäev)
- Trip stop sequence with live countdown
- Stop and route search
- Runtime GTFS schedule update from About screen
