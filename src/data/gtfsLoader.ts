import { File, Paths } from 'expo-file-system';
import { initGtfs } from './parser';
import type { GtfsData } from './types';

/**
 * Loads saved GTFS data from device storage if available.
 * Falls back silently to the bundled data if no saved file exists.
 */
export async function loadSavedGtfs(): Promise<void> {
  try {
    const file = new File(Paths.document, 'gtfs.json');
    if (!file.exists) return;
    const json = await file.text();
    const data: GtfsData = JSON.parse(json);
    initGtfs(data);
  } catch {
    // Silently fall back to bundled data
  }
}
