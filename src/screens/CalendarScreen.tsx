import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadEntries, loadSettings, DEFAULT_SETTINGS } from '../utils/storage';
import {
  filterEntriesByRange, calculateTotalHours, calculatePay,
  getStartOfDay, getEndOfDay, formatMoney,
} from '../utils/calculations';
import { Settings, TimeEntry } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', text: '#F8FAFC',
  muted: '#94A3B8', border: '#334155', amber: '#F59E0B',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useFocusEffect(useCallback(() => {
    Promise.all([loadEntries(), loadSettings()]).then(([e, s]) => {
      setEntries(e);
      setSettings(s);
    });
  }, []));

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Build cells: null = padding, number = day of month
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const nowTs = today.getTime();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  function getDayData(day: number) {
    const date = new Date(year, month, day);
    const dayEntries = filterEntriesByRange(
      entries, getStartOfDay(date), getEndOfDay(date)
    ).filter(e => e.clockOut !== null);
    const hours = calculateTotalHours(dayEntries);
    const pay = hours > 0
      ? calculatePay(hours, settings.hourlyRate, settings.overtimeThreshold, settings).grossPay
      : 0;
    return { hours, pay, hasEntries: dayEntries.length > 0 };
  }

  function isWorkDay(day: number): boolean {
    return settings.workDays.includes(new Date(year, month, day).getDay());
  }

  function isFutureDay(day: number): boolean {
    const d = new Date(year, month, day);
    d.setHours(23, 59, 59, 999);
    return d.getTime() > nowTs;
  }

  // Compute month summary
  let monthHours = 0;
  let monthPay = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const { hours, pay } = getDayData(d);
    monthHours += hours;
    monthPay += pay;
  }

  // Chunk into weeks
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Calendar</Text>

        {/* Month navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <Text style={s.navArrow}>◀</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <Text style={s.navArrow}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* Month summary */}
        {monthHours > 0 && (
          <View style={s.summaryRow}>
            <View style={s.summaryChip}>
              <Text style={s.summaryChipLabel}>MONTH HOURS</Text>
              <Text style={s.summaryChipValue}>
                {Math.floor(monthHours)}h {Math.round((monthHours % 1) * 60)}m
              </Text>
            </View>
            <View style={s.summaryChip}>
              <Text style={s.summaryChipLabel}>MONTH GROSS</Text>
              <Text style={[s.summaryChipValue, { color: C.green }]}>{formatMoney(monthPay)}</Text>
            </View>
          </View>
        )}

        {/* Calendar grid */}
        <View style={s.grid}>
          {/* Day-of-week headers */}
          <View style={s.weekRow}>
            {DAY_HEADERS.map(d => (
              <View key={d} style={s.headerCell}>
                <Text style={s.headerText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <View key={wi} style={s.weekRow}>
              {week.map((day, di) => {
                if (day === null) {
                  return <View key={di} style={s.emptyCell} />;
                }

                const { hours, pay, hasEntries } = getDayData(day);
                const isToday = isCurrentMonth && day === todayDate;
                const future = isFutureDay(day);
                const missed = !future && !isToday && !hasEntries && isWorkDay(day);
                const isOT = hours > settings.overtimeThreshold / 5;

                return (
                  <View key={di} style={[
                    s.dayCell,
                    isToday && s.todayCell,
                    hasEntries && !isOT && s.workedCell,
                    hasEntries && isOT && s.otCell,
                    missed && s.missedCell,
                    future && !isToday && s.futureCell,
                  ]}>
                    <Text style={[
                      s.dayNum,
                      isToday && { color: C.primary, fontWeight: '800' },
                      missed && { color: C.red },
                      future && { color: C.muted },
                    ]}>{day}</Text>
                    {hours > 0 && (
                      <Text style={s.dayHours}>
                        {Math.floor(hours)}h{Math.round((hours % 1) * 60) > 0
                          ? `${Math.round((hours % 1) * 60)}m` : ''}
                      </Text>
                    )}
                    {pay > 0 && (
                      <Text style={[s.dayPay, isOT && { color: C.amber }]}>
                        ${pay.toFixed(0)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.green + '30', borderColor: C.green + '80' }]} />
            <Text style={s.legendText}>Worked</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.amber + '30', borderColor: C.amber + '80' }]} />
            <Text style={s.legendText}>Overtime</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.red + '20', borderColor: C.red + '60' }]} />
            <Text style={s.legendText}>Missed</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { borderColor: C.primary, borderWidth: 2 }]} />
            <Text style={s.legendText}>Today</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CELL_ASPECT = 1; // roughly square cells

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 20 },

  // Month nav
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 10, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  navArrow: { color: C.text, fontSize: 16, fontWeight: '700' },
  monthLabel: { fontSize: 18, fontWeight: '700', color: C.text },

  // Summary chips
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryChip: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  summaryChipLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 4 },
  summaryChipValue: { fontSize: 18, fontWeight: '700', color: C.text },

  // Grid
  grid: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  weekRow: { flexDirection: 'row' },
  headerCell: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  emptyCell: { flex: 1, minHeight: 68, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border + '60' },
  dayCell: {
    flex: 1, minHeight: 68, padding: 5,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border + '60',
    justifyContent: 'flex-start',
  },
  todayCell: { borderColor: C.primary, borderWidth: 2 },
  workedCell: { backgroundColor: C.green + '18' },
  otCell: { backgroundColor: C.amber + '18' },
  missedCell: { backgroundColor: C.red + '12' },
  futureCell: { opacity: 0.5 },
  dayNum: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 2 },
  dayHours: { fontSize: 10, color: C.primary, fontWeight: '600' },
  dayPay: { fontSize: 10, color: C.green, fontWeight: '600' },

  // Legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  legendText: { color: C.muted, fontSize: 12 },
});
