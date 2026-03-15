import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Pressable, Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  loadEntries, loadSettings, DEFAULT_SETTINGS,
  loadExtraIncome, saveExtraIncomeForPeriod,
  deleteEntry, updateEntry, addManualEntry,
} from '../utils/storage';
import {
  getStartOfWeek, filterEntriesByRange, calculateTotalHours, calculatePay,
  formatHoursShort, formatMoney, getEntryDurationMs,
  getPeriodDeductionsAmount, getPeriodReimbursementsAmount,
} from '../utils/calculations';
import { Settings, PayPeriodRecord, TimeEntry } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', text: '#F8FAFC',
  muted: '#94A3B8', border: '#334155', amber: '#F59E0B',
};

// ── Date/time helpers ─────────────────────────────────────────────────────────

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Format timestamp → "YYYY-MM-DD" */
function toDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format timestamp → "HH:MM" (24h) */
function toTimeStr(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Parse "YYYY-MM-DD" + "HH:MM" → timestamp, or null if invalid */
function parseDT(date: string, time: string): number | null {
  const dp = date.trim().split('-').map(Number);
  const tp = time.trim().split(':').map(Number);
  if (dp.length !== 3 || tp.length !== 2) return null;
  if (dp.some(isNaN) || tp.some(isNaN)) return null;
  const d = new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1]);
  return isNaN(d.getTime()) ? null : d.getTime();
}

// ── Day grouping ──────────────────────────────────────────────────────────────

