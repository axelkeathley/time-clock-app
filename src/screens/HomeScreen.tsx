import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadEntries, loadSettings, clockIn, clockOut, getActiveEntry, DEFAULT_SETTINGS } from '../utils/storage';
import {
  calculateTotalHours,
  filterEntriesByRange,
  getStartOfDay, getEndOfDay,
  getStartOfWeek, getEndOfWeek,
  formatHoursShort, formatDuration,
  getEntryDurationMs,
} from '../utils/calculations';
import { TimeEntry, Settings } from '../utils/types';

const C = {
  bg: '#0F172A',
  card: '#1E293B',
  primary: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  text: '#F8FAFC',
  muted: '#94A3B8',
  border: '#334155',
};

export default function HomeScreen() {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [, setTick] = useState(0);

  // Reload data every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Tick every second to update the live session timer
  useEffect(() => {
    if (!activeEntry) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  async function loadData() {
    const [entries, active, s] = await Promise.all([
      loadEntries(),
      getActiveEntry(),
      loadSettings(),
    ]);
    setActiveEntry(active);
    setSettings(s);
    const now = new Date();
    const todayEntries = filterEntriesByRange(entries, getStartOfDay(now), getEndOfDay(now));
    const weekEntries = filterEntriesByRange(entries, getStartOfWeek(now), getEndOfWeek(now));
    setTodayHours(calculateTotalHours(todayEntries));
    setWeekHours(calculateTotalHours(weekEntries));
  }

  async function handleClockAction() {
    if (activeEntry) {
      await clockOut();
    } else {
      await clockIn();
    }
    await loadData();
  }

  const isClockedIn = activeEntry !== null;
  const sessionMs = activeEntry ? getEntryDurationMs(activeEntry) : 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Time Clock</Text>

        {/* Status card */}
        <View style={s.statusCard}>
          <View style={[s.dot, { backgroundColor: isClockedIn ? C.green : C.muted }]} />
          <Text style={[s.statusLabel, { color: isClockedIn ? C.green : C.muted }]}>
            {isClockedIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
          </Text>
          {isClockedIn && (
            <Text style={s.timer}>{formatDuration(sessionMs)}</Text>
          )}
        </View>

        {/* Big clock-in / clock-out button */}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: isClockedIn ? C.red : C.green }]}
          onPress={handleClockAction}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
        </TouchableOpacity>

        {/* Today + This week */}
        <View style={s.row}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>TODAY</Text>
            <Text style={s.summaryValue}>{formatHoursShort(todayHours)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>THIS WEEK</Text>
            <Text style={s.summaryValue}>{formatHoursShort(weekHours)}</Text>
          </View>
        </View>

        <Text style={s.rateHint}>
          Rate: ${settings.hourlyRate.toFixed(2)}/hr · See Weekly tab for pay estimate
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 32, textAlign: 'center' },
  statusCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: C.border,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginBottom: 8 },
  statusLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  timer: {
    fontSize: 42, fontWeight: '200', color: C.text,
    marginTop: 12, fontVariant: ['tabular-nums'],
  },
  btn: {
    borderRadius: 16, paddingVertical: 22, alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  btnText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  summaryValue: { fontSize: 22, fontWeight: '700', color: C.text },
  rateHint: { textAlign: 'center', color: C.muted, fontSize: 13, marginTop: 4 },
});
