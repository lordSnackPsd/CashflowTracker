import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import type { Account, Category, Item, LoanPayment, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Sheet, Button, Field, Input, useToast } from '../../theme/components';
import { colors, money, radii, typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TransactionDetail'>;
type Route = RouteProp<RootStackParamList, 'TransactionDetail'>;

export function TransactionDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { transactionId } = route.params;
  const { ready, settings, dataVersion, bumpData } = useApp();
  const toast = useToast();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [loanPayment, setLoanPayment] = useState<LoanPayment | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    const t = await repos.transactions.get(transactionId);
    setTx(t);
    if (!t) return;
    setEditNote(t.note ?? '');
    const [acc, cats, its] = await Promise.all([
      repos.accounts.get(t.accountId),
      repos.categories.list(true),
      repos.items.list(true),
    ]);
    setAccount(acc);
    setCategory(cats.find(c => c.id === t.categoryId) ?? null);
    setItem(its.find(i => i.id === t.itemId) ?? null);
    // check if linked to a loan payment
    if (t.source === 'detailed' && t.paymentMethodNote?.includes('payment')) {
      // search loan payments for a sourceTransactionRef match
      const debts = await repos.debts.list(true);
      for (const d of debts) {
        const pmts = await repos.loanPayments.listForDebt(d.id);
        const linked = pmts.find(p => p.sourceTransactionRef === t.id);
        if (linked) { setLoanPayment(linked); break; }
      }
    }
  }, [transactionId]);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const handleSaveNote = useCallback(async () => {
    if (!tx) return;
    setSaving(true);
    try {
      await repos.transactions.update(transactionId, { note: editNote || null });
      bumpData();
      setEditing(false);
      toast.show('Note updated');
    } finally { setSaving(false); }
  }, [tx, editNote, transactionId, bumpData, toast]);

  const handleArchive = useCallback(async () => {
    await repos.transactions.archive(transactionId);
    bumpData();
    navigation.goBack();
    toast.show('Transaction archived');
  }, [transactionId, bumpData, navigation, toast]);

  const typeLabel = (t: Transaction) => {
    switch (t.type) {
      case 'expense': return 'Expense';
      case 'income': return 'Income';
      case 'transfer_in': return 'Transfer in';
      case 'transfer_out': return 'Transfer out';
    }
  };

  if (!tx) return <View style={s.root}><ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} /></View>;

  const isExpense = tx.type === 'expense';

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}><ChevronLeft size={20} color={colors.dim} /></Pressable>
        <Text style={s.title}>Transaction</Text>
        <Pressable onPress={handleArchive} hitSlop={8}><Trash2 size={18} color={colors.faint} /></Pressable>
      </View>

      <Text style={[s.amount, isExpense ? s.expense : s.income]}>
        {isExpense ? '-' : '+'}{money(tx.amount)} {currency}
      </Text>
      <Text style={s.type}>{typeLabel(tx)}</Text>

      <View style={s.detailCard}>
        <Row label="Date" value={tx.date} />
        {account && <Row label="Account" value={account.name} />}
        {category && <Row label="Category" value={`${category.emoji} ${category.name}`.trim()} />}
        {item && <Row label="Item" value={`${item.emoji} ${item.name}`.trim()} />}
        {tx.counterparty && <Row label="Who" value={tx.counterparty} />}
        {tx.paymentMethodNote && <Row label="Note" value={tx.paymentMethodNote} />}
        {tx.note && <Row label="Personal note" value={tx.note} />}
      </View>

      {loanPayment && (
        <View style={s.breakdownCard}>
          <Text style={s.breakdownTitle}>Payment breakdown</Text>
          <Row label="Principal" value={`${money(loanPayment.principalAmount)} ${currency}`} />
          <Row label="Interest" value={`${money(loanPayment.interestAmount)} ${currency}`} />
          {loanPayment.feeAmount > 0 && <Row label="Late fee" value={`${money(loanPayment.feeAmount)} ${currency}`} />}
          <Row label="Total" value={`${money(loanPayment.totalAmount)} ${currency}`} />
        </View>
      )}

      <View style={s.actions}>
        <Pressable style={s.editBtn} onPress={() => setEditing(true)}>
          <Text style={s.editBtnText}>Edit note</Text>
        </Pressable>
      </View>

      {editing && (
        <Sheet title="Edit note" onClose={() => setEditing(false)}>
          <Field label="Note">
            <Input value={editNote} onChangeText={setEditNote} placeholder="Add a note…" autoFocus multiline />
          </Field>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Save" onPress={handleSaveNote} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={r.row}>
      <Text style={r.label}>{label}</Text>
      <Text style={r.value}>{value}</Text>
    </View>
  );
}

const r = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: typeScale.sm, color: colors.faint },
  value: { fontSize: typeScale.md, color: colors.text, flex: 1, textAlign: 'right', marginLeft: 12 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, marginBottom: 20 },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  amount: { fontSize: 40, fontWeight: '700', marginBottom: 4 },
  expense: { color: colors.red },
  income: { color: colors.green },
  type: { fontSize: typeScale.md, color: colors.faint, marginBottom: 20 },
  detailCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 16 },
  breakdownCard: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 16 },
  breakdownTitle: { fontSize: typeScale.sm, color: colors.gold, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  actions: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 12, alignItems: 'center' },
  editBtnText: { fontSize: typeScale.md, color: colors.gold },
});
