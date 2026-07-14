import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import type { Account, Debt, LoanPayment, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import {
  calcTermLoanRemaining,
  calcTermLoanProgress,
  calcFriendLoanRemaining,
  calcFriendLoanProgress,
  calcRevolvingCreditPayment,
  suggestTermLoanPaymentFields,
} from '../../logic/debtMath';
import { ProgressBar, Gauge, Sheet, Button, Field, Input, TxRow, Select, useToast } from '../../theme/components';
import { colors, money, radii, spacing, typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import { todayIso } from '../../db/client';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DebtDetail'>;
type Route = RouteProp<RootStackParamList, 'DebtDetail'>;

export function DebtDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { debtId } = route.params;
  const { ready, settings, dataVersion, bumpData } = useApp();
  const toast = useToast();

  const [debt, setDebt] = useState<Debt | null>(null);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showPaySheet, setShowPaySheet] = useState(false);
  const [saving, setSaving] = useState(false);

  // term loan payment fields
  const [pTotal, setPTotal] = useState('');
  const [pPrincipal, setPPrincipal] = useState('');
  const [pInterest, setPInterest] = useState('');
  const [pFee, setPFee] = useState('');
  const [pAccount, setPAccount] = useState('');
  const [pDate, setPDate] = useState(todayIso());

  // revolving payment fields
  const [rvTotal, setRvTotal] = useState('');
  const [rvNewAvail, setRvNewAvail] = useState('');
  const [rvAccount, setRvAccount] = useState('');

  // friend loan payment fields
  const [flAmount, setFlAmount] = useState('');
  const [flDate, setFlDate] = useState(todayIso());
  const [flAccount, setFlAccount] = useState('');

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    const [d, accs] = await Promise.all([
      repos.debts.get(debtId),
      repos.accounts.list(),
    ]);
    setDebt(d);
    setAccounts(accs);
    if (d) {
      const [pmts, txs] = await Promise.all([
        repos.loanPayments.listForDebt(d.id),
        repos.transactions.list({ accountId: d.id }),
      ]);
      setPayments(pmts);
      setTransactions(txs.filter(t => !t.isArchived));
    }
  }, [debtId]);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));

  // term loan autofill
  const suggestedFields = useMemo(() => {
    const n = (v: string) => { const p = parseFloat(v); return isNaN(p) ? undefined : p; };
    return suggestTermLoanPaymentFields({
      total: n(pTotal),
      principal: n(pPrincipal),
      interest: n(pInterest),
      fee: n(pFee),
    });
  }, [pTotal, pPrincipal, pInterest, pFee]);

  const handleArchive = useCallback(async () => {
    if (!debt) return;
    await repos.debts.archive(debt.id);
    bumpData();
    navigation.goBack();
  }, [debt, bumpData, navigation]);

  const handleTermLoanPay = useCallback(async () => {
    if (!debt) return;
    const total = parseFloat(pTotal) || (suggestedFields.total ?? 0);
    const principal = parseFloat(pPrincipal) || (suggestedFields.principal ?? 0);
    const interest = parseFloat(pInterest) || (suggestedFields.interest ?? 0);
    const fee = parseFloat(pFee) || 0;
    if (!total || !pAccount) return;
    setSaving(true);
    try {
      const tx = await repos.transactions.create({
        accountId: pAccount,
        type: 'expense',
        amount: total,
        date: pDate,
        categoryId: null,
        itemId: null,
        paymentMethodNote: `Loan payment: ${debt.name}`,
        counterparty: null,
        clientId: null,
        transferKind: null,
        feeAmount: null,
        linkedTransactionId: null,
        source: 'detailed',
        note: null,
      });
      await repos.loanPayments.create({
        debtId: debt.id,
        date: pDate,
        totalAmount: total,
        principalAmount: principal,
        interestAmount: interest,
        feeAmount: fee,
        sourceTransactionRef: tx.id,
      });
      // check if fully paid
      const newRemaining = calcTermLoanRemaining(debt.principalDisbursed ?? 0, [
        ...payments,
        { id: '', debtId: debt.id, date: pDate, totalAmount: total, principalAmount: principal, interestAmount: interest, feeAmount: fee, sourceTransactionRef: tx.id },
      ]);
      if (newRemaining <= 0) {
        await repos.debts.update(debt.id, { status: 'paid' });
      }
      bumpData();
      setShowPaySheet(false);
      toast.show(`Logged payment of ${money(total)} ${currency}`);
    } finally {
      setSaving(false);
    }
  }, [debt, pTotal, pPrincipal, pInterest, pFee, pAccount, pDate, payments, suggestedFields, bumpData, currency, toast]);

  const handleRevolvingPay = useCallback(async () => {
    if (!debt) return;
    const total = parseFloat(rvTotal);
    const newAvail = parseFloat(rvNewAvail);
    if (!total || isNaN(newAvail) || !rvAccount) return;
    setSaving(true);
    try {
      const result = calcRevolvingCreditPayment({
        availableBefore: debt.availableBalance ?? 0,
        totalAmount: total,
        newAvailableAmount: newAvail,
      });
      const tx = await repos.transactions.create({
        accountId: rvAccount,
        type: 'expense',
        amount: total,
        date: todayIso(),
        categoryId: null,
        itemId: null,
        paymentMethodNote: `Card payment: ${debt.name}`,
        counterparty: null,
        clientId: null,
        transferKind: null,
        feeAmount: null,
        linkedTransactionId: null,
        source: 'detailed',
        note: null,
      });
      await repos.loanPayments.create({
        debtId: debt.id,
        date: todayIso(),
        totalAmount: total,
        principalAmount: result.principalAmount,
        interestAmount: result.interestAmount,
        feeAmount: 0,
        sourceTransactionRef: tx.id,
      });
      await repos.debts.update(debt.id, {
        availableBalance: result.newAvailableBalance,
        totalInterestPaid: (debt.totalInterestPaid ?? 0) + result.interestAmount,
      });
      bumpData();
      setShowPaySheet(false);
      toast.show(`Payment logged · +${money(result.principalAmount)} available`);
    } finally {
      setSaving(false);
    }
  }, [debt, rvTotal, rvNewAvail, rvAccount, bumpData, toast]);

  const handleFriendLoanPay = useCallback(async () => {
    if (!debt) return;
    const amount = parseFloat(flAmount);
    if (!amount || !flAccount) return;
    setSaving(true);
    try {
      const tx = await repos.transactions.create({
        accountId: flAccount,
        type: 'expense',
        amount,
        date: flDate,
        categoryId: null,
        itemId: null,
        paymentMethodNote: `Repayment: ${debt.name}`,
        counterparty: debt.counterparty,
        clientId: null,
        transferKind: null,
        feeAmount: null,
        linkedTransactionId: null,
        source: 'detailed',
        note: null,
      });
      await repos.loanPayments.create({
        debtId: debt.id,
        date: flDate,
        totalAmount: amount,
        principalAmount: amount,
        interestAmount: 0,
        feeAmount: 0,
        sourceTransactionRef: tx.id,
      });
      const newRemaining = calcFriendLoanRemaining(debt.totalOwed ?? 0, [
        ...payments,
        { id: '', debtId: debt.id, date: flDate, totalAmount: amount, principalAmount: amount, interestAmount: 0, feeAmount: 0, sourceTransactionRef: tx.id },
      ]);
      if (newRemaining <= 0) {
        await repos.debts.update(debt.id, { status: 'paid' });
      }
      bumpData();
      setShowPaySheet(false);
      toast.show(`Logged repayment of ${money(amount)} ${currency}`);
    } finally {
      setSaving(false);
    }
  }, [debt, flAmount, flDate, flAccount, payments, bumpData, currency, toast]);

  if (!debt) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const isPaid = debt.status === 'paid';

  // ---- render by type ----

  if (debt.debtType === 'term_loan') {
    const remaining = calcTermLoanRemaining(debt.principalDisbursed ?? 0, payments);
    const progress = calcTermLoanProgress(debt.principalDisbursed ?? 0, payments);
    const principalPaid = payments.reduce((s, p) => s + p.principalAmount, 0);
    const interestPaid = payments.reduce((s, p) => s + p.interestAmount, 0);
    const feesPaid = payments.reduce((s, p) => s + p.feeAmount, 0);
    const realCost = payments.reduce((s, p) => s + p.totalAmount, 0);

    return (
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={20} color={colors.dim} />
          </Pressable>
          <Text style={s.title} numberOfLines={1}>{debt.name}</Text>
          <Pressable onPress={handleArchive} hitSlop={8}>
            <Trash2 size={18} color={colors.faint} />
          </Pressable>
        </View>

        {isPaid && <Text style={s.paidBadge}>PAID OFF</Text>}

        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Remaining</Text>
            <Text style={s.statValue}>{money(remaining)} {currency}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Real cost so far</Text>
            <Text style={s.statValue}>{money(realCost)} {currency}</Text>
          </View>
        </View>

        <View style={s.bar}>
          <ProgressBar value={progress} />
        </View>

        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Principal paid</Text>
            <Text style={s.statValue}>{money(principalPaid)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Interest paid</Text>
            <Text style={s.statValue}>{money(interestPaid)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Fees paid</Text>
            <Text style={s.statValue}>{money(feesPaid)}</Text>
          </View>
        </View>

        {!isPaid && (
          <Button title="Log payment" onPress={() => setShowPaySheet(true)} style={s.payBtn} />
        )}

        <Text style={s.histLabel}>Payment history</Text>
        {payments.length === 0
          ? <Text style={s.empty}>No payments logged yet.</Text>
          : payments.map(p => (
            <View key={p.id} style={s.payRow}>
              <Text style={s.payDate}>{p.date}</Text>
              <Text style={s.payAmt}>{money(p.totalAmount)} {currency}</Text>
            </View>
          ))
        }

        {showPaySheet && (
          <Sheet title="Log payment" onClose={() => setShowPaySheet(false)}>
            <Field label="Total amount">
              <Input value={pTotal} onChangeText={setPTotal} keyboardType="decimal-pad"
                placeholder={suggestedFields.total !== undefined && !pTotal ? String(suggestedFields.total) : '0'} />
            </Field>
            <Field label="Principal">
              <Input value={pPrincipal} onChangeText={setPPrincipal} keyboardType="decimal-pad"
                placeholder={suggestedFields.principal !== undefined && !pPrincipal ? String(suggestedFields.principal) : '0'} />
            </Field>
            <Field label="Interest">
              <Input value={pInterest} onChangeText={setPInterest} keyboardType="decimal-pad"
                placeholder={suggestedFields.interest !== undefined && !pInterest ? String(suggestedFields.interest) : '0'} />
            </Field>
            <Field label="Late fee (optional)">
              <Input value={pFee} onChangeText={setPFee} keyboardType="decimal-pad"
                placeholder={suggestedFields.fee !== undefined && !pFee ? String(suggestedFields.fee) : '0'} />
            </Field>
            <Field label="Paid from account">
              <Select
                title="Account"
                value={pAccount}
                options={[{ value: '', label: 'Select account' }, ...accountOptions]}
                onChange={setPAccount}
              />
            </Field>
            <Field label="Date">
              <Input value={pDate} onChangeText={setPDate} placeholder="YYYY-MM-DD" />
            </Field>
            {saving
              ? <ActivityIndicator color={colors.gold} />
              : <Button title="Confirm payment" onPress={handleTermLoanPay} style={{ marginTop: 8 }} />}
          </Sheet>
        )}
      </ScrollView>
    );
  }

  if (debt.debtType === 'revolving_credit') {
    const gaugeVal = (debt.creditLimit ?? 0) > 0
      ? (debt.availableBalance ?? 0) / (debt.creditLimit ?? 1)
      : 0;
    const allEvents = [
      ...payments.map(p => ({ date: p.date, label: 'Payment', amount: p.totalAmount, kind: 'payment' as const })),
      ...transactions.map(t => ({ date: t.date, label: t.paymentMethodNote ?? 'Purchase', amount: t.amount, kind: t.type === 'expense' ? 'purchase' as const : 'withdrawal' as const })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return (
      <ScrollView style={s.root} contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={20} color={colors.dim} />
          </Pressable>
          <Text style={s.title} numberOfLines={1}>{debt.name}</Text>
          <Pressable onPress={handleArchive} hitSlop={8}>
            <Trash2 size={18} color={colors.faint} />
          </Pressable>
        </View>

        <View style={s.revHeader}>
          <Text style={s.revAvailLabel}>Available</Text>
          <Text style={s.revAvailAmount}>{money(debt.availableBalance ?? 0)} {currency}</Text>
          <Text style={s.revLimit}>of {money(debt.creditLimit ?? 0)} limit</Text>
        </View>

        <View style={s.bar}>
          <Gauge value={gaugeVal} />
        </View>

        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Lifetime interest</Text>
            <Text style={s.statValue}>{money(debt.totalInterestPaid ?? 0)} {currency}</Text>
          </View>
        </View>

        <Button title="Log payment" onPress={() => setShowPaySheet(true)} style={s.payBtn} />

        <Text style={s.histLabel}>History</Text>
        {allEvents.length === 0
          ? <Text style={s.empty}>No activity yet.</Text>
          : allEvents.map((e, i) => (
            <View key={i} style={s.payRow}>
              <View>
                <Text style={s.payDate}>{e.date}</Text>
                <Text style={s.payLabel}>{e.label}</Text>
              </View>
              <Text style={[s.payAmt, e.kind === 'payment' ? s.incomeText : s.expenseText]}>
                {e.kind === 'payment' ? '+' : '-'}{money(e.amount)} {currency}
              </Text>
            </View>
          ))
        }

        {showPaySheet && (
          <Sheet title="Log card payment" onClose={() => setShowPaySheet(false)}>
            <Text style={s.revNote}>
              Available before: {money(debt.availableBalance ?? 0)} {currency}
            </Text>
            <Field label="Total amount paid">
              <Input value={rvTotal} onChangeText={setRvTotal} keyboardType="decimal-pad" placeholder="0" autoFocus />
            </Field>
            <Field label="New available (from bank)">
              <Input value={rvNewAvail} onChangeText={setRvNewAvail} keyboardType="decimal-pad" placeholder="0" />
            </Field>
            <Field label="Deducted from account">
              <Input value={rvAccount} onChangeText={setRvAccount} placeholder="Account ID" />
            </Field>
            {rvTotal && rvNewAvail && (
              <View style={s.calcPreview}>
                <Text style={s.calcLine}>
                  Principal: {money(parseFloat(rvNewAvail) - (debt.availableBalance ?? 0))} {currency}
                </Text>
                <Text style={s.calcLine}>
                  Interest: {money(parseFloat(rvTotal) - (parseFloat(rvNewAvail) - (debt.availableBalance ?? 0)))} {currency}
                </Text>
              </View>
            )}
            {saving
              ? <ActivityIndicator color={colors.gold} />
              : <Button title="Confirm payment" onPress={handleRevolvingPay} style={{ marginTop: 8 }} />}
          </Sheet>
        )}
      </ScrollView>
    );
  }

  // Friend loan
  const flRemaining = calcFriendLoanRemaining(debt.totalOwed ?? 0, payments);
  const flProgress = calcFriendLoanProgress(debt.totalOwed ?? 0, payments);
  const flPrincipalPaid = payments.reduce((s, p) => s + p.principalAmount, 0);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{debt.name}</Text>
        <Pressable onPress={handleArchive} hitSlop={8}>
          <Trash2 size={18} color={colors.faint} />
        </Pressable>
      </View>

      {debt.counterparty && <Text style={s.counterparty}>With {debt.counterparty}</Text>}
      {isPaid && <Text style={s.paidBadge}>PAID OFF</Text>}

      <View style={s.statRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Remaining</Text>
          <Text style={s.statValue}>{money(flRemaining)} {currency}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>Paid so far</Text>
          <Text style={s.statValue}>{money(flPrincipalPaid)} {currency}</Text>
        </View>
      </View>

      <View style={s.bar}>
        <ProgressBar value={flProgress} />
      </View>

      {!isPaid && (
        <Button title="Log payment" onPress={() => setShowPaySheet(true)} style={s.payBtn} />
      )}

      <Text style={s.histLabel}>Payment history</Text>
      {payments.length === 0
        ? <Text style={s.empty}>No payments yet.</Text>
        : payments.map(p => (
          <View key={p.id} style={s.payRow}>
            <Text style={s.payDate}>{p.date}</Text>
            <Text style={s.payAmt}>{money(p.totalAmount)} {currency}</Text>
          </View>
        ))
      }

      {showPaySheet && (
        <Sheet title="Log repayment" onClose={() => setShowPaySheet(false)}>
          <Field label="Amount paid">
            <Input value={flAmount} onChangeText={setFlAmount} keyboardType="decimal-pad" placeholder="0" autoFocus />
          </Field>
          <Field label="Date">
            <Input value={flDate} onChangeText={setFlDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="Paid from account">
            <Input value={flAccount} onChangeText={setFlAccount} placeholder="Account ID" />
          </Field>
          {saving
            ? <ActivityIndicator color={colors.gold} />
            : <Button title="Confirm repayment" onPress={handleFriendLoanPay} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    marginBottom: 20,
  },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text, flex: 1, marginHorizontal: 12 },
  paidBadge: { fontSize: typeScale.sm, color: colors.green, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 },
  counterparty: { fontSize: typeScale.md, color: colors.dim, marginBottom: 12 },
  statRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  stat: { flex: 1 },
  statLabel: { fontSize: typeScale.xs, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  statValue: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  bar: { marginBottom: 20 },
  payBtn: { marginBottom: 24 },
  histLabel: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  payDate: { fontSize: typeScale.sm, color: colors.faint },
  payLabel: { fontSize: typeScale.md, color: colors.dim },
  payAmt: { fontSize: typeScale.lg, fontWeight: '500', color: colors.text },
  incomeText: { color: colors.green },
  expenseText: { color: colors.red },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingVertical: 12 },
  revHeader: { alignItems: 'center', marginBottom: 16 },
  revAvailLabel: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4 },
  revAvailAmount: { fontSize: 36, fontWeight: '700', color: colors.text, marginVertical: 4 },
  revLimit: { fontSize: typeScale.md, color: colors.faint },
  revNote: { fontSize: typeScale.sm, color: colors.dim, marginBottom: 12 },
  calcPreview: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calcLine: { fontSize: typeScale.md, color: colors.dim, marginBottom: 2 },
});
