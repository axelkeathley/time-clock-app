import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  loadEntries, loadSettings, clockIn, clockOut,
  breakOut, breakIn, getActiveEntry, DEFAULT_SETTINGS,
} from '../utils/storage';
import {
  calculateTotalHours, filterEntriesByRange,
  getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek,
  formatHoursShort, formatDuration, formatMoney,
  getEntryDurationMs, calculatePay, calculateStreak,
} from '../utils/calculations';
import { TimeEntry, Settings } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', amber: '#F59E0B',
  blue: '#60A5FA', text: '#F8FAFC', muted: '#94A3B8',
  border: '#334155', orange: '#FB923C',
};

export default function HomeScreen() {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [streak, setStreak] = useState(0);
  const [periodEarnings, setPeriodEarnings] = useState(0);
  const [, setTick] = useState(0);
  const [noteModal, setNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  useEffect(() => {
    if (!activeEntry) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  async function loadData() {
    const [entries, active, s] = await Promise.all([
      loadEntries(), getActiveEntry(), loadSettings(),
    ]);
    setActiveEntry(active);
    setSettings(s);
    const now = new Date();
    setTodayHours(calculateTotalHours(
      filterEntriesByRange(entries, getStartOfDay(now), getEndOfDay(now))
    ));
    setWeekHours(calculateTotalHours(
      filterEntriesByRange(entries, getStartOfWeek(now), getEndOfWeek(now))
    ));
    setStreak(calculateStreak(entries));

    // Current pay period earnings
    const weeksPerPeriod = s.payPeriodType === 'biweekly' ? 2 : 1;
    let periodStart = getStartOfWeek(now);
    if (s.payPeriodType === 'biweekly') {
      const ref = new Date('2025-01-06T00:00:00');
      const weeksSinceRef = Math.floor(
        (periodStart.getTime() - ref.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const periodsElapsed = Math.floor(weeksSinceRef / 2);
      periodStart = new Date(ref.getTime() + periodsElapsed * 14 * 24 * 60 * 60 * 1000);
    }
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 7 * weeksPerPeriod - 1);
    periodEnd.setHours(23, 59, 59, 999);
    const periodHours = calculateTotalHours(filterEntriesByRange(entries, periodStart, periodEnd));
    const pay = calculatePay(periodHours, s.hourlyRate, s.overtimeThreshold, s);
    setPeriodEarnings(pay.grossPay);
  }

  const isOnBreak = activeEntry !== null &&
    activeEntry.breaks.some(b => b.breakIn === null);
  const isClockedIn = activeEntry !== null;

  const workedMs = activeEntry ? getEntryDurationMs(activeEntry) : 0;
  const activeBreak = activeEntry?.breaks.find(b => b.breakIn === null);
  const breakMs = activeBreak ? Date.now() - activeBreak.breakOut : 0;

  function handleClockOut() {
    setNoteText('');
    setNoteModal(true);
  }

  async function confirmClockOut() {
    setNoteModal(false);
    await clockOut(noteText.trim() || undefined);
    await loadData();
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Streak banner */}
        {streak > 0 && (
          <View style={s.streakRow}>
            <Text style={s.streakFlame}>🔥</Text>
            <Text style={s.streakCount}>{streak}</Text>
            <Text style={s.streakLabel}>
              {streak === 1 ? 'day streak' : 'day streak'} — keep it up!
            </Text>
          </View>
        )}

        <Text style={s.title}>Time Clock</Text>

        {/* Status card */}
        <View style={s.statusCard}>
          <View style={[s.dot, {
            backgroundColor: isOnBreak ? C.amber : isClockedIn ? C.green : C.muted,
          }]} />
          <Text style={[s.statusLabel, {
            color: isOnBreak ? C.amber : isClockedIn ? C.green : C.muted,
          }]}>
            {isOnBreak ? 'ON BREAK' : isClockedIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
          </Text>
          {isClockedIn && (
            <Text style={s.timer}>{formatDuration(workedMs)}</Text>
          )}
          {isOnBreak && (
            <Text style={s.breakTimer}>Break: {formatDuration(breakMs)}</Text>
          )}
        </View>

        {/* Buttons */}
        {!isClockedIn && (
          <TouchableOpacity style={[s.btn, { backgroundColor: C.green }]}
            onPress={async () => { await clockIn(); await loadData(); }} activeOpacity={0.85}>
            <Text style={s.btnText}>Clock In</Text>
          </TouchableOpacity>
        )}

        {isClockedIn && !isOnBreak && (
          <View style={s.btnRow}>
            <TouchableOpacity style={[s.btn, s.btnFlex, { backgroundColor: C.red }]}
              onPress={handleClockOut} activeOpacity={0.85}>
              <Text style={s.btnText}>Clock Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnFlex, { backgroundColor: C.amber }]}
              onPress={async () => { await breakOut(); await loadData(); }} activeOpacity={0.85}>
              <Text style={s.btnText}>Break</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOnBreak && (
          <TouchableOpacity style={[s.btn, { backgroundColor: C.blue }]}
            onPress={async () => { await breakIn(); await loadData(); }} activeOpacity={0.85}>
            <Text style={s.btnText}>End Break</Text>
          </TouchableOpacity>
        )}

        {/* Summary */}
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

        <View style={[s.summaryCard, { flex: 0 }]}>
          <Text style={s.summaryLabel}>
            {settings.payPeriodType === 'biweekly' ? 'BI-WEEKLY' : 'WEEKLY'} EARNINGS (GROSS)
          </Text>
          <Text style={[s.summaryValue, { color: C.green, fontSize: 28 }]}>
            {formatMoney(periodEarnings)}
          </Text>
          <Text style={[s.summaryLabel, { marginTop: 4 }]}>
            ${settings.hourlyRate.toFixed(2)}/hr · see Weekly tab for full breakdown
          </Text>
        </View>

      </ScrollView>

      {/* Clock-out note modal */}
      <Modal visible={noteModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Clock Out</Text>
            <Text style={s.modalSub}>Add a note? (optional)</Text>
            <TextInput
              style={s.modalInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="e.g. Worked late, covered for John…"
              placeholderTextColor={C.muted}
              multiline
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setNoteModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={confirmClockOut}>
                <Text style={s.modalConfirmText}>Clock Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24 },
  streakRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#431407', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  streakFlame: { fontSize: 24, marginRight: 6 },
  streakCount: { fontSize: 22, fontWeight: '800', color: C.orange, marginRight: 6 },
  streakLabel: { fontSize: 14, color: C.orange, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 24, textAlign: 'center' },
  statusCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginBottom: 8 },
  statusLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  timer: { fontSize: 42, fontWeight: '200', color: C.text, marginTop: 12, fontVariant: ['tabular-nums'] },
  breakTimer: { fontSize: 16, color: C.amber, marginTop: 6, fontVariant: ['tabular-nums'] },
  btn: {
    borderRadius: 16, paddingVertical: 22, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  btnFlex: { flex: 1 },
  btnText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 6 },
  summaryValue: { fontSize: 22, fontWeight: '700', color: C.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 6 },
  modalSub: { fontSize: 14, color: C.muted, marginBottom: 14 },
  modalInput: {
    backgroundColor: C.bg, borderRadius: 10, padding: 12, color: C.text,
    fontSize: 15, minHeight: 80, borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  modalCancelText: { color: C.muted, fontSize: 16, fontWeight: '600' },
  modalConfirm: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: C.red },
  modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
