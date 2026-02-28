# Rongiajad

Estonian train schedule app for iOS and Android, built with React Native + Expo.

Shows upcoming Elron departures from the nearest station based on your GPS location. All schedule data is bundled offline — no internet required to check trains.

![Home screen](screenshots/homescreen.png)

---

## Features

- **Nearest stop** — automatically detects your closest train station via GPS
- **Upcoming departures** — shows today's and tomorrow's trains with live countdown
- **Stop search** — search any Elron stop or line by name
- **Line timetables** — hourly grid view, separate tabs for weekdays / Saturday / Sunday
- **Trip stop sequence** — tap any departure to see the full list of stops with times
- **Favourites** — pin stops and lines for quick access, persisted across restarts
- **Offline-first** — all schedule data bundled at build time, works without network
- **Runtime schedule update** — download the latest GTFS feed in-app without waiting for an app release; checks for newer data automatically on the About screen

---

## Tech stack

| | |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Navigation | React Navigation (stack) |
| State | Zustand + AsyncStorage |
| Location | expo-location |
| Data format | GTFS static feed |
| Runtime update | expo-file-system + JSZip |

---

## Data

Schedule data comes from the [Elron](https://elron.ee) GTFS feed, provided by the Estonian Ministry of Regional Affairs and Agriculture via [peatus.ee](https://peatus.ee/content/teenusest).

---

## Getting started

### 1. Download GTFS data

The `elron/` directory is not included in the repository. Download the Elron GTFS feed and extract it there before building:

```bash
mkdir -p elron
curl -L https://eu-gtfs.remix.com/elron.zip -o elron.zip
unzip elron.zip -d elron
rm elron.zip
```

### 2. Install dependencies and build

```bash
npm install --legacy-peer-deps

# Build the compact data bundle from elron/ files
npm run build-data
```

### 3. Run the app

| Command | Description |
|---|---|
| `npx expo start --ios` | Start the Metro bundler and launch the app in the iOS Simulator |
| `npx expo run:ios` | Build the native iOS app and run it in the iOS Simulator (required when adding native modules) |
| `npx expo run:ios --device --configuration Release` | Build a Release binary and install it on a connected physical iOS device |

Requires Node 18+, Xcode (for iOS builds). Tested with Expo Go and standalone builds on iOS.

---

## Project structure

```
rongiajad/
  elron/                    # GTFS source files (not in git — download separately)
  scripts/build-data.js     # GTFS → src/data/gtfs.json preprocessor
  src/
    data/
      gtfs.json             # Pre-built compact data bundle
      types.ts              # TypeScript types
      parser.ts             # All query functions + mutable gtfs ref
      buildGtfs.ts          # In-memory GTFS builder (runtime updates)
      gtfsLoader.ts         # Startup loader for saved data
      gtfsUpdater.ts        # Download → unzip → process → save pipeline
    screens/
      HomeScreen.tsx
      SearchScreen.tsx
      StopScreen.tsx
      LineScreen.tsx
      SelectedLineScreen.tsx
      AboutScreen.tsx
    components/
    navigation/
    store/
```

---

## Disclaimer

This app is an independent project and is not affiliated with Elron AS. The developer takes no responsibility for the accuracy of displayed timetables or any inconvenience caused by errors in the data.

---

*Co-authored with Claude Sonnet 4.6*
