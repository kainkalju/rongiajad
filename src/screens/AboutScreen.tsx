import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { updateGtfsData, checkGtfsUpdateAvailable, type Step, type UpdateCheckResult } from '../data/gtfsUpdater';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

const BUNDLED_DATE = '12.02.2026 11:47:00';
// Parsed as local time (Europe/Tallinn), good enough for comparison
const BUNDLED_DATE_ISO = new Date(2026, 1, 12, 11, 47, 0).toISOString();

const STEP_LABELS: Record<Step, string> = {
  downloading: 'Laadin alla...',
  unzipping: 'Pakin lahti...',
  processing: 'Töötlen andmeid...',
  saving: 'Salvestan...',
  done: 'Andmed uuendatud!',
};

function formatStoredDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${day}.${month}.${year} ${h}:${m}:${s}`;
}

export default function AboutScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | 'checking'>('checking');
  const [updating, setUpdating] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runUpdateCheck = useCallback(async (localIso: string | null) => {
    setUpdateCheck('checking');
    const result = await checkGtfsUpdateAvailable(localIso);
    setUpdateCheck(result);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('gtfs_updated_at').then(val => {
      const displayVal = val ? formatStoredDate(val) : null;
      setUpdatedAt(displayVal);
      runUpdateCheck(val ?? BUNDLED_DATE_ISO);
    });
  }, [runUpdateCheck]);

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    setError(null);
    setStep(null);
    setInfo(null);
    try {
      await updateGtfsData(s => setStep(s), msg => setInfo(msg));
      const iso = new Date().toISOString();
      await AsyncStorage.setItem('gtfs_updated_at', iso);
      setUpdatedAt(formatStoredDate(iso));
      setUpdateCheck('current');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Tundmatu viga');
    } finally {
      setUpdating(false);
    }
  }, []);

  const displayDate = updatedAt ?? BUNDLED_DATE;

  const showButton = updating || updateCheck === 'available' || updateCheck === 'failed';

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
          <Text style={styles.label}>Kaasautor ja programmeerija</Text>
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
            Regionaal- ja Põllumajandusministeerium — https://peatus.ee/content/teenusest
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Sõiduplaanid uuendatud</Text>
          <Text style={styles.value}>{displayDate}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.updateSection}>
          {updateCheck === 'checking' && !updating && (
            <View style={styles.checkingRow}>
              <ActivityIndicator color="#ff711d" size="small" />
              <Text style={styles.checkingText}>Kontrollin uuendusi...</Text>
            </View>
          )}

          {updateCheck === 'current' && !updating && (
            <Text style={styles.currentText}>Sõiduplaanid on ajakohased</Text>
          )}

          {showButton && (
            <TouchableOpacity
              style={[styles.updateBtn, updating && styles.updateBtnDisabled]}
              onPress={handleUpdate}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.updateBtnText}>Uuenda sõiduplaane</Text>
              )}
            </TouchableOpacity>
          )}

          {updateCheck === 'failed' && !updating && (
            <Text style={styles.checkFailedText}>Ühenduse kontrollimine ebaõnnestus</Text>
          )}

          {step !== null && (
            <Text style={[styles.stepLabel, step === 'done' && styles.stepDone]}>
              {STEP_LABELS[step]}
            </Text>
          )}

          {info !== null && (
            <Text style={styles.infoText}>{info}</Text>
          )}

          {error !== null && (
            <>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleUpdate}>
                <Text style={styles.retryBtnText}>Proovi uuesti</Text>
              </TouchableOpacity>
            </>
          )}
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
  updateSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 12,
  },
  checkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkingText: {
    fontSize: 14,
    color: '#888',
  },
  currentText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
  checkFailedText: {
    fontSize: 13,
    color: '#888',
  },
  updateBtn: {
    backgroundColor: '#ff711d',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  updateBtnDisabled: {
    opacity: 0.6,
  },
  updateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 14,
    color: '#666',
  },
  stepDone: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 13,
    color: '#888',
  },
  errorText: {
    fontSize: 13,
    color: '#c62828',
    textAlign: 'center',
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: '#ff711d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryBtnText: {
    color: '#ff711d',
    fontSize: 14,
    fontWeight: '600',
  },
});
