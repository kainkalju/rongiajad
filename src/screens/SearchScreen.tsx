import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import SearchBar from '../components/SearchBar';
import RouteChip from '../components/RouteChip';
import {
  searchStops,
  searchRoutes,
  getRoutesAtStop,
  getStopsForRoute,
} from '../data/parser';
import type { Stop, Route } from '../data/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

export default function SearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const stops = query.trim().length > 0 ? searchStops(query) : [];
  const routes = query.trim().length > 0 ? searchRoutes(query) : [];

  type Row =
    | { type: 'stops-header' }
    | { type: 'stop'; stop: Stop }
    | { type: 'routes-header' }
    | { type: 'route'; route: Route }
    | { type: 'hint' };

  const rows: Row[] = [];
  if (query.trim().length === 0) {
    rows.push({ type: 'hint' });
  } else {
    if (stops.length > 0) {
      rows.push({ type: 'stops-header' });
      for (const stop of stops) rows.push({ type: 'stop', stop });
    }
    if (routes.length > 0) {
      rows.push({ type: 'routes-header' });
      for (const route of routes) rows.push({ type: 'route', route });
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Otsi peatusi ja liine"
        />
      </View>

      {/* Results */}
      <FlatList
        data={rows}
        keyExtractor={(item, i) => {
          if (item.type === 'stop') return `stop-${item.stop.idx}`;
          if (item.type === 'route') return `route-${item.route.idx}`;
          return `${item.type}-${i}`;
        }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          if (item.type === 'hint') {
            return (
              <View style={styles.hint}>
                <Text style={styles.hintText}>Sisesta otsisõna</Text>
              </View>
            );
          }
          if (item.type === 'stops-header') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>Peatused</Text>
              </View>
            );
          }
          if (item.type === 'routes-header') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>Liinid</Text>
              </View>
            );
          }
          if (item.type === 'stop') {
            const routesAtStop = getRoutesAtStop(item.stop.idx);
            return (
              <TouchableOpacity
                style={styles.stopRow}
                onPress={() => {
                  Keyboard.dismiss();
                  navigation.replace('Stop', { stopIdx: item.stop.idx });
                }}
              >
                <Text style={styles.stopName}>{item.stop.name}</Text>
                <View style={styles.chips}>
                  {routesAtStop.map(r => {
                    const stopList = getStopsForRoute(r.idx, 0);
                    const origin = stopList[0]?.name;
                    const terminal = stopList[stopList.length - 1]?.name;
                    return (
                      <RouteChip
                        key={r.idx}
                        route={r}
                        originStop={origin}
                        terminalStop={terminal}
                        onPress={() => {
                          Keyboard.dismiss();
                          navigation.replace('Line', { routeIdx: r.idx, stopIdx: item.stop.idx });
                        }}
                      />
                    );
                  })}
                </View>
              </TouchableOpacity>
            );
          }
          if (item.type === 'route') {
            const stopList = getStopsForRoute(item.route.idx, 0);
            const origin = stopList[0]?.name;
            const terminal = stopList[stopList.length - 1]?.name;
            return (
              <TouchableOpacity
                style={styles.routeRow}
                onPress={() => {
                  Keyboard.dismiss();
                  navigation.replace('Line', { routeIdx: item.route.idx });
                }}
              >
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>{item.route.shortName}</Text>
                </View>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeName}>{item.route.longName}</Text>
                  {origin && terminal && (
                    <Text style={styles.routeDetail}>
                      {origin} → {terminal}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }
          return null;
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
    paddingVertical: 10,
  },
  backBtn: { marginRight: 8 },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
  },
  stopRow: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  stopName: { fontSize: 16, fontWeight: '700', color: '#111' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  routeBadge: {
    backgroundColor: '#ff711d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
    minWidth: 52,
    alignItems: 'center',
  },
  routeBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 15, fontWeight: '600', color: '#111' },
  routeDetail: { fontSize: 13, color: '#777', marginTop: 2 },
  hint: { padding: 40, alignItems: 'center' },
  hintText: { color: '#bbb', fontSize: 15 },
});
