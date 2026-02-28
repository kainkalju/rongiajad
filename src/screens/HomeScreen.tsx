import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useStore } from '../store';
import { getNearestStops, getUpcomingDepartures, getStop } from '../data/parser';
import DepartureRow from '../components/DepartureRow';
import type { Departure, Stop } from '../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type Tab = 'lemmikud' | 'graafik';

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('graafik');
  const [nearestStops, setNearestStops] = useState<(Stop & { distanceKm: number })[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [todayDeps, setTodayDeps] = useState<Departure[]>([]);
  const [tomorrowDeps, setTomorrowDeps] = useState<Departure[]>([]);
  const [activeStopIdx, setActiveStopIdx] = useState<number | null>(null);

  const { setLocation, favStops, favRoutes } = useStore();

  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Asukoha luba puudub');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = loc.coords;
      setLocation({ lat, lon });
      const nearest = getNearestStops(lat, lon, 3);
      setNearestStops(nearest);
      if (nearest.length > 0) {
        setActiveStopIdx(nearest[0].idx);
      }
    } catch {
      setLocationError('Asukoht pole kättesaadav');
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (activeStopIdx === null) return;
    const currentNow = new Date();
    setNow(currentNow);
    const { today, tomorrow } = getUpcomingDepartures(activeStopIdx, currentNow);
    setTodayDeps(today);
    setTomorrowDeps(tomorrow);
  }, [activeStopIdx]);

  // Tick every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      if (activeStopIdx !== null) {
        const currentNow = new Date();
        const { today, tomorrow } = getUpcomingDepartures(activeStopIdx, currentNow);
        setTodayDeps(today);
        setTomorrowDeps(tomorrow);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [activeStopIdx]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const activeStop = activeStopIdx !== null ? getStop(activeStopIdx) : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.appTitle}>Rongiajad</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('Search')}>
          <Text style={styles.searchText}>Otsi peatusi ja liine</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'lemmikud' && styles.tabActive]}
          onPress={() => setTab('lemmikud')}
        >
          <Text style={[styles.tabText, tab === 'lemmikud' && styles.tabTextActive]}>
            Lemmikud
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'graafik' && styles.tabActive]}
          onPress={() => setTab('graafik')}
        >
          <Text style={[styles.tabText, tab === 'graafik' && styles.tabTextActive]}>
            Graafik
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'graafik' ? (
        <GraafikTab
          loading={loading}
          locationError={locationError}
          nearestStops={nearestStops}
          activeStopIdx={activeStopIdx}
          onSelectStop={idx => setActiveStopIdx(idx)}
          todayDeps={todayDeps}
          tomorrowDeps={tomorrowDeps}
          nowMinutes={nowMinutes}
          onRefresh={requestLocation}
          onStopPress={stopIdx => navigation.navigate('Stop', { stopIdx })}
        onDeparturePress={(tripIdx, sIdx) => navigation.navigate('CurrentLine', { tripIdx, stopIdx: sIdx })}
        />
      ) : (
        <LemmikudTab
          favStops={favStops}
          favRoutes={favRoutes}
          nowMinutes={nowMinutes}
          onStopPress={stopIdx => navigation.navigate('Stop', { stopIdx })}
          onRoutePress={routeIdx => navigation.navigate('Line', { routeIdx })}
        />
      )}
    </View>
  );
}

