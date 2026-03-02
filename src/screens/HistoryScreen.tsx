import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadEntries, loadSettings, DEFAULT_SETTINGS } from '../utils/storage';
import {
  getStartOfWeek, filterEntriesByRange, calculateTotalHours, calculatePay,
  formatHoursShort, formatMoney,
} from '../utils/calculations';
import { Settings, PayPeriodRecord } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', text: '#F8FAFC', muted: '#94A3B8',
  border: '#334155', amber: '#F59E0B',
};

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const [periods, setPeriods] = useState<PayPeriodRecord[]>([]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    const [entries, s] = await Promise.all([loadEntries(), loadSettings()]);
    setPeriods(buildPeriods(entries, s));
  }

  function buildPeriods(entries: any[], s: Settings): PayPeriodRecord[] {
    const weeksPerPeriod = s.payPeriodType === 'biweekly' ? 2 : 1;
    const now = new Date();

    // For biweekly, align to fixed Monday reference (Jan 6, 2025)
    const ref = new Date('2025-01-06T00:00:00');
    let currentStart: Date;
    if (s.payPeriodType === 'biweekly') {
      const weeksSinceRef = Math.floor(
        (getStartOfWeek(now).getTime() - ref.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const periodsElapsed = Math.floor(weeksSinceRef / 2);
      currentStart = new Date(ref);
      currentStart.setDate(currentStart.getDate() + periodsElapsed * 14);
    } else {
      currentStart = getStartOfWeek(now);
    }

    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(currentStart);
      start.setDate(start.getDate() - i * 7 * weeksPerPeriod);

      const end = new Date(start);
      end.setDate(end.getDate() + 7 * weeksPerPeriod - 1);
      end.setHours(23, 59, 59, 999);

      const periodEntries = filterEntriesByRange(entries, start, end);
      const totalHours = calculateTotalHours(periodEntries);
      const summary = calculatePay(totalHours, s.hourlyRate);

      return {
        startDate: start.getTime(),
        endDate: end.getTime(),
        entries: periodEntries,
        summary,
        hourlyRate: s.hourlyRate,
      };
    });
  }

  function renderItem({ item, index }: { item: PayPeriodRecord; index: number }) {
    const isCurrent = index === 0;
    return (
      <View style={[s.card, isCurrent && s.currentCard]}>
        {isCurrent && <Text style={s.badge}>CURRENT PERIOD</Text>}
        <Text style={s.dateRange}>
          {fmtDate(item.startDate)} – {fmtDate(item.endDate)}
        </Text>
        <View style={s.row}>
          <View style={s.stat}>
            <Text style={s.statLabel}>HOURS</Text>
            <Text style={s.statValue}>{formatHoursShort(item.summary.totalHours)}</Text>
          </View>
          <View style={s.sep} />
          <View style={s.stat}>
            <Text style={s.statLabel}>OVERTIME</Text>
            <Text style={[s.statValue, item.summary.overtimeHours > 0 && { color: C.amber }]}>
              {formatHoursShort(item.summary.overtimeHours)}
            </Text>
          </View>
          <View style={s.sep} />
          <View style={s.stat}>
            <Text style={s.statLabel}>PAY</Text>
            <Text style={[s.statValue, { color: C.green }]}>{formatMoney(item.summary.totalPay)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <FlatList
        data={periods}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.title}>Pay History</Text>}
        ListEmptyComponent={
          <Text style={s.empty}>No history yet.{'\n'}Start clocking in!</Text>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 24 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: C.border,
  },
  currentCard: { borderColor: C.primary },
  badge: { color: C.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  dateRange: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '700', color: C.text },
  sep: { width: 1, height: 36, backgroundColor: C.border },
  empty: { color: C.muted, textAlign: 'center', marginTop: 60, fontSize: 16, lineHeight: 26 },
});
