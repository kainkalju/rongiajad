import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Route } from '../data/types';

type Props = {
  route: Route;
  originStop?: string;
  terminalStop?: string;
  onPress?: () => void;
};

export default function RouteChip({ route, originStop, terminalStop, onPress }: Props) {
  const label =
    originStop && terminalStop
      ? `${originStop} → ${terminalStop}`
      : route.longName;

  if (onPress) {
    return (
      <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.7}>
        <Text style={styles.text} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.chip}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#ff711d',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginTop: 4,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
