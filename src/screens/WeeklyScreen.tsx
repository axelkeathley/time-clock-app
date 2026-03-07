import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadEntries, loadSettings, DEFAULT_SETTINGS } from '../utils/storage';
import {
  getStartOfWeek, getEndOfWeek, filterEntriesByRange,
  calculateTotalHours, calculatePay, getDailyBreakdown,
  formatHoursShort, formatMoney,
} from '../utils/calculations';
import { Settings, PaySummary } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', text: '#F8FAFC',
  muted: '#94A3B8', border: '#334155', amber: '#F59E0B',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_PAY: PaySummary = {
  regularHours: 0, overtimeHours: 0, totalHours: 0,
  regularPay: 0, overtimePay: 0, grossPay: 0, totalPay: 0,
  taxAmount: 0, netPay: 0,
};

function fmtDateRange(start: Date, end: Date): string {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', o)} – ${end.toLocaleDateString('en-US', o)}`;
}

export default function WeeklyScreen() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [pay, setPay] = useState<PaySummary>(EMPTY_PAY);
  const [daily, setDaily] = useState<Array<{ date: Date; hours: number }>>([]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    const [entries, s] = await Promise.all([loadEntries(), loadSettings()]);
    setSettings(s);
    const now = new Date();
    const start = getStartOfWeek(now);
    const end = getEndOfWeek(now);
    const weekEntries = filterEntriesByRange(entries, start, end);
    const hours = calculateTotalHours(weekEntries);
    setPay(calculatePay(hours, s.hourlyRate, s.overtimeThreshold, s));
    setDaily(getDailyBreakdown(weekEntries, start));
  }

  const weekStart = getStartOfWeek();
  const weekEnd = getEndOfWeek();
  const maxBar = Math.max(...daily.map(d => d.hours), 8);
  const now = new Date();
  const todayDayIndex = ((now.getDay() + 6) % 7); // 0=Mon … 6=Sun

  function dayBarColor(hours: number, dayIndex: number): string {
    if (hours === 0) return 'transparent';
    if (hours > settings.overtimeThreshold / 5) return C.amber; // OT day
    return C.primary;
  }

  function dayTextColor(hours: number, dayIndex: number): string {
    const isPast = dayIndex < todayDayIndex;
    const isWorkDay = settings.workDays.includes((dayIndex + 1) % 7 === 0 ? 0 : dayIndex + 1);
    if (hours === 0 && isPast && isWorkDay) return C.red;
    return hours > 0 ? C.text : C.muted;
  }

  const totalTaxPct = settings.federalTaxRate + settings.stateTaxRate + settings.ficaTaxRate;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>This Week</Text>
        <Text style={s.subtitle}>{fmtDateRange(weekStart, weekEnd)}</Text>

        {/* Total hours */}
        <View style={s.card}>
          <Text style={s.label}>TOTAL HOURS</Text>
          <Text style={s.big}>{formatHoursShort(pay.totalHours)}</Text>
          {pay.overtimeHours > 0 && (
            <Text style={[s.hint, { color: C.amber }]}>
              {formatHoursShort(pay.overtimeHours)} overtime @ 1.5×
            </Text>
          )}
        </View>

        {/* Pay breakdown */}
        <View style={s.card}>
          <Text style={s.label}>ESTIMATED PAY</Text>
          <Text style={[s.big, { color: C.green }]}>{formatMoney(pay.grossPay)}</Text>
          <Text style={s.hint}>gross · at ${settings.hourlyRate.toFixed(2)}/hr</Text>

          <View style={s.divider} />

          <View style={s.payRow}>
            <Text style={s.payLabel}>Regular ({formatHoursShort(pay.regularHours)})</Text>
            <Text style={s.payAmt}>{formatMoney(pay.regularPay)}</Text>
          </View>
          {pay.overtimeHours > 0 && (
            <View style={s.payRow}>
              <Text style={[s.payLabel, { color: C.amber }]}>
                Overtime ({formatHoursShort(pay.overtimeHours)} @ 1.5×)
              </Text>
              <Text style={[s.payAmt, { color: C.amber }]}>{formatMoney(pay.overtimePay)}</Text>
            </View>
          )}
          <View style={s.payRow}>
            <Text style={[s.payLabel, { fontWeight: '700', color: C.text }]}>Gross Total</Text>
            <Text style={[s.payAmt, { fontWeight: '700', color: C.text }]}>{formatMoney(pay.grossPay)}</Text>
          </View>

          <View style={s.divider} />

          <View style={s.payRow}>
            <Text style={[s.payLabel, { color: C.red }]}>
              Taxes ({totalTaxPct.toFixed(2)}%)
            </Text>
            <Text style={[s.payAmt, { color: C.red }]}>−{formatMoney(pay.taxAmount)}</Text>
          </View>
          <View style={s.payRow}>
            <Text style={[s.payLabel, { fontWeight: '700', color: C.green }]}>Est. Take-Home</Text>
            <Text style={[s.payAmt, { fontWeight: '700', color: C.green }]}>{formatMoney(pay.netPay)}</Text>
          </View>
        </View>

        {/* Daily bar chart */}
        <View style={s.card}>
          <Text style={s.label}>DAILY BREAKDOWN</Text>
          {daily.map((day, i) => (
            <View key={i} style={s.dayRow}>
              <Text style={[s.dayName, { color: i === todayDayIndex ? C.primary : C.muted }]}>
                {DAY_NAMES[i]}
              </Text>
              <View style={s.track}>
                {day.hours > 0 && (
                  <View style={[s.bar, {
                    width: `${Math.min((day.hours / maxBar) * 100, 100)}%`,
                    backgroundColor: dayBarColor(day.hours, i),
                  }]} />
                )}
              </View>
              <Text style={[s.dayHrs, { color: dayTextColor(day.hours, i) }]}>
                {day.hours > 0 ? formatHoursShort(day.hours) : '—'}
              </Text>
            </View>
          ))}
          <Text style={[s.hint, { marginTop: 8 }]}>
            Red = missed work day · Amber = overtime day
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.muted, marginBottom: 24 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  big: { fontSize: 36, fontWeight: '700', color: C.text },
  hint: { color: C.muted, fontSize: 13, marginTop: 4 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  payLabel: { color: C.muted, fontSize: 14 },
  payAmt: { color: C.text, fontSize: 14 },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dayName: { fontSize: 13, width: 36 },
  track: { flex: 1, height: 8, backgroundColor: '#334155', borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  dayHrs: { fontSize: 12, width: 58, textAlign: 'right' },
});
