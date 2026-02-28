import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Departure } from '../data/types';
import { minutesToHHMM, timeToMinutes } from '../data/parser';

type Props = {
  departure: Departure;
  nowMinutes: number;
  onPress?: () => void;
};

export default function DepartureRow({ departure, nowMinutes, onPress }: Props) {
  const { dep, depMinutes, route, originStop, terminalStop } = departure;
  const countdown = depMinutes - nowMinutes;
  const countdownLabel =
    countdown <= 0 ? 'Nüüd' : countdown < 60 ? `${countdown} min` : `${Math.floor(countdown / 60)}h ${countdown % 60}m`;

  const timeLabel = minutesToHHMM(depMinutes);
  const routeLabel = `${originStop} → ${terminalStop}`;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={styles.trainIcon}>🚂</Text>
      <View style={styles.middle}>
        <Text style={styles.time}>{timeLabel}</Text>
        <Text style={styles.route} numberOfLines={1}>
          {routeLabel}
        </Text>
      </View>
      <Text style={styles.countdown}>{countdownLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  trainIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  middle: {
    flex: 1,
  },
  time: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  route: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  countdown: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff711d',
    minWidth: 52,
    textAlign: 'right',
  },
});
