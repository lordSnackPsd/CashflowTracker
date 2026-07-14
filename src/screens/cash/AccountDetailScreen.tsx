import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import type { Account, BalanceCorrection, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { calcUnbilledSpending } from '../../logic/unbilledSpending';
import { Sheet, Button, Field, Input, TxRow, useToast } from '../../theme/components';
import { colors, money, radii, typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import { todayIso } from '../../db/client';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AccountDetail'>;
type Route = RouteProp<RootStackParamList, 'AccountDetail'>;

export function AccountDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { accountId } = route.params;
  const { ready, settings, dataVersion, bumpData } = useApp();
  const toast = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [corrections, setCorrections] = useState<BalanceCorrection[]>([]);
  const [editing, setEditing] = useState(false);
  const [accName, setAccName] = useState('');
  const [showUpdateTotal, setShowUpdateTotal] = useState(false);
  const [actualBalance, setActualBalance] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    const [acc, txs, corrs] = await Promise.all([
      repos.accounts.get(accountId),
      repos.transactions.list({ accountId }),
      repos.balanceCorrections.listForAccount(accountId),
    ]);
    setAccount(acc);
    setTransactions(txs.filter(t => !t.isArchived));
    setCorrections(corrs);
    if (acc) setAccName(acc.name);
  }, [accountId]);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const handleSaveEdit = useCallback(async () => {
    if (!accName.trim() || !account) return;
    setSaving(true);
    try {
      await repos.accounts.update(accountId, { name: accName.trim() });
      bumpData();
      setEditing(false);
    } finally { setSaving(false); }
  }, [accName, account, accountId, bumpData]);

  const handleArchive = useCallback(async () => {
    const result = await repos.accounts.permanentDelete(accountId);
    if (result.blocked) {
      await repos.accounts.archive(accountId);
      toast.show('Account archived (has transactions)');
    } else {
      toast.show('Account removed');
    }
    bumpData();
    navigation.goBack();
  }, [accountId, bumpData, navigation, toast]);

  const handleUpdateTotal = useCallback(async () => {
    if (!account) return;
    const actual = parseFloat(actualBalance);
    if (isNaN(actual)) return;
    setSaving(true);
    try {
      const expected = account.runningBalance;
      const { diff } = calcUnbilledSpending({ expectedBalance: expected, actualBalance: actual });
      await repos.balanceCorrections.create({
        accountId,
        expectedBalance: expected,
        actualBalance: actual,
        diff,
        date: todayIso(),
      });
      bumpData();
      setShowUpdateTotal(false);
      setActualBalance('');
      toast.show(`Unbilled spending: ${money(diff)} ${currency}`);
    } finally { setSaving(false); }
  }, [account, actualBalance, accountId, bumpData, currency, toast]);

  const lastCorrection = corrections.length > 0
    ? corrections.sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  if (!account) return <View style={s.root}><ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}><ChevronLeft size={20} color={colors.dim} /></Pressable>
        <Text style={s.title} numberOfLines={1}>{account.name}</Text>
        <View style={s.headerBtns}>
          <Pressable onPress={() => setEditing(true)} hitSlop={8}><Text style={s.editLink}>Edit</Text></Pressable>
          <Pressable onPress={handleArchive} hitSlop={8}><Trash2 size={18} color={colors.faint} /></Pressable>
        </View>
      </View>

      <View style={s.balanceBox}>
        <Text style={s.balanceLabel}>Balance</Text>
        <Text style={[s.balanceAmount, account.runningBalance < 0 && s.negative]}>
          {money(account.runningBalance)} {currency}
        </Text>
        {lastCorrection && (
          <Text style={s.corrNote}>
            Last reconciled: {lastCorrection.date} · unbilled {money(lastCorrection.diff)} {currency}
          </Text>
        )}
      </View>

      <Pressable style={s.updateBtn} onPress={() => setShowUpdateTotal(true)}>
        <Text style={s.updateBtnText}>Update total (reconcile)</Text>
      </Pressable>

      <Text style={s.sectionLabel}>Transactions</Text>
      {transactions.length === 0
        ? <Text style={s.empty}>No transactions yet.</Text>
        : transactions.map(t => (
          <TxRow
            key={t.id}
            tx={t}
            accounts={[account]}
            currency={currency}
            onPress={() => navigation.navigate('TransactionDetail', { transactionId: t.id })}
          />
        ))
      }

      {editing && (
        <Sheet title="Edit account" onClose={() => setEditing(false)}>
          <Field label="Name"><Input value={accName} onChangeText={setAccName} autoFocus /></Field>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button label="Save" onPress={handleSaveEdit} style={{ marginTop: 8 }} />}
        </Sheet>
      )}

      {showUpdateTotal && (
        <Sheet title="Reconcile balance" onClose={() => setShowUpdateTotal(false)}>
          <Text style={s.reconNote}>
            Expected balance (from transactions): {money(account.runningBalance)} {currency}
          </Text>
          <Field label="Actual balance (check your bank/wallet)">
            <Input
              value={actualBalance}
              onChangeText={setActualBalance}
              keyboardType="decimal-pad"
              placeholder={String(account.runningBalance)}
              autoFocus
            />
          </Field>
          {actualBalance !== '' && (
            <Text style={s.diffPreview}>
              Unbilled: {money(account.runningBalance - (parseFloat(actualBalance) || 0))} {currency}
            </Text>
          )}
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button label="Save correction" onPress={handleUpdateTotal} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 24, marginBottom: 20, gap: 8 },
  title: { flex: 1, fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editLink: { fontSize: typeScale.md, color: colors.gold },
  balanceBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 16, marginBottom: 12 },
  balanceLabel: { fontSize: typeScale.sm, color: colors.faint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  balanceAmount: { fontSize: 32, fontWeight: '700', color: colors.text },
  negative: { color: colors.red },
  corrNote: { fontSize: typeScale.xs, color: colors.faint, marginTop: 6 },
  updateBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 10, alignItems: 'center', marginBottom: 20 },
  updateBtnText: { fontSize: typeScale.md, color: colors.gold },
  sectionLabel: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  empty: { fontSize: typeScale.md, color: colors.faint },
  reconNote: { fontSize: typeScale.md, color: colors.dim, marginBottom: 12 },
  diffPreview: { fontSize: typeScale.md, color: colors.gold, marginBottom: 8 },
});
