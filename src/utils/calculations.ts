import { TimeEntry, PaySummary, Settings, Deduction, Reimbursement } from './types';

// ── Duration helpers ──────────────────────────────────────────────────────────

export function getBreaksDurationMs(entry: TimeEntry): number {
  const now = Date.now();
  return (entry.breaks ?? []).reduce((total, b) => {
    return total + ((b.breakIn ?? now) - b.breakOut);
  }, 0);
}

export function getEntryDurationMs(entry: TimeEntry): number {
  const raw = (entry.clockOut ?? Date.now()) - entry.clockIn;
  return Math.max(0, raw - getBreaksDurationMs(entry));
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

// ── Date helpers ──────────────────────────────────────────────────────────────

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
  const day = d.getDay();
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

// ── Deductions / Reimbursements helpers ───────────────────────────────────────

// A "first of month" item applies when the period start date falls within the
// first (weeksPerPeriod * 7) days of the calendar month.
function isFirstPeriodOfMonth(periodStart: Date, weeksPerPeriod: number): boolean {
  return periodStart.getDate() <= weeksPerPeriod * 7;
}

export function getPeriodDeductionsAmount(
  deductions: Deduction[],
  periodStart: Date,
  weeksPerPeriod: number
): number {
  const firstOfMonth = isFirstPeriodOfMonth(periodStart, weeksPerPeriod);
  return deductions.reduce((sum, d) => {
    if (d.occurrence === 'every-paycheck') return sum + d.amount;
    if (d.occurrence === 'first-of-month' && firstOfMonth) return sum + d.amount;
    return sum;
  }, 0);
}

export function getPeriodReimbursementsAmount(
  reimbursements: Reimbursement[],
  periodStart: Date,
  weeksPerPeriod: number
): number {
  const firstOfMonth = isFirstPeriodOfMonth(periodStart, weeksPerPeriod);
  return reimbursements.reduce((sum, r) => {
    if (r.occurrence === 'every-paycheck') return sum + r.amount;
    if (r.occurrence === 'first-of-month' && firstOfMonth) return sum + r.amount;
    return sum;
  }, 0);
}

// ── Pay + tax calculation ─────────────────────────────────────────────────────

export function calculatePay(
  totalHours: number,
  hourlyRate: number,
  overtimeThreshold = 40,
  taxRates?: Pick<Settings, 'federalTaxRate' | 'stateTaxRate' | 'ficaTaxRate'>,
  deductionsAmount = 0,
  reimbursementsAmount = 0,
): PaySummary {
  const regularHours = Math.min(totalHours, overtimeThreshold);
  const overtimeHours = Math.max(0, totalHours - overtimeThreshold);
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * 1.5;
  const grossPay = regularPay + overtimePay;

  const totalTaxPct = taxRates
    ? taxRates.federalTaxRate + taxRates.stateTaxRate + taxRates.ficaTaxRate
    : 0;
  const taxAmount = grossPay * (totalTaxPct / 100);
  const netPay = grossPay - taxAmount - deductionsAmount + reimbursementsAmount;

  return {
    regularHours,
    overtimeHours,
    totalHours,
    regularPay,
    overtimePay,
    grossPay,
    totalPay: grossPay,
    taxAmount,
    deductionsAmount,
    reimbursementsAmount,
    netPay,
  };
}

// ── Daily breakdown ───────────────────────────────────────────────────────────

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

// ── Streak ────────────────────────────────────────────────────────────────────

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function calculateStreak(entries: TimeEntry[]): number {
  // Collect days that have at least one complete entry
  const workedDays = new Set<string>();
  entries.forEach(e => {
    if (e.clockOut !== null) {
      workedDays.add(dayKey(new Date(e.clockIn)));
    }
  });

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // If we haven't worked today yet, start checking from yesterday
  if (!workedDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    if (workedDays.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
