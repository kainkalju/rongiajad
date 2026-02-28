import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JSZip from 'jszip';
import { buildGtfsData } from './buildGtfs';
import { initGtfs } from './parser';

const GTFS_URL = 'https://eu-gtfs.remix.com/elron.zip';

const NEEDED_FILES = [
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'stops.txt',
  'calendar.txt',
  'calendar_dates.txt',
];

export type Step = 'downloading' | 'unzipping' | 'processing' | 'saving' | 'done';
export type UpdateCheckResult = 'available' | 'current' | 'failed';

/**
 * Checks whether a newer GTFS feed is available by comparing the remote
 * Last-Modified header against our locally stored update timestamp.
 *
 * @param localIso — ISO string of when we last updated (from AsyncStorage),
 *                   or null if only bundled data is present.
 */
export async function checkGtfsUpdateAvailable(localIso: string | null): Promise<UpdateCheckResult> {
  try {
    const res = await fetch(GTFS_URL, { method: 'HEAD' });
    const lastModified = res.headers.get('last-modified');
    if (!lastModified) return 'available'; // can't tell — allow update
    const remoteDate = new Date(lastModified);
    if (isNaN(remoteDate.getTime())) return 'available';

    const localDate = localIso ? new Date(localIso) : null;
    if (!localDate || isNaN(localDate.getTime())) return 'available';

    console.log(`[gtfsUpdater] remote: ${remoteDate.toISOString()}, local: ${localDate.toISOString()}`);
    return remoteDate > localDate ? 'available' : 'current';
  } catch {
    return 'failed';
  }
}

/**
 * Downloads the latest GTFS feed, processes it, and hot-swaps the in-memory data.
 * Saves the result to device storage so it survives app restarts.
 *
 * @param onStep  — called when a new pipeline step begins
 * @param onInfo  — called with extra human-readable detail (e.g. downloaded bytes)
 */
export async function updateGtfsData(
  onStep: (s: Step) => void,
  onInfo: (msg: string) => void,
): Promise<void> {
  const zipFile = new File(Paths.document, 'gtfs_update.zip');
  try {
    // Step 1: Download
    onStep('downloading');
    await File.downloadFileAsync(GTFS_URL, zipFile, { idempotent: true });

    const bytes = zipFile.size;
    const kb = Math.round(bytes / 1024);
    console.log(`[gtfsUpdater] Downloaded ${bytes} bytes (${kb} KB), file exists: ${zipFile.exists}`);
    onInfo(`Allalaaditud: ${kb} KB`);

    // Step 2: Unzip
    onStep('unzipping');
    const base64 = await zipFile.base64();
    console.log(`[gtfsUpdater] base64 length: ${base64.length}`);
    const zip = await JSZip.loadAsync(base64, { base64: true });

    const files: Record<string, string> = {};
    for (const filename of NEEDED_FILES) {
      const entry = zip.file(filename);
      if (entry) {
        files[filename] = await entry.async('string');
        console.log(`[gtfsUpdater] Extracted ${filename}: ${files[filename].length} chars`);
      } else {
        console.warn(`[gtfsUpdater] Missing file in zip: ${filename}`);
      }
    }

    // Step 3: Process
    onStep('processing');
    const data = buildGtfsData(files);

    // Step 4: Save
    onStep('saving');
    const jsonFile = new File(Paths.document, 'gtfs.json');
    jsonFile.write(JSON.stringify(data));
    await AsyncStorage.setItem('gtfs_updated_at', new Date().toISOString());

    // Step 5: Hot-swap
    initGtfs(data);
    onStep('done');
  } finally {
    // Always clean up zip file
    try {
      if (zipFile.exists) zipFile.delete();
    } catch {
      // Ignore cleanup errors
    }
  }
}
