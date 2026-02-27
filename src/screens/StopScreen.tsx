import React, { useState, useEffect } from 'react';
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
  getStop,
  getUpcomingDepartures,
  getRoutesAtStop,
} from '../data/parser';
import DepartureRow from '../components/DepartureRow';
import RouteChip from '../components/RouteChip';
import type { Departure, Route } from '../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Stop'>;

type Tab = 'praegu' | 'liinid';

export default function StopScreen({ route, navigation }: Props) {
  const { stopIdx } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('praegu');
  const [now, setNow] = useState(new Date());
  const [todayDeps, setTodayDeps] = useState<Departure[]>([]);
  const [tomorrowDeps, setTomorrowDeps] = useState<Departure[]>([]);

  const stop = getStop(stopIdx);
  const { isFavStop, addFavStop, removeFavStop } = useStore();
  const isFav = isFavStop(stopIdx);

  useEffect(() => {
    const currentNow = new Date();
    setNow(currentNow);
    const { today, tomorrow } = getUpcomingDepartures(stopIdx, currentNow, 30);
    setTodayDeps(today);
    setTomorrowDeps(tomorrow);
  }, [stopIdx]);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = new Date();
      setNow(currentNow);
      const { today, tomorrow } = getUpcomingDepartures(stopIdx, currentNow, 30);
      setTodayDeps(today);
      setTomorrowDeps(tomorrow);
    }, 60_000);
    return () => clearInterval(timer);
  }, [stopIdx]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const routes = getRoutesAtStop(stopIdx);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
        <TouchableOpacity
          onPress={() => isFav ? removeFavStop(stopIdx) : addFavStop(stop)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.starIcon}>{isFav ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'praegu' && styles.tabActive]}
          onPress={() => setTab('praegu')}
        >
          <Text style={[styles.tabText, tab === 'praegu' && styles.tabTextActive]}>
            Praegu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'liinid' && styles.tabActive]}
          onPress={() => setTab('liinid')}
        >
          <Text style={[styles.tabText, tab === 'liinid' && styles.tabTextActive]}>
            Liinid
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'praegu' ? (
        <DeparturesList
          todayDeps={todayDeps}
          tomorrowDeps={tomorrowDeps}
          nowMinutes={nowMinutes}
        />
      ) : (
        <LinesList
          routes={routes}
          stopIdx={stopIdx}
          onRoutePress={routeIdx =>
            navigation.navigate('Line', { routeIdx, stopIdx })
          }
        />
      )}
    </View>
  );
}

function DeparturesList({
  todayDeps,
  tomorrowDeps,
  nowMinutes,
}: {
  todayDeps: Departure[];
  tomorrowDeps: Departure[];
  nowMinutes: number;
}) {
  type Row =
    | { type: 'today-header' }
    | { type: 'dep'; dep: Departure; isTomorrow: boolean }
    | { type: 'tomorrow-header' }
    | { type: 'empty' };

  const rows: Row[] = [];
  if (todayDeps.length === 0 && tomorrowDeps.length === 0) {
    rows.push({ type: 'empty' });
  } else {
    if (todayDeps.length > 0) {
      rows.push({ type: 'today-header' });
      todayDeps.forEach(dep => rows.push({ type: 'dep', dep, isTomorrow: false }));
    }
    if (tomorrowDeps.length > 0) {
      rows.push({ type: 'tomorrow-header' });
      tomorrowDeps.forEach(dep => rows.push({ type: 'dep', dep, isTomorrow: true }));
    }
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, i) =>
        item.type === 'dep' ? `${item.dep.tripIdx}-${item.dep.dep}` : `${item.type}-${i}`
      }
      renderItem={({ item }) => {
        if (item.type === 'empty') {
          return (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Tänaseid väljumisi pole</Text>
            </View>
          );
        }
        if (item.type === 'today-header') {
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Tänased väljumised</Text>
            </View>
          );
        }
        if (item.type === 'tomorrow-header') {
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Homsed väljumised</Text>
            </View>
          );
        }
        return <DepartureRow departure={item.dep} nowMinutes={item.isTomorrow ? nowMinutes - 1440 : nowMinutes} />;
      }}
    />
  );
}

function LinesList({
  routes,
  stopIdx,
  onRoutePress,
}: {
  routes: Route[];
  stopIdx: number;
  onRoutePress: (routeIdx: number) => void;
}) {
  if (routes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Liine pole</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={routes}
      keyExtractor={r => String(r.idx)}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.lineRow} onPress={() => onRoutePress(item.idx)}>
          <View style={styles.lineBadge}>
            <Text style={styles.lineBadgeText}>{item.shortName}</Text>
          </View>
          <Text style={styles.lineName} numberOfLines={1}>{item.longName}</Text>
          <Text style={styles.lineArrow}>›</Text>
        </TouchableOpacity>
      )}
    />
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
  stopName: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: { color: '#999', fontSize: 15 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  lineBadge: {
    backgroundColor: '#ff711d',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 12,
  },
  lineBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  lineName: { flex: 1, fontSize: 15, color: '#111' },
  lineArrow: { color: '#bbb', fontSize: 20 },
});
