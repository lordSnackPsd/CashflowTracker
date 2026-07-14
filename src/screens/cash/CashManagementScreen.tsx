import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import type { Account } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Sheet, Button, Field, Input, Select } from '../../theme/components';
import { AmountText } from '../../theme/components';
import { colors, money, radii, typeScale } from '../../theme/tokens';
import type { DrawerParamList, RootStackParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const ICON_OPTIONS = [
  { value: 'wallet', label: '💼 Wallet' },
  { value: 'smartphone', label: '📱 Phone' },
  { value: 'landmark', label: '🏦 Bank' },
  { value: 'piggy-bank', label: '🐷 Savings' },
  { value: 'home', label: '🏠 Home' },
  { value: 'tag', label: '🏷️ Other' },
];

export function CashManagementScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, settings, dataVersion, bumpData } = useApp();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addIcon, setAddIcon] = useState('wallet');
  const [addStarting, setAddStarting] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    setAccounts(await repos.accounts.list());
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const handleAdd = useCallback(async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      const acc = await repos.accounts.create({ name: addName.trim(), type: 'cash', icon: addIcon, sortOrder: accounts.length });
      const startingBal = parseFloat(addStarting) || 0;
      if (startingBal !== 0) {
        await repos.transactions.create({
          accountId: acc.id,
          type: startingBal > 0 ? 'income' : 'expense',
          amount: Math.abs(startingBal),
          date: new Date().toISOString().slice(0, 10),
          categoryId: null,
          itemId: null,
          paymentMethodNote: 'Starting balance',
          counterparty: null,
          clientId: null,
          transferKind: null,
          feeAmount: null,
          linkedTransactionId: null,
          source: 'detailed',
          note: 'Opening balance',
        });
      }
      bumpData();
      setShowAdd(false);
      setAddName(''); setAddIcon('wallet'); setAddStarting('');
    } finally { setSaving(false); }
  }, [addName, addIcon, addStarting, accounts.length, bumpData]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title}>Cash management</Text>
        <Pressable onPress={() => setShowAdd(true)} hitSlop={8}>
          <Plus size={20} color={colors.gold} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {accounts.length === 0 && <Text style={s.empty}>No accounts yet. Tap + to add one.</Text>}
        {accounts.map(a => (
          <Pressable
            key={a.id}
            style={s.row}
            onPress={() => navigation.navigate('AccountDetail', { accountId: a.id })}
          >
            <Text style={s.accName}>{a.name}</Text>
            <View style={s.rowRight}>
              <AmountText value={a.runningBalance} currency={currency} style={s.balance} />
              <ChevronRight size={14} color={colors.faint} />
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {showAdd && (
        <Sheet title="Add account" onClose={() => setShowAdd(false)}>
          <Field label="Name"><Input value={addName} onChangeText={setAddName} placeholder="e.g. Cash" autoFocus /></Field>
          <Field label="Icon">
            <Select title="Icon" value={addIcon} options={ICON_OPTIONS} onChange={setAddIcon} />
          </Field>
          <Field label="Starting balance (optional)">
            <Input value={addStarting} onChangeText={setAddStarting} keyboardType="decimal-pad" placeholder="0" />
          </Field>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Add account" onPress={handleAdd} disabled={!addName.trim()} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 8 },
  accName: { fontSize: typeScale.lg, color: colors.text, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: { fontSize: typeScale.lg, fontWeight: '600' },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingTop: 12 },
});
