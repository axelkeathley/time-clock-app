export interface BreakPeriod {
  breakOut: number;        // Unix ms
  breakIn: number | null;  // null = currently on break
}

export interface TimeEntry {
  id: string;
  clockIn: number;
  clockOut: number | null;
  breaks: BreakPeriod[];
  note?: string;
}

export interface Deduction {
  id: string;
  name: string;
  amount: number;
  occurrence: 'every-paycheck' | 'first-of-month';
}

export interface Reimbursement {
  id: string;
  name: string;
  amount: number;
  occurrence: 'every-paycheck' | 'first-of-month';
}

export interface Settings {
  hourlyRate: number;
  payPeriodType: 'weekly' | 'biweekly';
  overtimeThreshold: number;       // hours/week before OT (default 40)
  federalTaxRate: number;          // % e.g. 22
  stateTaxRate: number;            // % e.g. 5
  ficaTaxRate: number;             // % default 7.65
  workStartTime: string;           // "HH:MM"
  workEndTime: string;             // "HH:MM"
  workDays: number[];              // 0=Sun … 6=Sat
  notificationsEnabled: boolean;
  deductions: Deduction[];         // recurring paycheck deductions
  reimbursements: Reimbursement[]; // recurring reimbursements
  incomeGoal: number;              // weekly gross income goal (0 = disabled)
}

export interface PaySummary {
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  totalPay: number;            // alias for grossPay (backward compat)
  taxAmount: number;
  deductionsAmount: number;
  reimbursementsAmount: number;
  netPay: number;
}

export interface PayPeriodRecord {
  startDate: number;
  endDate: number;
  entries: TimeEntry[];
  summary: PaySummary;
  hourlyRate: number;
  extraIncome: number;
  extraIncomeNote: string;
}
