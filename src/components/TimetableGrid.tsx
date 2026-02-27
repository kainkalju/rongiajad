import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { TimetableEntry } from '../data/types';

type Props = {
  entries: TimetableEntry[];
  currentHour?: number;
};

export default function TimetableGrid({ entries, currentHour }: Props) {
  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Väljumisi pole</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {entries.map(({ hour, minutes }) => {
        const isCurrent = hour === currentHour;
        return (
          <View key={hour} style={styles.row}>
            <View style={[styles.hourCell, isCurrent && styles.hourCellActive]}>
              <Text style={[styles.hourText, isCurrent && styles.hourTextActive]}>
                {String(hour).padStart(2, '0')}
              </Text>
            </View>
            <View style={styles.minutesCell}>
              <Text style={styles.minutesText}>
                {minutes.map(m => String(m).padStart(2, '0')).join('  ')}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    minHeight: 40,
    alignItems: 'center',
  },
  hourCell: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  hourCellActive: {
    backgroundColor: '#ff711d',
  },
  hourText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff711d',
  },
  hourTextActive: {
    color: '#fff',
  },
  minutesCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  minutesText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 15,
  },
});
