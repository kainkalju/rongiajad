import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initGtfs } from './parser';
import { GTFS_SCHEMA_VERSION } from './gtfsUpdater';
import type { GtfsData } from './types';

/**
 * Loads saved GTFS data from device storage if available.
 * Falls back silently to the bundled data if the file is missing or was
 * saved by an older app version with an incompatible data structure.
 */
export async function loadSavedGtfs(): Promise<void> {
  try {
    const file = new File(Paths.document, 'gtfs.json');
    if (!file.exists) return;

    const storedVersion = await AsyncStorage.getItem('gtfs_schema_version');
    if (Number(storedVersion) !== GTFS_SCHEMA_VERSION) return;

    const json = await file.text();
    const data: GtfsData = JSON.parse(json);
    initGtfs(data);
  } catch {
    // Silently fall back to bundled data
  }
}
