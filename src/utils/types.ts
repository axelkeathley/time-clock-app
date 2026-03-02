export interface TimeEntry {
  id: string;
  clockIn: number;   // Unix ms timestamp
  clockOut: number | null; // null = currently clocked in
}

export interface Settings {
  hourlyRate: number;
  payPeriodType: 'weekly' | 'biweekly';
}

export interface PaySummary {
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
}

export interface PayPeriodRecord {
  startDate: number;
  endDate: number;
  entries: TimeEntry[];
  summary: PaySummary;
  hourlyRate: number;
}
