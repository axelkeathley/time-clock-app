import { TimeEntry, PaySummary, Settings, Deduction, Reimbursement, OccurrenceType } from './types';

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
  return entries.filter(entry => {
    const clockOut = entry.clockOut ?? Date.now();
    return entry.clockIn < e && clockOut > s;
  });
}

export function calculateTotalHours(entries: TimeEntry[]): number {
  return entries.reduce(
    (total, entry) => total + msToHours(getEntryDurationMs(entry)),
    0
  );
}

// ── Deductions / Reimbursements helpers ───────────────────────────────────────

// Returns 0-based index of this period within its calendar month (0 = 1st, 1 = 2nd, etc.)
function getPeriodIndexInMonth(periodStart: Date, weeksPerPeriod: number): number {
  let index = 0;
  const cursor = new Date(periodStart);
  cursor.setDate(cursor.getDate() - weeksPerPeriod * 7);
  while (
    cursor.getMonth() === periodStart.getMonth() &&
    cursor.getFullYear() === periodStart.getFullYear()
  ) {
    index++;
    cursor.setDate(cursor.getDate() - weeksPerPeriod * 7);
  }
  return index;
}

// A "last of month" item applies when the next period would start in a different month.
function isLastPeriodOfMonth(periodStart: Date, weeksPerPeriod: number): boolean {
  const nextPeriodStart = new Date(periodStart);
  nextPeriodStart.setDate(nextPeriodStart.getDate() + weeksPerPeriod * 7);
  return nextPeriodStart.getMonth() !== periodStart.getMonth();
}

function occurrenceApplies(occurrence: OccurrenceType, periodStart: Date, weeksPerPeriod: number): boolean {
  const idx = getPeriodIndexInMonth(periodStart, weeksPerPeriod);
  switch (occurrence) {
    case 'every-paycheck':  return true;
    case '1st-of-month':    return idx === 0;
    case '2nd-of-month':    return idx === 1;
    case '3rd-of-month':    return idx === 2;
    case '4th-of-month':    return idx === 3;
    case 'last-of-month':   return isLastPeriodOfMonth(periodStart, weeksPerPeriod);
    case 'once-yearly':     return periodStart.getMonth() === 0 && idx === 0;
    // legacy values
    case 'first-of-month':  return idx === 0;
    case 'twice-monthly':   return idx === 0 || isLastPeriodOfMonth(periodStart, weeksPerPeriod);
    default:                return false;
  }
}

export function getPeriodDeductionsAmount(
  deductions: Deduction[],
  periodStart: Date,
  weeksPerPeriod: number
): number {
  return deductions.reduce((sum, d) =>
    occurrenceApplies(d.occurrence, periodStart, weeksPerPeriod) ? sum + d.amount : sum, 0);
}

export function getPeriodReimbursementsAmount(
  reimbursements: Reimbursement[],
  periodStart: Date,
  weeksPerPeriod: number
): number {
  return reimbursements.reduce((sum, r) =>
    occurrenceApplies(r.occurrence, periodStart, weeksPerPeriod) ? sum + r.amount : sum, 0);
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

export function calculateStreak(entries: TimeEntry[], workDays?: number[]): number {
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

  // If we haven't worked today yet (and today is a work day), start checking from yesterday
  const todayIsWorkDay = !workDays || workDays.length === 0 || workDays.includes(cursor.getDay());
  if (!workedDays.has(dayKey(cursor)) && todayIsWorkDay) {
    cursor.setDate(cursor.getDate() - 1);
  } else if (!todayIsWorkDay) {
    cursor.setDate(cursor.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = cursor.getDay();
    // If this is not a scheduled work day, skip it without breaking the streak
    if (workDays && workDays.length > 0 && !workDays.includes(dayOfWeek)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (workedDays.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
