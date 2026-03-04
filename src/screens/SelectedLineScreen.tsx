import React, { useRef, useEffect, useState } from 'react';
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
import { useStore } from '../store';
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
  const { isFavRoute, addFavRoute, removeFavRoute } = useStore();
  const isFav = lineRoute ? isFavRoute(lineRoute.idx) : false;
  const stopItems = getStopsWithTimesForTrip(tripIdx);

  const originStop = stopItems[0]?.stop.name ?? '';
  const terminalStop = stopItems[stopItems.length - 1]?.stop.name ?? '';
  const title = lineRoute
    ? `${lineRoute.shortName} - ${originStop} - ${terminalStop}`
    : '';

  const selectedIndex = stopItems.findIndex(s => s.stop.idx === stopIdx);

  const [nowMins, setNowMins] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

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
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity
          onPress={() => lineRoute && (isFav ? removeFavRoute(lineRoute.idx) : addFavRoute(lineRoute))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
        </TouchableOpacity>
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
          const isPast = depMins < nowMins;
          const minsLeft = depMins - nowMins;
          return (
            <TouchableOpacity
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => navigation.navigate('Stop', { stopIdx: item.stop.idx, directionId: trip[2] })}
            >
              <Text style={[styles.time, isPast && styles.timePast, isSelected && styles.timeSelected]}>
                {timeLabel}
              </Text>
              <Text style={[styles.stopName, isPast && styles.stopNamePast, isSelected && styles.stopNameSelected]}>
                {item.stop.name}
              </Text>
              {!isPast && (
                <Text style={[styles.countdown, isSelected && styles.countdownSelected]}>
                  {minsLeft} min
                </Text>
              )}
            </TouchableOpacity>
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
  backBtn: { marginRight: 4, padding: 8 },
  backIcon: { color: '#fff', fontSize: 26, fontWeight: '400', lineHeight: 28 },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  starIcon: { color: '#fff', fontSize: 22, marginLeft: 8 },
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
  timePast: {
    color: '#aaa',
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
  stopNamePast: {
    color: '#aaa',
  },
  stopNameSelected: {
    color: '#ff711d',
    fontWeight: '700',
  },
  countdown: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
  countdownSelected: {
    color: '#ff711d',
  },
});