// ---- Graafik sub-tab ----
function GraafikTab({
  loading,
  locationError,
  nearestStops,
  activeStopIdx,
  onSelectStop,
  todayDeps,
  tomorrowDeps,
  nowMinutes,
  onRefresh,
  onStopPress,
  onDeparturePress,
}: {
  loading: boolean;
  locationError: string | null;
  nearestStops: (Stop & { distanceKm: number })[];
  activeStopIdx: number | null;
  onSelectStop: (idx: number) => void;
  todayDeps: Departure[];
  tomorrowDeps: Departure[];
  nowMinutes: number;
  onRefresh: () => void;
  onStopPress: (idx: number) => void;
  onDeparturePress: (tripIdx: number, stopIdx: number) => void;
}) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ff711d" />
        <Text style={styles.loadingText}>Otsime asukohta…</Text>
      </View>
    );
  }

  if (locationError || nearestStops.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{locationError ?? 'Asukoht teadmata'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>Proovi uuesti</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items: Array<{ type: 'stopPicker' } | { type: 'today-header' } | { type: 'dep'; dep: Departure; isTomorrow: boolean } | { type: 'tomorrow-header' }> = [
    { type: 'stopPicker' },
    { type: 'today-header' },
    ...todayDeps.map(dep => ({ type: 'dep' as const, dep, isTomorrow: false })),
    ...(tomorrowDeps.length > 0 ? [{ type: 'tomorrow-header' as const }] : []),
    ...tomorrowDeps.map(dep => ({ type: 'dep' as const, dep, isTomorrow: true })),
  ];

  return (
    <FlatList
      data={items}
      keyExtractor={(item, i) =>
        item.type === 'dep' ? `${item.dep.tripIdx}-${item.dep.dep}` : `${item.type}-${i}`
      }
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#ff711d" />}
      renderItem={({ item }) => {
        if (item.type === 'stopPicker') {
          return (
            <View style={styles.stopPicker}>
              {nearestStops.map(stop => (
                <TouchableOpacity
                  key={stop.idx}
                  style={[styles.stopChip, stop.idx === activeStopIdx && styles.stopChipActive]}
                  onPress={() => onSelectStop(stop.idx)}
                  onLongPress={() => onStopPress(stop.idx)}
                >
                  <Text
                    style={[styles.stopChipText, stop.idx === activeStopIdx && styles.stopChipTextActive]}
                    numberOfLines={1}
                  >
                    {stop.name}
                  </Text>
                  <Text style={styles.stopDist}>{stop.distanceKm < 1
                    ? `${Math.round(stop.distanceKm * 1000)} m`
                    : `${stop.distanceKm.toFixed(1)} km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        }
        if (item.type === 'today-header') {
          const activeStop = activeStopIdx !== null ? getStop(activeStopIdx) : null;
          return (
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => activeStopIdx !== null && onStopPress(activeStopIdx)}
            >
              <Text style={styles.sectionHeaderText}>
                {activeStop?.name ?? ''} · Tänased väljumised
              </Text>
            </TouchableOpacity>
          );
        }
        if (item.type === 'tomorrow-header') {
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Homsed väljumised</Text>
            </View>
          );
        }
        return (
          <DepartureRow
            departure={item.dep}
            nowMinutes={item.isTomorrow ? nowMinutes - 1440 : nowMinutes}
            onPress={() => activeStopIdx !== null && onDeparturePress(item.dep.tripIdx, activeStopIdx)}
          />
        );
      }}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Tänaseid väljumisi pole</Text>
        </View>
      }
    />
  );
}

// ---- Lemmikud sub-tab ----
function LemmikudTab({
  favStops,
  favRoutes,
  nowMinutes,
  onStopPress,
  onRoutePress,
}: {
  favStops: { stopIdx: number; name: string }[];
  favRoutes: { routeIdx: number; shortName: string; longName: string }[];
  nowMinutes: number;
  onStopPress: (idx: number) => void;
  onRoutePress: (idx: number) => void;
}) {
  if (favStops.length === 0 && favRoutes.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>+ Lisa enda lemmikpeatus ja liin</Text>
        </View>
        <Text style={styles.emptyHint}>
          Ava peatus või liin ja vajuta tähekest ☆
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={[
        ...favStops.map(s => ({ kind: 'stop' as const, ...s })),
        ...favRoutes.map(r => ({ kind: 'route' as const, ...r })),
      ]}
      keyExtractor={item =>
        item.kind === 'stop' ? `stop-${item.stopIdx}` : `route-${item.routeIdx}`
      }
      renderItem={({ item }) => {
        if (item.kind === 'stop') {
          return (
            <TouchableOpacity
              style={styles.favRow}
              onPress={() => onStopPress(item.stopIdx)}
            >
              <Text style={styles.favIcon}>🚉</Text>
              <Text style={styles.favName}>{item.name}</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            style={styles.favRow}
            onPress={() => onRoutePress(item.routeIdx)}
          >
            <Text style={styles.favIcon}>🚂</Text>
            <Text style={styles.favName}>{item.longName}</Text>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{item.shortName}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#ff711d',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  appTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  searchBtn: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ff711d',
    borderBottomWidth: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#fff',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { color: '#999', marginTop: 12, fontSize: 15 },
  errorText: { color: '#666', fontSize: 15, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#ff711d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  stopPicker: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  stopChip: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  stopChipActive: {
    backgroundColor: '#ff711d',
  },
  stopChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  stopChipTextActive: {
    color: '#fff',
  },
  stopDist: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  emptyText: { color: '#999', fontSize: 15 },
  emptyCard: {
    borderWidth: 2,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  emptyCardText: { color: '#999', fontSize: 16, textAlign: 'center' },
  emptyHint: { color: '#bbb', fontSize: 13, marginTop: 16, textAlign: 'center' },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  favIcon: { fontSize: 20, marginRight: 12 },
  favName: { flex: 1, fontSize: 15, color: '#111' },
  routeBadge: {
    backgroundColor: '#ff711d',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  routeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
