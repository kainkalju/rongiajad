import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { loadSavedGtfs } from './src/data/gtfsLoader';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSavedGtfs().then(() => setReady(true));
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#ff711d' }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation />
    </SafeAreaProvider>
  );
}
