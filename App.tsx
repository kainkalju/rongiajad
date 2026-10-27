import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { loadSavedGtfs } from './src/data/gtfsLoader';
import { useStore } from './src/store';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let gtfsReady = false;
    let hydrated = useStore.persist.hasHydrated();
    let started = false;

    const tryFinish = () => {
      if (cancelled || started || !gtfsReady || !hydrated) return;
      started = true;
      // Bundled and downloaded feeds rebuild integer indices, and direction_id
      // can swap. Re-bind favourites before the first screen reads them.
      useStore.getState().reresolveFavoriteIndices();
      setReady(true);
    };

    const unsub = useStore.persist.onFinishHydration(() => {
      hydrated = true;
      tryFinish();
    });

    loadSavedGtfs().then(() => {
      gtfsReady = true;
      if (useStore.persist.hasHydrated()) hydrated = true;
      tryFinish();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#ff711d' }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation />
    </SafeAreaProvider>
  );
}
