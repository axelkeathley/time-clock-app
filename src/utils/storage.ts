import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeEntry, Settings } from './types';

const ENTRIES_KEY = '@timeclock/entries';
const SETTINGS_KEY = '@timeclock/settings';

export const DEFAULT_SETTINGS: Settings = {
  hourlyRate: 15,
  payPeriodType: 'weekly',
};

export async function loadEntries(): Promise<TimeEntry[]> {
  try {
    const json = await AsyncStorage.getItem(ENTRIES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveEntries(entries: TimeEntry[]): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

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
  };
  await saveEntries([...entries, newEntry]);
  return newEntry;
}

export async function clockOut(): Promise<void> {
  const entries = await loadEntries();
  const updated = entries.map(e =>
    e.clockOut === null ? { ...e, clockOut: Date.now() } : e
  );
  await saveEntries(updated);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([ENTRIES_KEY, SETTINGS_KEY]);
}
