import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadEntries, loadSettings, DEFAULT_SETTINGS } from '../utils/storage';
import {
  getStartOfWeek, getEndOfWeek, filterEntriesByRange,
  calculateTotalHours, calculatePay, getDailyBreakdown,
  formatHoursShort, formatMoney,
  getPeriodDeductionsAmount, getPeriodReimbursementsAmount,
} from '../utils/calculations';
import { Settings, PaySummary } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', text: '#F8FAFC',
  muted: '#94A3B8', border: '#334155', amber: '#F59E0B',
  purple: '#A855F7',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_PAY: PaySummary = {
  regularHours: 0, overtimeHours: 0, totalHours: 0,
  regularPay: 0, overtimePay: 0, grossPay: 0, totalPay: 0,
  taxAmount: 0, deductionsAmount: 0, reimbursementsAmount: 0, netPay: 0,
};

function fmtDateRange(start: Date, end: Date): string {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', o)} – ${end.toLocaleDateString('en-US', o)}`;
}

function getGoalMessage(actual: number, goal: number): { text: string; color: string } {
  const diff = actual - goal;
  const ratio = actual / goal;
  if (ratio >= 1.1) return { text: `You crushed it! $${diff.toFixed(2)} over your goal. Keep dominating!`, color: C.green };
  if (ratio >= 1.0) return { text: `Goal achieved! Right on target. Great discipline this week!`, color: C.green };
  if (ratio >= 0.9) return { text: `Almost there — just $${Math.abs(diff).toFixed(2)} short. So close!`, color: C.amber };
  if (ratio >= 0.7) return { text: `You're $${Math.abs(diff).toFixed(2)} short of your goal. Pick it up next time.`, color: C.red };
  return { text: `Way off — $${Math.abs(diff).toFixed(2)} short. This week was rough. Do better next week.`, color: C.red };
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
    const weeksPerPeriod = s.payPeriodType === 'biweekly' ? 2 : 1;
    const dedAmt = getPeriodDeductionsAmount(s.deductions ?? [], start, weeksPerPeriod);
    const reimbAmt = getPeriodReimbursementsAmount(s.reimbursements ?? [], start, weeksPerPeriod);
    setPay(calculatePay(hours, s.hourlyRate, s.overtimeThreshold, s, dedAmt, reimbAmt));
    setDaily(getDailyBreakdown(weekEntries, start));
  }

  const weekStart = getStartOfWeek();
  const weekEnd = getEndOfWeek();
  const maxBar = Math.max(...daily.map(d => d.hours), 8);
  const now = new Date();
  const todayDayIndex = ((now.getDay() + 6) % 7); // 0=Mon … 6=Sun

  function dayBarColor(hours: number): string {
    if (hours === 0) return 'transparent';
    if (hours > settings.overtimeThreshold / 5) return C.amber;
    return C.primary;
  }

  function dayTextColor(hours: number, dayIndex: number): string {
    const isPast = dayIndex < todayDayIndex;
    const isWorkDay = settings.workDays.includes((dayIndex + 1) % 7 === 0 ? 0 : dayIndex + 1);
    if (hours === 0 && isPast && isWorkDay) return C.red;
    return hours > 0 ? C.text : C.muted;
  }

  const totalTaxPct = settings.federalTaxRate + settings.stateTaxRate + settings.ficaTaxRate;
  const goal = settings.incomeGoal ?? 0;
  const goalMsg = goal > 0 ? getGoalMessage(pay.grossPay, goal) : null;

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
            <Text style={[s.payLabel, { color: C.red }]}>Taxes ({totalTaxPct.toFixed(2)}%)</Text>
            <Text style={[s.payAmt, { color: C.red }]}>−{formatMoney(pay.taxAmount)}</Text>
          </View>
          {pay.deductionsAmount > 0 && (
            <View style={s.payRow}>
              <Text style={[s.payLabel, { color: C.red }]}>Deductions</Text>
              <Text style={[s.payAmt, { color: C.red }]}>−{formatMoney(pay.deductionsAmount)}</Text>
            </View>
          )}
          {pay.reimbursementsAmount > 0 && (
            <View style={s.payRow}>
              <Text style={[s.payLabel, { color: C.green }]}>Reimbursements</Text>
              <Text style={[s.payAmt, { color: C.green }]}>+{formatMoney(pay.reimbursementsAmount)}</Text>
            </View>
          )}
          <View style={s.payRow}>
            <Text style={[s.payLabel, { fontWeight: '700', color: C.green }]}>Est. Take-Home</Text>
            <Text style={[s.payAmt, { fontWeight: '700', color: C.green }]}>{formatMoney(pay.netPay)}</Text>
          </View>
        </View>

        {/* Goal tracking */}
        {goal > 0 && (
          <View style={s.card}>
            <Text style={s.label}>GOAL VS ACTUAL</Text>
            <View style={s.payRow}>
              <Text style={s.payLabel}>Your Weekly Goal</Text>
              <Text style={[s.payAmt, { color: C.purple, fontWeight: '700' }]}>{formatMoney(goal)}</Text>
            </View>
            <View style={s.payRow}>
              <Text style={s.payLabel}>Actual (Gross)</Text>
              <Text style={[s.payAmt, { color: pay.grossPay >= goal ? C.green : C.red, fontWeight: '700' }]}>
                {formatMoney(pay.grossPay)}
              </Text>
            </View>
            <View style={s.goalTrack}>
              <View style={[s.goalBar, {
                width: `${Math.min((pay.grossPay / goal) * 100, 100)}%`,
                backgroundColor: pay.grossPay >= goal ? C.green : pay.grossPay >= goal * 0.7 ? C.amber : C.red,
              }]} />
            </View>
            <Text style={s.hint}>{Math.min(Math.round((pay.grossPay / goal) * 100), 999)}% of goal reached</Text>
            {goalMsg && (
              <View style={[s.goalMsg, { borderColor: goalMsg.color + '60', backgroundColor: goalMsg.color + '18' }]}>
                <Text style={[s.goalMsgText, { color: goalMsg.color }]}>{goalMsg.text}</Text>
              </View>
            )}
          </View>
        )}

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
                    backgroundColor: dayBarColor(day.hours),
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
  goalTrack: { height: 10, backgroundColor: '#334155', borderRadius: 5, overflow: 'hidden', marginTop: 12, marginBottom: 4 },
  goalBar: { height: '100%', borderRadius: 5 },
  goalMsg: { marginTop: 12, borderRadius: 10, padding: 12, borderWidth: 1 },
  goalMsgText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
