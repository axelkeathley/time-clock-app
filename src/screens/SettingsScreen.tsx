import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView, Switch, Modal, KeyboardAvoidingView,
  Platform, Pressable, Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadSettings, saveSettings, clearAllData, DEFAULT_SETTINGS } from '../utils/storage';
import { scheduleWorkNotifications } from '../utils/notifications';
import { Settings, Deduction, Reimbursement, OccurrenceType } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', text: '#F8FAFC',
  muted: '#94A3B8', border: '#334155', amber: '#F59E0B',
};

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const OCCURRENCE_OPTIONS: { value: OccurrenceType; label: string }[] = [
  { value: 'every-paycheck', label: 'Every Paycheck' },
  { value: '1st-of-month',   label: '1st Paycheck of Month' },
  { value: '2nd-of-month',   label: '2nd Paycheck of Month' },
  { value: '3rd-of-month',   label: '3rd Paycheck of Month' },
  { value: '4th-of-month',   label: '4th Paycheck of Month' },
  { value: 'last-of-month',  label: 'Last Paycheck of Month' },
  { value: 'once-yearly',    label: 'Once a Year (January)' },
];

function occurrenceLabel(o: OccurrenceType): string {
  return OCCURRENCE_OPTIONS.find(x => x.value === o)?.label ?? o;
}

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
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [incomeGoal, setIncomeGoal] = useState('0');
  const [saved, setSaved] = useState(false);

  // Add deduction modal state
  const [addDedModal, setAddDedModal] = useState(false);
  const [newDedName, setNewDedName] = useState('');
  const [newDedAmount, setNewDedAmount] = useState('');
  const [newDedOccurrence, setNewDedOccurrence] = useState<OccurrenceType>('every-paycheck');

  // Add reimbursement modal state
  const [addReimbModal, setAddReimbModal] = useState(false);
  const [newReimbName, setNewReimbName] = useState('');
  const [newReimbAmount, setNewReimbAmount] = useState('');
  const [newReimbOccurrence, setNewReimbOccurrence] = useState<OccurrenceType>('every-paycheck');

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
      setDeductions(s.deductions ?? []);
      setReimbursements(s.reimbursements ?? []);
      setIncomeGoal((s.incomeGoal ?? 0).toString());
      setSaved(false);
    });
  }, []));

  function toggleDay(day: number) {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  }

  function addDeduction() {
    const amt = parseFloat(newDedAmount);
    if (!newDedName.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid', 'Enter a name and a valid amount.');
      return;
    }
    setDeductions(prev => [...prev, {
      id: Date.now().toString(),
      name: newDedName.trim(),
      amount: amt,
      occurrence: newDedOccurrence,
    }]);
    setNewDedName(''); setNewDedAmount(''); setNewDedOccurrence('every-paycheck');
    setAddDedModal(false);
  }

  function addReimbursement() {
    const amt = parseFloat(newReimbAmount);
    if (!newReimbName.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid', 'Enter a name and a valid amount.');
      return;
    }
    setReimbursements(prev => [...prev, {
      id: Date.now().toString(),
      name: newReimbName.trim(),
      amount: amt,
      occurrence: newReimbOccurrence,
    }]);
    setNewReimbName(''); setNewReimbAmount(''); setNewReimbOccurrence('first-of-month');
    setAddReimbModal(false);
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
      deductions,
      reimbursements,
      incomeGoal: parseFloat(incomeGoal) || 0,
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
            setDeductions([]);
            setReimbursements([]);
            setIncomeGoal('0');
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
          <Field label="Weekly Income Goal" value={incomeGoal} onChange={setIncomeGoal}
            keyboardType="decimal-pad" prefix="$" suffix="/wk" />
          <Text style={s.hint}>Set to 0 to disable goal tracking on the Weekly tab.</Text>
          <Text style={[s.cardLabel, { marginTop: 12 }]}>PAY PERIOD</Text>
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

        {/* Deductions */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>DEDUCTIONS</Text>
          <Text style={s.hint}>Subtracted from your paycheck (health insurance, 401k, union dues, etc.)</Text>
          {deductions.length === 0 && (
            <Text style={[s.hint, { marginTop: 10, fontStyle: 'italic' }]}>No deductions added.</Text>
          )}
          {deductions.map(d => (
            <View key={d.id} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{d.name}</Text>
                <Text style={s.itemSub}>
                  ${d.amount.toFixed(2)} · {occurrenceLabel(d.occurrence)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDeductions(prev => prev.filter(x => x.id !== d.id))} style={s.removeBtn}>
                <Text style={s.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addBtn} onPress={() => setAddDedModal(true)}>
            <Text style={s.addBtnText}>+ Add Deduction</Text>
          </TouchableOpacity>
        </View>

        {/* Reimbursements */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>REIMBURSEMENTS</Text>
          <Text style={s.hint}>Added to your paycheck (phone bill, mileage, uniform, etc.)</Text>
          {reimbursements.length === 0 && (
            <Text style={[s.hint, { marginTop: 10, fontStyle: 'italic' }]}>No reimbursements added.</Text>
          )}
          {reimbursements.map(r => (
            <View key={r.id} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{r.name}</Text>
                <Text style={s.itemSub}>
                  ${r.amount.toFixed(2)} · {occurrenceLabel(r.occurrence)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReimbursements(prev => prev.filter(x => x.id !== r.id))} style={s.removeBtn}>
                <Text style={s.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addBtn} onPress={() => setAddReimbModal(true)}>
            <Text style={s.addBtnText}>+ Add Reimbursement</Text>
          </TouchableOpacity>
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

      {/* Add Deduction Modal */}
      <Modal visible={addDedModal} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.overlay} onPress={Keyboard.dismiss}>
          <Pressable>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Add Deduction</Text>
            <TextInput
              style={s.modalInput}
              value={newDedName}
              onChangeText={setNewDedName}
              placeholder="Name (e.g. Health Insurance, 401k)"
              placeholderTextColor={C.muted}
              autoFocus
            />
            <View style={s.amtRow}>
              <Text style={s.dollar}>$</Text>
              <TextInput
                style={s.amtInput}
                value={newDedAmount}
                onChangeText={setNewDedAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.muted}
                selectTextOnFocus
              />
            </View>
            <Text style={[s.hint, { marginBottom: 8 }]}>WHEN TO APPLY</Text>
            {OCCURRENCE_OPTIONS.map(o => (
              <TouchableOpacity key={o.value} style={s.radioRow} onPress={() => setNewDedOccurrence(o.value)}>
                <View style={[s.radioCircle, newDedOccurrence === o.value && s.radioCircleActive]} />
                <Text style={[s.radioLabel, newDedOccurrence === o.value && { color: C.text }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setAddDedModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={addDeduction}>
                <Text style={s.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Reimbursement Modal */}
      <Modal visible={addReimbModal} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.overlay} onPress={Keyboard.dismiss}>
          <Pressable>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Add Reimbursement</Text>
            <TextInput
              style={s.modalInput}
              value={newReimbName}
              onChangeText={setNewReimbName}
              placeholder="Name (e.g. Phone Bill, Mileage)"
              placeholderTextColor={C.muted}
              autoFocus
            />
            <View style={s.amtRow}>
              <Text style={s.dollar}>$</Text>
              <TextInput
                style={s.amtInput}
                value={newReimbAmount}
                onChangeText={setNewReimbAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.muted}
                selectTextOnFocus
              />
            </View>
            <Text style={[s.hint, { marginBottom: 8 }]}>WHEN TO APPLY</Text>
            {OCCURRENCE_OPTIONS.map(o => (
              <TouchableOpacity key={o.value} style={s.radioRow} onPress={() => setNewReimbOccurrence(o.value)}>
                <View style={[s.radioCircle, newReimbOccurrence === o.value && s.radioCircleActive]} />
                <Text style={[s.radioLabel, newReimbOccurrence === o.value && { color: C.text }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setAddReimbModal(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirm, { backgroundColor: C.green }]} onPress={addReimbursement}>
                <Text style={s.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
  // Lists
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  itemName: { color: C.text, fontSize: 14, fontWeight: '600' },
  itemSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 8 },
  removeText: { color: C.red, fontSize: 18, fontWeight: '700' },
  addBtn: { marginTop: 14, borderWidth: 1, borderColor: C.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: C.primary, fontSize: 14, fontWeight: '600' },
  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 14 },
  modalInput: {
    backgroundColor: C.bg, borderRadius: 10, padding: 12, color: C.text,
    fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  amtRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dollar: { fontSize: 28, color: C.text, marginRight: 4 },
  amtInput: { flex: 1, fontSize: 28, fontWeight: '700', color: C.text, backgroundColor: C.bg, borderRadius: 8, padding: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  modalCancelText: { color: C.muted, fontSize: 16, fontWeight: '600' },
  modalConfirm: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: C.primary },
  modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  radioCircle: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: C.muted, backgroundColor: 'transparent',
  },
  radioCircleActive: { borderColor: C.primary, backgroundColor: C.primary },
  radioLabel: { color: C.muted, fontSize: 14, fontWeight: '500' },
});
