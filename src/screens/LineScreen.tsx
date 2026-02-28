import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useStore } from '../store';
import {
  getRoute,
  getStop,
  getStopsForRoute,
  getLineTimetableAtStop,
} from '../data/parser';
import TimetableGrid from '../components/TimetableGrid';
import StopTimeline from '../components/StopTimeline';
import type { DayType, Stop } from '../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Line'>;

type View_ = 'peatused' | 'ajad';

export default function LineScreen({ route, navigation }: Props) {
  const { routeIdx, stopIdx } = route.params;
  const insets = useSafeAreaInsets();

  const lineRoute = getRoute(routeIdx);
  const { isFavRoute, addFavRoute, removeFavRoute } = useStore();
  const isFav = isFavRoute(routeIdx);

  const [view, setView] = useState<View_>(stopIdx !== undefined ? 'ajad' : 'peatused');
  const [dayType, setDayType] = useState<DayType>('weekday');

  // Stop list for direction 0
  const stops0 = getStopsForRoute(routeIdx, 0);
  const stops1 = getStopsForRoute(routeIdx, 1);
  const allStops = stops0.length > 0 ? stops0 : stops1;

  const focusedStopIdx = stopIdx ?? allStops[0]?.idx;
  const focusedStop = focusedStopIdx !== undefined ? getStop(focusedStopIdx) : null;

  const timetableEntries =
    focusedStopIdx !== undefined
      ? getLineTimetableAtStop(focusedStopIdx, routeIdx, dayType)
      : [];

  const now = new Date();
  const currentHour = now.getHours();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.lineName} numberOfLines={1}>
            {lineRoute.longName}
          </Text>
          {focusedStop && (
            <Text style={styles.stopSubtitle} numberOfLines={1}>
              {focusedStop.name}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => isFav ? removeFavRoute(routeIdx) : addFavRoute(lineRoute)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      {/* View tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, view === 'peatused' && styles.tabActive]}
          onPress={() => setView('peatused')}
        >
          <Text style={[styles.tabText, view === 'peatused' && styles.tabTextActive]}>
            Peatused
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === 'ajad' && styles.tabActive]}
          onPress={() => setView('ajad')}
        >
          <Text style={[styles.tabText, view === 'ajad' && styles.tabTextActive]}>
            Ajad
          </Text>
        </TouchableOpacity>
      </View>

      {view === 'peatused' ? (
        <StopTimeline stops={allStops} currentStopIdx={focusedStopIdx} />
      ) : (
        <View style={styles.timetableContainer}>
          {/* Day type selector */}
          <View style={styles.dayTypeBar}>
            {(['weekday', 'saturday', 'sunday'] as DayType[]).map(dt => {
              const label =
                dt === 'weekday' ? 'Tööpäev' : dt === 'saturday' ? 'Laupäev' : 'Pühapäev';
              return (
                <TouchableOpacity
                  key={dt}
                  style={[styles.dayBtn, dayType === dt && styles.dayBtnActive]}
                  onPress={() => setDayType(dt)}
                >
                  <Text style={[styles.dayBtnText, dayType === dt && styles.dayBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stop selector — horizontal scroll through all stops */}
          <FlatList
            data={allStops}
            keyExtractor={s => String(s.idx)}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stopScroll}
            contentContainerStyle={styles.stopScrollContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.stopPill,
                  item.idx === focusedStopIdx && styles.stopPillActive,
                ]}
                onPress={() =>
                  navigation.setParams({ stopIdx: item.idx })
                }
              >
                <Text
                  style={[
                    styles.stopPillText,
                    item.idx === focusedStopIdx && styles.stopPillTextActive,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />

          <TimetableGrid
            entries={timetableEntries}
            currentHour={dayType === 'weekday' ? currentHour : undefined}
          />
        </View>
      )}
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
  headerInfo: { flex: 1 },
  lineName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  stopSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  starIcon: { color: '#fff', fontSize: 22, marginLeft: 8 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ff711d',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  timetableContainer: { flex: 1 },
  dayTypeBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  dayBtnActive: { borderBottomColor: '#ff711d' },
  dayBtnText: { color: '#999', fontSize: 13, fontWeight: '600' },
  dayBtnTextActive: { color: '#ff711d' },
  stopScroll: {
    maxHeight: 48,
    backgroundColor: '#fafafa',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  stopScrollContent: { paddingHorizontal: 8, alignItems: 'center' },
  stopPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
  },
  stopPillActive: { backgroundColor: '#ff711d' },
  stopPillText: { fontSize: 13, color: '#555' },
  stopPillTextActive: { color: '#fff', fontWeight: '600' },
});
