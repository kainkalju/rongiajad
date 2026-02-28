import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teave</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Rakenduse versioon</Text>
          <Text style={styles.value}>1.0.0</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Kaasautor</Text>
          <Text style={styles.value}>Claude Sonnet 4.6</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Vastutuse välistamine</Text>
          <Text style={styles.value}>
            Rakenduse looja ei võta vastutust kuvatud andmete õigsuse ega sellest tulevate ebamugavuste või kahjude osas. Head kasutamist!
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Inspiratsiooni pakkus</Text>
          <Text style={styles.value}>Rongiajad Android äpp by Mobi Lab OÜ</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Ühistranspordi avaandmed</Text>
          <Text style={styles.value}>
            Regionaal- ja Põllumajandusministeerium — https://peatus.ee/gtfs/gtfs.zip
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Sõiduplaanid uuendatud</Text>
          <Text style={styles.value}>12.02.2026 11:47:00</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  header: {
    backgroundColor: '#ff711d',
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backArrow: {
    color: '#fff',
    fontSize: 26,
    lineHeight: 30,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    paddingVertical: 16,
  },
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
  },
});
