import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadSettings, saveSettings, clearAllData, DEFAULT_SETTINGS } from '../utils/storage';
import { Settings } from '../utils/types';

const C = {
  bg: '#0F172A', card: '#1E293B', primary: '#3B82F6',
  green: '#10B981', red: '#EF4444', text: '#F8FAFC',
  muted: '#94A3B8', border: '#334155',
};

export default function SettingsScreen() {
  const [hourlyRate, setHourlyRate] = useState('15.00');
  const [payPeriodType, setPayPeriodType] = useState<'weekly' | 'biweekly'>('weekly');
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSettings().then(s => {
        setHourlyRate(s.hourlyRate.toFixed(2));
        setPayPeriodType(s.payPeriodType);
        setSaved(false);
      });
    }, [])
  );

  async function handleSave() {
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid hourly rate greater than $0.');
      return;
    }
    const s: Settings = { hourlyRate: rate, payPeriodType };
    await saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearData() {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all time entries and reset your settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            setHourlyRate(DEFAULT_SETTINGS.hourlyRate.toFixed(2));
            setPayPeriodType(DEFAULT_SETTINGS.payPeriodType);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Settings</Text>

        {/* Hourly rate */}
        <View style={s.card}>
          <Text style={s.label}>HOURLY RATE</Text>
          <View style={s.inputRow}>
            <Text style={s.dollar}>$</Text>
            <TextInput
              style={s.input}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.muted}
              selectTextOnFocus
            />
            <Text style={s.perHr}> / hr</Text>
          </View>
        </View>

        {/* Pay period */}
        <View style={s.card}>
          <Text style={s.label}>PAY PERIOD</Text>
          <View style={s.segment}>
            {(['weekly', 'biweekly'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[s.segBtn, payPeriodType === type && s.segBtnActive]}
                onPress={() => setPayPeriodType(type)}
              >
                <Text style={[s.segText, payPeriodType === type && s.segTextActive]}>
                  {type === 'weekly' ? 'Weekly' : 'Bi-Weekly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.hint}>
            {payPeriodType === 'weekly'
              ? 'Overtime applies after 40 hrs/week'
              : 'Overtime applies after 40 hrs per week within the period'}
          </Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, saved && { backgroundColor: C.green }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={s.saveBtnText}>{saved ? '✓  Saved!' : 'Save Settings'}</Text>
        </TouchableOpacity>

        {/* Danger zone */}
        <View style={[s.card, s.dangerCard]}>
          <Text style={[s.label, { color: C.red }]}>DANGER ZONE</Text>
          <Text style={s.dangerDesc}>
            Permanently deletes all time entries and resets settings.
          </Text>
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
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  dangerCard: { borderColor: '#7F1D1D', marginTop: 8 },
  label: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  dollar: { fontSize: 28, color: C.text, marginRight: 4 },
  input: {
    flex: 1, fontSize: 32, fontWeight: '700', color: C.text,
    backgroundColor: C.bg, borderRadius: 8, padding: 8,
  },
  perHr: { fontSize: 16, color: C.muted },
  segment: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segBtnActive: { backgroundColor: C.primary },
  segText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  hint: { color: C.muted, fontSize: 12, marginTop: 10 },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  dangerDesc: { color: C.muted, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  dangerBtn: {
    borderWidth: 1, borderColor: C.red,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  dangerBtnText: { color: C.red, fontSize: 15, fontWeight: '600' },
});
