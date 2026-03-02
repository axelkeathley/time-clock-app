import { TimeEntry, PaySummary } from './types';

export function getEntryDurationMs(entry: TimeEntry): number {
  return (entry.clockOut ?? Date.now()) - entry.clockIn;
}

export function msToHours(ms: number): number {
  return ms / (1000 * 60 * 60);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export function formatHoursShort(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Week starts on Monday
export function getStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getEndOfWeek(date: Date = new Date()): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function filterEntriesByRange(
  entries: TimeEntry[],
  start: Date,
  end: Date
): TimeEntry[] {
  const s = start.getTime();
  const e = end.getTime();
  return entries.filter(entry =>
    entry.clockIn < e && (entry.clockOut === null || entry.clockOut > s)
  );
}

export function calculateTotalHours(entries: TimeEntry[]): number {
  return entries.reduce(
    (total, entry) => total + msToHours(getEntryDurationMs(entry)),
    0
  );
}

// Overtime = time and a half after 40 hours/week
export function calculatePay(totalHours: number, hourlyRate: number): PaySummary {
  const regularHours = Math.min(totalHours, 40);
  const overtimeHours = Math.max(0, totalHours - 40);
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * 1.5;
  return {
    regularHours,
    overtimeHours,
    totalHours,
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
  };
}

export function getDailyBreakdown(
  entries: TimeEntry[],
  weekStart: Date
): Array<{ date: Date; hours: number }> {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const dayEntries = filterEntriesByRange(entries, getStartOfDay(day), getEndOfDay(day));
    return { date: day, hours: calculateTotalHours(dayEntries) };
  });
}
