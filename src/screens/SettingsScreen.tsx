import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadSettings, saveSettings, clearAllData, DEFAULT_SETTINGS } from '../utils/storage';
import { scheduleWorkNotifications } from '../utils/notifications';
import { Settings } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', text: '#F8FAFC',
  muted: '#94A3B8', border: '#334155', amber: '#F59E0B',
};

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function Field({
  label, value, onChange, keyboardType = 'default', prefix, suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  prefix?: string;
  suffix?: string;
}) {
  return (
    <View style={f.row}>
      <Text style={f.label}>{label}</Text>
      <View style={f.inputWrap}>
        {prefix ? <Text style={f.affix}>{prefix}</Text> : null}
        <TextInput
          style={f.input}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          selectTextOnFocus
          placeholderTextColor={C.muted}
        />
        {suffix ? <Text style={f.affix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const f = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  label: { color: C.muted, fontSize: 14, flex: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10,
    borderWidth: 1, borderColor: C.border,
  },
  input: { color: C.text, fontSize: 16, fontWeight: '600', minWidth: 70, paddingVertical: 8 },
  affix: { color: C.muted, fontSize: 14, marginHorizontal: 2 },
});

export default function SettingsScreen() {
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_SETTINGS.hourlyRate.toFixed(2));
  const [payPeriodType, setPayPeriodType] = useState<'weekly' | 'biweekly'>(DEFAULT_SETTINGS.payPeriodType);
  const [overtimeThreshold, setOvertimeThreshold] = useState(DEFAULT_SETTINGS.overtimeThreshold.toString());
  const [federalTax, setFederalTax] = useState(DEFAULT_SETTINGS.federalTaxRate.toString());
  const [stateTax, setStateTax] = useState(DEFAULT_SETTINGS.stateTaxRate.toString());
  const [ficaTax, setFicaTax] = useState(DEFAULT_SETTINGS.ficaTaxRate.toString());
  const [workStart, setWorkStart] = useState(DEFAULT_SETTINGS.workStartTime);
  const [workEnd, setWorkEnd] = useState(DEFAULT_SETTINGS.workEndTime);
  const [workDays, setWorkDays] = useState<number[]>(DEFAULT_SETTINGS.workDays);
  const [notificationsEnabled, setNotificationsEnabled] = useState(DEFAULT_SETTINGS.notificationsEnabled);
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    loadSettings().then(s => {
      setHourlyRate(s.hourlyRate.toFixed(2));
      setPayPeriodType(s.payPeriodType);
      setOvertimeThreshold(s.overtimeThreshold.toString());
      setFederalTax(s.federalTaxRate.toString());
      setStateTax(s.stateTaxRate.toString());
      setFicaTax(s.ficaTaxRate.toString());
      setWorkStart(s.workStartTime);
      setWorkEnd(s.workEndTime);
      setWorkDays(s.workDays);
      setNotificationsEnabled(s.notificationsEnabled);
      setSaved(false);
    });
  }, []));

  function toggleDay(day: number) {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  async function handleSave() {
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid hourly rate.');
      return;
    }
    const s: Settings = {
      hourlyRate: rate,
      payPeriodType,
      overtimeThreshold: parseFloat(overtimeThreshold) || 40,
      federalTaxRate: parseFloat(federalTax) || 0,
      stateTaxRate: parseFloat(stateTax) || 0,
      ficaTaxRate: parseFloat(ficaTax) || 7.65,
      workStartTime: workStart,
      workEndTime: workEnd,
      workDays,
      notificationsEnabled,
    };
    await saveSettings(s);
    await scheduleWorkNotifications(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleClearData() {
    Alert.alert(
      'Clear All Data',
      'Permanently deletes all time entries and resets settings. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything', style: 'destructive',
          onPress: async () => {
            await clearAllData();
            setHourlyRate(DEFAULT_SETTINGS.hourlyRate.toFixed(2));
            setPayPeriodType(DEFAULT_SETTINGS.payPeriodType);
            setOvertimeThreshold(DEFAULT_SETTINGS.overtimeThreshold.toString());
            setFederalTax(DEFAULT_SETTINGS.federalTaxRate.toString());
            setStateTax(DEFAULT_SETTINGS.stateTaxRate.toString());
            setFicaTax(DEFAULT_SETTINGS.ficaTaxRate.toString());
            setWorkStart(DEFAULT_SETTINGS.workStartTime);
            setWorkEnd(DEFAULT_SETTINGS.workEndTime);
            setWorkDays(DEFAULT_SETTINGS.workDays);
            setNotificationsEnabled(false);
          },
        },
      ]
    );
  }

  const totalTax = (parseFloat(federalTax) || 0) + (parseFloat(stateTax) || 0) + (parseFloat(ficaTax) || 0);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Settings</Text>

        {/* Pay */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>PAY</Text>
          <Field label="Hourly Rate" value={hourlyRate} onChange={setHourlyRate}
            keyboardType="decimal-pad" prefix="$" suffix="/hr" />
          <Field label="OT Threshold" value={overtimeThreshold} onChange={setOvertimeThreshold}
            keyboardType="decimal-pad" suffix="hrs/wk" />
          <Text style={s.cardLabel}>PAY PERIOD</Text>
          <View style={s.segment}>
            {(['weekly', 'biweekly'] as const).map(type => (
              <TouchableOpacity key={type}
                style={[s.segBtn, payPeriodType === type && s.segBtnActive]}
                onPress={() => setPayPeriodType(type)}>
                <Text style={[s.segText, payPeriodType === type && s.segTextActive]}>
                  {type === 'weekly' ? 'Weekly' : 'Bi-Weekly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Taxes */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>TAXES (ESTIMATES)</Text>
          <Field label="Federal Tax" value={federalTax} onChange={setFederalTax}
            keyboardType="decimal-pad" suffix="%" />
          <Field label="State Tax" value={stateTax} onChange={setStateTax}
            keyboardType="decimal-pad" suffix="%" />
          <Field label="FICA (SS + Medicare)" value={ficaTax} onChange={setFicaTax}
            keyboardType="decimal-pad" suffix="%" />
          <Text style={s.hint}>
            Total: {totalTax.toFixed(2)}% · Net pay = Gross × {(1 - totalTax / 100).toFixed(4)}
          </Text>
        </View>

        {/* Work Schedule */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>WORK SCHEDULE</Text>
          <Field label="Start Time" value={workStart} onChange={setWorkStart} suffix="(HH:MM)" />
          <Field label="End Time" value={workEnd} onChange={setWorkEnd} suffix="(HH:MM)" />
          <Text style={s.cardLabel}>WORK DAYS</Text>
          <View style={s.daysRow}>
            {DAY_LABELS.map((lbl, day) => (
              <TouchableOpacity
                key={day}
                style={[s.dayBtn, workDays.includes(day) && s.dayBtnActive]}
                onPress={() => toggleDay(day)}>
                <Text style={[s.dayBtnText, workDays.includes(day) && s.dayBtnTextActive]}>
                  {lbl}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
          <View style={s.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.notifLabel}>Clock in/out reminders</Text>
              <Text style={s.hint}>Reminds you at your scheduled start & end times</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saved && { backgroundColor: C.green }]}
          onPress={handleSave} activeOpacity={0.85}>
          <Text style={s.saveBtnText}>{saved ? '✓  Saved!' : 'Save Settings'}</Text>
        </TouchableOpacity>

        {/* Danger zone */}
        <View style={[s.card, s.dangerCard]}>
          <Text style={[s.sectionLabel, { color: C.red }]}>DANGER ZONE</Text>
          <Text style={s.hint}>Permanently deletes all time entries and resets settings.</Text>
          <TouchableOpacity style={s.dangerBtn} onPress={handleClearData}>
            <Text style={s.dangerBtnText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 24 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  dangerCard: { borderColor: '#7F1D1D' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 14 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 10, marginTop: 6 },
  hint: { color: C.muted, fontSize: 12, marginTop: 4 },
  segment: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, padding: 3, marginBottom: 4 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segBtnActive: { backgroundColor: C.primary },
  segText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  dayBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  dayBtnText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  dayBtnTextActive: { color: '#fff' },
  notifRow: { flexDirection: 'row', alignItems: 'center' },
  notifLabel: { color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  dangerBtn: { borderWidth: 1, borderColor: C.red, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  dangerBtnText: { color: C.red, fontSize: 15, fontWeight: '600' },
});
