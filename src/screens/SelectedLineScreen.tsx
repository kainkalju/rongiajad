import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getStopsWithTimesForTrip, getRoute, minutesToHHMM, timeToMinutes } from '../data/parser';
import gtfsRaw from '../data/gtfs.json';
import type { GtfsData } from '../data/types';

const gtfs = gtfsRaw as unknown as GtfsData;

type Props = NativeStackScreenProps<RootStackParamList, 'SelectedLine'>;

export default function SelectedLineScreen({ route, navigation }: Props) {
  const { tripIdx, stopIdx } = route.params;
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);

  const trip = gtfs.trips[tripIdx];
  const lineRoute = trip ? getRoute(trip[0]) : null;
  const stopItems = getStopsWithTimesForTrip(tripIdx);

  const originStop = stopItems[0]?.stop.name ?? '';
  const terminalStop = stopItems[stopItems.length - 1]?.stop.name ?? '';
  const title = lineRoute
    ? `${lineRoute.shortName} - ${originStop} - ${terminalStop}`
    : '';

  const selectedIndex = stopItems.findIndex(s => s.stop.idx === stopIdx);

  // Scroll to selected stop after layout
  useEffect(() => {
    if (selectedIndex >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: selectedIndex, animated: true, viewPosition: 0.4 });
      }, 300);
    }
  }, [selectedIndex]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.pinIcon}>📍</Text>
      </View>

      <FlatList
        ref={listRef}
        data={stopItems}
        keyExtractor={item => String(item.stop.idx)}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => {
          const isSelected = item.stop.idx === stopIdx;
          const depMins = timeToMinutes(item.dep);
          const timeLabel = minutesToHHMM(depMins);
          return (
            <View style={[styles.row, isSelected && styles.rowSelected]}>
              <Text style={[styles.time, isSelected && styles.timeSelected]}>
                {timeLabel}
              </Text>
              <Text style={[styles.stopName, isSelected && styles.stopNameSelected]}>
                {item.stop.name}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff711d',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { marginRight: 8 },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  pinIcon: { fontSize: 20, marginLeft: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  rowSelected: {
    backgroundColor: '#fff',
  },
  time: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
    width: 52,
  },
  timeSelected: {
    color: '#ff711d',
    fontWeight: '700',
  },
  stopName: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  stopNameSelected: {
    color: '#ff711d',
    fontWeight: '700',
  },
});
