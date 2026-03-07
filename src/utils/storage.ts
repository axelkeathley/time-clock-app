import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeEntry, Settings, BreakPeriod } from './types';

const ENTRIES_KEY = '@timeclock/entries';
const SETTINGS_KEY = '@timeclock/settings';
const EXTRA_INCOME_KEY = '@timeclock/extra_income';

export const DEFAULT_SETTINGS: Settings = {
  hourlyRate: 15,
  payPeriodType: 'weekly',
  overtimeThreshold: 40,
  federalTaxRate: 22,
  stateTaxRate: 5,
  ficaTaxRate: 7.65,
  workStartTime: '09:00',
  workEndTime: '17:00',
  workDays: [1, 2, 3, 4, 5],
  notificationsEnabled: false,
};

// ── Entries ───────────────────────────────────────────────────────────────────

export async function loadEntries(): Promise<TimeEntry[]> {
  try {
    const json = await AsyncStorage.getItem(ENTRIES_KEY);
    const entries: TimeEntry[] = json ? JSON.parse(json) : [];
    // Backward compat: ensure every entry has a breaks array
    return entries.map(e => ({ ...e, breaks: e.breaks ?? [] }));
  } catch {
    return [];
  }
}

export async function saveEntries(entries: TimeEntry[]): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export async function getActiveEntry(): Promise<TimeEntry | null> {
  const entries = await loadEntries();
  return entries.find(e => e.clockOut === null) ?? null;
}

export async function clockIn(): Promise<TimeEntry> {
  const entries = await loadEntries();
  const newEntry: TimeEntry = {
    id: Date.now().toString(),
    clockIn: Date.now(),
    clockOut: null,
    breaks: [],
  };
  await saveEntries([...entries, newEntry]);
  return newEntry;
}

export async function clockOut(note?: string): Promise<void> {
  const entries = await loadEntries();
  const now = Date.now();
  const updated = entries.map(e => {
    if (e.clockOut !== null) return e;
    // Auto-close any open break
    const breaks: BreakPeriod[] = e.breaks.map(b =>
      b.breakIn === null ? { ...b, breakIn: now } : b
    );
    return { ...e, clockOut: now, breaks, ...(note ? { note } : {}) };
  });
  await saveEntries(updated);
}

export async function breakOut(): Promise<void> {
  const entries = await loadEntries();
  const now = Date.now();
  const updated = entries.map(e => {
    if (e.clockOut !== null) return e;
    const alreadyOnBreak = e.breaks.some(b => b.breakIn === null);
    if (alreadyOnBreak) return e;
    return { ...e, breaks: [...e.breaks, { breakOut: now, breakIn: null }] };
  });
  await saveEntries(updated);
}

export async function breakIn(): Promise<void> {
  const entries = await loadEntries();
  const now = Date.now();
  const updated = entries.map(e => {
    if (e.clockOut !== null) return e;
    const breaks: BreakPeriod[] = e.breaks.map((b, i) =>
      i === e.breaks.length - 1 && b.breakIn === null ? { ...b, breakIn: now } : b
    );
    return { ...e, breaks };
  });
  await saveEntries(updated);
}

export async function deleteEntry(id: string): Promise<void> {
  const entries = await loadEntries();
  await saveEntries(entries.filter(e => e.id !== id));
}

export async function updateEntry(updated: TimeEntry): Promise<void> {
  const entries = await loadEntries();
  await saveEntries(entries.map(e => e.id === updated.id ? updated : e));
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<Settings> {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    return json ? { ...DEFAULT_SETTINGS, ...JSON.parse(json) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── Extra income (per pay period) ─────────────────────────────────────────────

export type ExtraIncomeMap = Record<string, { amount: number; note: string }>;

export async function loadExtraIncome(): Promise<ExtraIncomeMap> {
  try {
    const json = await AsyncStorage.getItem(EXTRA_INCOME_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

export async function saveExtraIncomeForPeriod(
  periodKey: string,
  amount: number,
  note: string
): Promise<void> {
  const all = await loadExtraIncome();
  all[periodKey] = { amount, note };
  await AsyncStorage.setItem(EXTRA_INCOME_KEY, JSON.stringify(all));
}

// ── Clear ─────────────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([ENTRIES_KEY, SETTINGS_KEY, EXTRA_INCOME_KEY]);
}