function groupByDay(entries: TimeEntry[]): Array<{ label: string; entries: TimeEntry[] }> {
  const map = new Map<string, { label: string; entries: TimeEntry[] }>();
  [...entries].sort((a, b) => a.clockIn - b.clockIn).forEach(e => {
    const d = new Date(e.clockIn);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) {
      map.set(key, {
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        entries: [],
      });
    }
    map.get(key)!.entries.push(e);
  });
  return Array.from(map.values());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DTField({
  label, dateVal, timeVal, onDateChange, onTimeChange,
}: {
  label: string;
  dateVal: string;
  timeVal: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={m.fieldLabel}>{label}</Text>
      <View style={m.dtRow}>
        <TextInput
          style={[m.dtInput, { flex: 1.4 }]}
          value={dateVal}
          onChangeText={onDateChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.muted}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <TextInput
          style={[m.dtInput, { flex: 1, marginLeft: 8 }]}
          value={timeVal}
          onChangeText={onTimeChange}
          placeholder="HH:MM"
          placeholderTextColor={C.muted}
          keyboardType="numbers-and-punctuation"
        />
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type PeriodKey = string;

export default function HistoryScreen() {
  const [periods, setPeriods] = useState<PayPeriodRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [expanded, setExpanded] = useState<PeriodKey | null>(null);

  // Extra income modal
  const [extraModal, setExtraModal] = useState(false);
  const [editingPeriodKey, setEditingPeriodKey] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraNote, setExtraNote] = useState('');

  // Edit entry modal
  const [editModal, setEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editInDate, setEditInDate] = useState('');
  const [editInTime, setEditInTime] = useState('');
  const [editOutDate, setEditOutDate] = useState('');
  const [editOutTime, setEditOutTime] = useState('');
  const [editNote, setEditNote] = useState('');

  // Add entry modal
  const [addModal, setAddModal] = useState(false);
  const [addInDate, setAddInDate] = useState('');
  const [addInTime, setAddInTime] = useState('');
  const [addOutDate, setAddOutDate] = useState('');
  const [addOutTime, setAddOutTime] = useState('');
  const [addNote, setAddNote] = useState('');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    const [entries, s, extraIncome] = await Promise.all([
      loadEntries(), loadSettings(), loadExtraIncome(),
    ]);
    setSettings(s);
    setPeriods(buildPeriods(entries, s, extraIncome));
  }

  function buildPeriods(
    entries: TimeEntry[],
    s: Settings,
    extraIncome: Record<string, { amount: number; note: string }>
  ): PayPeriodRecord[] {
    const weeksPerPeriod = s.payPeriodType === 'biweekly' ? 2 : 1;
    const now = new Date();
    const ref = new Date('2025-01-06T00:00:00');
    let currentStart: Date;

    if (s.payPeriodType === 'biweekly') {
      const weeksSinceRef = Math.floor(
        (getStartOfWeek(now).getTime() - ref.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      currentStart = new Date(ref.getTime() + Math.floor(weeksSinceRef / 2) * 14 * 24 * 60 * 60 * 1000);
    } else {
      currentStart = getStartOfWeek(now);
    }

    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(currentStart);
      start.setDate(start.getDate() - i * 7 * weeksPerPeriod);
      const end = new Date(start);
      end.setDate(end.getDate() + 7 * weeksPerPeriod - 1);
      end.setHours(23, 59, 59, 999);

      const key = start.getTime().toString();
      const periodEntries = filterEntriesByRange(entries, start, end);
      const totalHours = calculateTotalHours(periodEntries);
      const dedAmt = getPeriodDeductionsAmount(s.deductions ?? [], start, weeksPerPeriod);
      const reimbAmt = getPeriodReimbursementsAmount(s.reimbursements ?? [], start, weeksPerPeriod);
      const summary = calculatePay(totalHours, s.hourlyRate, s.overtimeThreshold, s, dedAmt, reimbAmt);
      const extra = extraIncome[key] ?? { amount: 0, note: '' };

      return {
        startDate: start.getTime(),
        endDate: end.getTime(),
        entries: periodEntries,
        summary,
        hourlyRate: s.hourlyRate,
        extraIncome: extra.amount,
        extraIncomeNote: extra.note,
      };
    });
  }

  // ── Extra income ────────────────────────────────────────────────────────────

  function openExtraModal(period: PayPeriodRecord) {
    setEditingPeriodKey(period.startDate.toString());
    setExtraAmount(period.extraIncome > 0 ? period.extraIncome.toFixed(2) : '');
    setExtraNote(period.extraIncomeNote);
    setExtraModal(true);
  }

  async function saveExtra() {
    const amt = parseFloat(extraAmount) || 0;
    await saveExtraIncomeForPeriod(editingPeriodKey, amt, extraNote.trim());
    setExtraModal(false);
    await loadData();
  }

  // ── Edit entry ──────────────────────────────────────────────────────────────

  function openEditEntry(entry: TimeEntry) {
    setEditingEntry(entry);
    setEditInDate(toDateStr(entry.clockIn));
    setEditInTime(toTimeStr(entry.clockIn));
    setEditOutDate(entry.clockOut ? toDateStr(entry.clockOut) : '');
    setEditOutTime(entry.clockOut ? toTimeStr(entry.clockOut) : '');
    setEditNote(entry.note ?? '');
    setEditModal(true);
  }

  async function saveEditEntry() {
    if (!editingEntry) return;
    const newIn = parseDT(editInDate, editInTime);
    if (!newIn) {
      Alert.alert('Invalid', 'Clock-in date/time is invalid.\nUse YYYY-MM-DD and HH:MM (24h).');
      return;
    }
    let newOut: number | null = editingEntry.clockOut;
    if (editOutDate.trim() && editOutTime.trim()) {
      const parsed = parseDT(editOutDate, editOutTime);
      if (!parsed) {
        Alert.alert('Invalid', 'Clock-out date/time is invalid.\nUse YYYY-MM-DD and HH:MM (24h).');
        return;
      }
      if (parsed <= newIn) {
        Alert.alert('Invalid', 'Clock-out must be after clock-in.');
        return;
      }
      newOut = parsed;
    } else if (!editOutDate.trim() && !editOutTime.trim()) {
      newOut = null; // keep as active
    }
    const updated: TimeEntry = {
      ...editingEntry,
      clockIn: newIn,
      clockOut: newOut,
      note: editNote.trim() || undefined,
    };
    await updateEntry(updated);
    setEditModal(false);
    await loadData();
  }

  // ── Add entry ───────────────────────────────────────────────────────────────

  function openAddEntry(period: PayPeriodRecord) {
    const defaultDate = toDateStr(period.startDate);
    setAddInDate(defaultDate);
    setAddInTime('09:00');
    setAddOutDate(defaultDate);
    setAddOutTime('17:00');
    setAddNote('');
    setAddModal(true);
  }

  async function saveAddEntry() {
    const newIn = parseDT(addInDate, addInTime);
    if (!newIn) {
      Alert.alert('Invalid', 'Clock-in date/time is invalid.\nUse YYYY-MM-DD and HH:MM (24h).');
      return;
    }
    let newOut: number | null = null;
    if (addOutDate.trim() && addOutTime.trim()) {
      const parsed = parseDT(addOutDate, addOutTime);
      if (!parsed) {
        Alert.alert('Invalid', 'Clock-out date/time is invalid.\nUse YYYY-MM-DD and HH:MM (24h).');
        return;
      }
      if (parsed <= newIn) {
        Alert.alert('Invalid', 'Clock-out must be after clock-in.');
        return;
      }
      newOut = parsed;
    }
    const entry: TimeEntry = {
      id: Date.now().toString(),
      clockIn: newIn,
      clockOut: newOut,
      breaks: [],
      note: addNote.trim() || undefined,
    };
    await addManualEntry(entry);
    setAddModal(false);
    await loadData();
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function confirmDelete(entry: TimeEntry) {
    Alert.alert(
      'Delete Entry',
      `Delete the entry from ${fmtDate(entry.clockIn)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => { await deleteEntry(entry.id); await loadData(); },
        },
      ]
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.list}>
        <Text style={s.title}>Pay History</Text>

        {periods.map((period, index) => {
          const key = period.startDate.toString();
          const isCurrent = index === 0;
          const isExp = expanded === key;
          const totalWithExtra = period.summary.netPay + period.extraIncome;
          const totalTaxPct = settings.federalTaxRate + settings.stateTaxRate + settings.ficaTaxRate;
          const dayGroups = groupByDay(period.entries);

          return (
            <View key={key} style={[s.card, isCurrent && s.currentCard]}>
              {isCurrent && <Text style={s.badge}>CURRENT PERIOD</Text>}
              <TouchableOpacity onPress={() => setExpanded(isExp ? null : key)}>
                <Text style={s.dateRange}>
                  {fmtDate(period.startDate)} – {fmtDate(period.endDate)}
                  {'  '}<Text style={s.expandHint}>{isExp ? '▲' : '▼'}</Text>
                </Text>

                <View style={s.statsRow}>
                  <View style={s.stat}>
                    <Text style={s.statLabel}>HOURS</Text>
                    <Text style={s.statValue}>{formatHoursShort(period.summary.totalHours)}</Text>
                  </View>
                  <View style={s.sep} />
                  <View style={s.stat}>
                    <Text style={s.statLabel}>OVERTIME</Text>
                    <Text style={[s.statValue, period.summary.overtimeHours > 0 && { color: C.amber }]}>
                      {formatHoursShort(period.summary.overtimeHours)}
                    </Text>
                  </View>
                  <View style={s.sep} />
                  <View style={s.stat}>
                    <Text style={s.statLabel}>GROSS</Text>
                    <Text style={[s.statValue, { color: C.text }]}>{formatMoney(period.summary.grossPay)}</Text>
                  </View>
                </View>

                {period.summary.deductionsAmount > 0 && (
                  <View style={s.netRow}>
                    <Text style={[s.netLabel, { color: C.red }]}>− Deductions:</Text>
                    <Text style={[s.netValue, { color: C.red }]}>−{formatMoney(period.summary.deductionsAmount)}</Text>
                  </View>
                )}
                {period.summary.reimbursementsAmount > 0 && (
                  <View style={s.netRow}>
                    <Text style={[s.netLabel, { color: C.green }]}>+ Reimbursements:</Text>
                    <Text style={[s.netValue, { color: C.green }]}>+{formatMoney(period.summary.reimbursementsAmount)}</Text>
                  </View>
                )}
                <View style={s.netRow}>
                  <Text style={s.netLabel}>After taxes ({totalTaxPct.toFixed(1)}%):</Text>
                  <Text style={[s.netValue, { color: C.green }]}>{formatMoney(period.summary.netPay)}</Text>
                </View>
                {period.extraIncome > 0 && (
                  <View style={s.netRow}>
                    <Text style={s.netLabel}>+ Extra income:</Text>
                    <Text style={[s.netValue, { color: C.green }]}>{formatMoney(period.extraIncome)}</Text>
                  </View>
                )}
                {period.extraIncome > 0 && (
                  <View style={s.netRow}>
                    <Text style={[s.netLabel, { fontWeight: '700', color: C.text }]}>Est. Check Total:</Text>
                    <Text style={[s.netValue, { fontWeight: '700', color: C.green }]}>{formatMoney(totalWithExtra)}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={s.extraBtn} onPress={() => openExtraModal(period)}>
                <Text style={s.extraBtnText}>
                  {period.extraIncome > 0
                    ? `✏️ Edit Extra Income (${formatMoney(period.extraIncome)})`
                    : '+ Add Extra Income / Reimbursement'}
                </Text>
              </TouchableOpacity>

              {/* Expanded entries grouped by day */}
              {isExp && (
                <View style={s.entriesSection}>
                  <View style={s.divider} />
                  <Text style={[s.statLabel, { marginBottom: 10 }]}>ENTRIES</Text>

                  {period.entries.length === 0 && (
                    <Text style={s.emptyEntries}>No entries this period.</Text>
                  )}

                  {dayGroups.map(group => (
                    <View key={group.label}>
                      <Text style={s.dayGroupLabel}>{group.label}</Text>
                      {group.entries.map(entry => (
                        <View key={entry.id} style={s.entryRow}>
                          <View style={s.entryInfo}>
                            <Text style={s.entryTime}>
                              {fmtTime(entry.clockIn)} → {entry.clockOut ? fmtTime(entry.clockOut) : 'active'}
                            </Text>
                            <Text style={s.entryDuration}>
                              {entry.clockOut
                                ? formatHoursShort(getEntryDurationMs(entry) / 3600000)
                                : 'running'}
                              {entry.breaks.length > 0 && ` · ${entry.breaks.length} break${entry.breaks.length > 1 ? 's' : ''}`}
                            </Text>
                            {entry.note ? <Text style={s.entryNote}>"{entry.note}"</Text> : null}
                          </View>
                          <View style={s.entryBtns}>
                            <TouchableOpacity style={s.editBtn} onPress={() => openEditEntry(entry)}>
                              <Text style={s.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.deleteBtn} onPress={() => confirmDelete(entry)}>
                              <Text style={s.deleteBtnText}>Del</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}

                  <TouchableOpacity style={s.addEntryBtn} onPress={() => openAddEntry(period)}>
                    <Text style={s.addEntryBtnText}>+ Add Entry Manually</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Extra income modal */}
      <Modal visible={extraModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Extra Income</Text>
            <Text style={s.modalSub}>Reimbursements, bonuses, etc.</Text>
            <View style={s.amtRow}>
              <Text style={s.dollar}>$</Text>
              <TextInput
                style={s.amtInput}
                value={extraAmount}
                onChangeText={setExtraAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.muted}
                selectTextOnFocus
                autoFocus
              />
            </View>
            <TextInput
              style={s.noteInput}
              value={extraNote}
              onChangeText={setExtraNote}
              placeholder="Description (e.g. mileage reimbursement)"
              placeholderTextColor={C.muted}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setExtraModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={saveExtra}>
                <Text style={s.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit entry modal */}
      <Modal visible={editModal} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.overlay} onPress={Keyboard.dismiss}>
            <Pressable>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Edit Entry</Text>
                <Text style={s.modalSub}>Date: YYYY-MM-DD  ·  Time: HH:MM (24h)</Text>
                <DTField
                  label="CLOCK IN"
                  dateVal={editInDate} timeVal={editInTime}
                  onDateChange={setEditInDate} onTimeChange={setEditInTime}
                />
                <DTField
                  label="CLOCK OUT  (leave blank if active)"
                  dateVal={editOutDate} timeVal={editOutTime}
                  onDateChange={setEditOutDate} onTimeChange={setEditOutTime}
                />
                <Text style={m.fieldLabel}>NOTE</Text>
                <TextInput
                  style={s.noteInput}
                  value={editNote}
                  onChangeText={setEditNote}
                  placeholder="Optional note"
                  placeholderTextColor={C.muted}
                />
                <View style={[s.modalBtns, { marginTop: 16 }]}>
                  <TouchableOpacity style={s.modalCancel} onPress={() => setEditModal(false)}>
                    <Text style={s.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalConfirm} onPress={saveEditEntry}>
                    <Text style={s.modalConfirmText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add entry modal */}
      <Modal visible={addModal} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.overlay} onPress={Keyboard.dismiss}>
            <Pressable>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Add Entry</Text>
                <Text style={s.modalSub}>Date: YYYY-MM-DD  ·  Time: HH:MM (24h)</Text>
                <DTField
                  label="CLOCK IN"
                  dateVal={addInDate} timeVal={addInTime}
                  onDateChange={setAddInDate} onTimeChange={setAddInTime}
                />
                <DTField
                  label="CLOCK OUT  (leave blank for active)"
                  dateVal={addOutDate} timeVal={addOutTime}
                  onDateChange={setAddOutDate} onTimeChange={setAddOutTime}
                />
                <Text style={m.fieldLabel}>NOTE</Text>
                <TextInput
                  style={s.noteInput}
                  value={addNote}
                  onChangeText={setAddNote}
                  placeholder="Optional note"
                  placeholderTextColor={C.muted}
                />
                <View style={[s.modalBtns, { marginTop: 16 }]}>
                  <TouchableOpacity style={s.modalCancel} onPress={() => setAddModal(false)}>
                    <Text style={s.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.modalConfirm, { backgroundColor: C.green }]} onPress={saveAddEntry}>
                    <Text style={s.modalConfirmText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── DTField styles ────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.2, marginBottom: 6 },
  dtRow: { flexDirection: 'row' },
  dtInput: {
    backgroundColor: C.bg, borderRadius: 8, padding: 10,
    color: C.text, fontSize: 15, fontWeight: '600',
    borderWidth: 1, borderColor: C.border,
  },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 24 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  currentCard: { borderColor: C.primary },
  badge: { color: C.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  dateRange: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 14 },
  expandHint: { fontSize: 12, color: C.muted },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '700', color: C.text },
  sep: { width: 1, height: 36, backgroundColor: C.border },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  netLabel: { color: C.muted, fontSize: 13 },
  netValue: { fontSize: 13, fontWeight: '600' },
  extraBtn: {
    marginTop: 12, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  extraBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  entriesSection: { marginTop: 4 },
  emptyEntries: { color: C.muted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  dayGroupLabel: {
    color: C.primary, fontSize: 12, fontWeight: '700',
    letterSpacing: 0.5, marginTop: 10, marginBottom: 4,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  entryInfo: { flex: 1 },
  entryTime: { color: C.text, fontSize: 13, fontWeight: '600' },
  entryDuration: { color: C.muted, fontSize: 12, marginTop: 2 },
  entryNote: { color: C.muted, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  entryBtns: { flexDirection: 'row', gap: 8 },
  editBtn: { backgroundColor: '#1D4ED8', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#7F1D1D', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  addEntryBtn: {
    marginTop: 14, borderWidth: 1, borderColor: C.green,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  addEntryBtnText: { color: C.green, fontSize: 13, fontWeight: '600' },
  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 6 },
  modalSub: { fontSize: 12, color: C.muted, marginBottom: 14 },
  amtRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dollar: { fontSize: 28, color: C.text, marginRight: 4 },
  amtInput: { flex: 1, fontSize: 28, fontWeight: '700', color: C.text, backgroundColor: C.bg, borderRadius: 8, padding: 8 },
  noteInput: {
    backgroundColor: C.bg, borderRadius: 10, padding: 12,
    color: C.text, fontSize: 14, borderWidth: 1, borderColor: C.border,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  modalCancelText: { color: C.muted, fontSize: 16, fontWeight: '600' },
  modalConfirm: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: C.primary },
  modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
