import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Select, Field, Input, Button } from '../../theme/components';
import { colors, radii, typeScale } from '../../theme/tokens';
import type { DrawerParamList, RootStackParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const ALERT_MODES = [
  { value: '', label: 'Off' },
  { value: 'percentage', label: 'Percentage of monthly spending' },
  { value: 'monthly_allowance', label: 'Monthly allowance' },
  { value: 'daily_allowance', label: 'Daily allowance' },
];

const CURRENCIES = [
  { value: 'TND', label: 'TND — Tunisian Dinar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { settings, reloadSettings } = useApp();

  const [alertMode, setAlertMode] = useState(settings?.unloggedSpendingAlertMode ?? '');
  const [alertValue, setAlertValue] = useState(String(settings?.unloggedSpendingAlertValue ?? ''));
  const [currency, setCurrency] = useState(settings?.currency ?? 'TND');

  useEffect(() => {
    if (settings) {
      setAlertMode(settings.unloggedSpendingAlertMode ?? '');
      setAlertValue(settings.unloggedSpendingAlertValue != null ? String(settings.unloggedSpendingAlertValue) : '');
      setCurrency(settings.currency);
    }
  }, [settings]);

  const save = useCallback(async () => {
    await repos.settings.update({
      currency,
      unloggedSpendingAlertMode: (alertMode || null) as import('../../types').UnloggedAlertMode,
      unloggedSpendingAlertValue: alertValue ? parseFloat(alertValue) : null,
    });
    await reloadSettings();
  }, [currency, alertMode, alertValue, reloadSettings]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
      </View>

      <Text style={s.sectionLabel}>Currency</Text>
      <Select title="Currency" value={currency} options={CURRENCIES} onChange={setCurrency} />

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>Dark / Light mode</Text>
      <View style={s.row}>
        <Text style={s.rowText}>Appearance</Text>
        <Text style={s.comingSoon}>Light mode coming soon</Text>
      </View>

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>Unlogged spending alert</Text>
      <Select
        title="Alert mode"
        value={alertMode ?? ''}
        options={ALERT_MODES}
        onChange={setAlertMode}
      />
      {!!alertMode && (
        <Field label="Threshold value" style={{ marginTop: 12 }}>
          <Input
            value={alertValue}
            onChangeText={setAlertValue}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </Field>
      )}

      <Button label="Save settings" onPress={save} style={s.saveBtn} />

      <Text style={[s.sectionLabel, { marginTop: 32 }]}>Data</Text>
      <Pressable
        style={s.row}
        onPress={() => navigation.navigate('Archive')}
      >
        <Text style={s.rowText}>Archive</Text>
        <ChevronRight size={14} color={colors.faint} />
      </Pressable>

      <View style={[s.row, { marginTop: 8 }]}>
        <Text style={s.rowText}>Export CSV</Text>
        <Text style={s.comingSoon}>Coming soon</Text>
      </View>
      <View style={[s.row, { marginTop: 8 }]}>
        <Text style={s.rowText}>Backup &amp; restore</Text>
        <Text style={s.comingSoon}>Coming soon</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  sectionLabel: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 14, marginBottom: 4 },
  rowText: { fontSize: typeScale.lg, color: colors.text },
  comingSoon: { fontSize: typeScale.sm, color: colors.faint, fontStyle: 'italic' },
  saveBtn: { marginTop: 20 },
});
