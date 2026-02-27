import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import type { Stop } from '../data/types';

type Props = {
  stops: Stop[];
  currentStopIdx?: number;
};

export default function StopTimeline({ stops, currentStopIdx }: Props) {
  return (
    <FlatList
      data={stops}
      keyExtractor={item => String(item.idx)}
      renderItem={({ item, index }) => {
        const isCurrent = item.idx === currentStopIdx;
        const isFirst = index === 0;
        const isLast = index === stops.length - 1;
        return (
          <View style={styles.row}>
            <View style={styles.timeline}>
              <View style={[styles.topLine, isFirst && styles.invisible]} />
              <View style={[styles.dot, isCurrent && styles.dotActive]} />
              <View style={[styles.bottomLine, isLast && styles.invisible]} />
            </View>
            <Text style={[styles.stopName, isCurrent && styles.stopNameActive]}>
              {item.name}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 44,
  },
  timeline: {
    width: 40,
    alignItems: 'center',
  },
  topLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#ccc',
    borderStyle: 'dashed',
  },
  bottomLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#ccc',
  },
  invisible: {
    backgroundColor: 'transparent',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
    borderWidth: 2,
    borderColor: '#999',
    marginVertical: 4,
  },
  dotActive: {
    backgroundColor: '#ff711d',
    borderColor: '#ff711d',
  },
  stopName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 12,
    paddingLeft: 8,
  },
  stopNameActive: {
    fontWeight: '700',
    color: '#ff711d',
  },
});
