import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react-native';
import type { Account, Debt } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { calcTermLoanRemaining, calcFriendLoanRemaining, calcTermLoanProgress, calcFriendLoanProgress } from '../../logic/debtMath';
import { Sheet, Button, Field, Input, Select, Chip, DatePickerField } from '../../theme/components';
import { colors, colorsExtra, money, radii, spacing, typeScale } from '../../theme/tokens';
import type { DrawerParamList, RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { todayIso } from '../../db/client';

type Nav = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type DebtType = 'term_loan' | 'revolving_credit' | 'friend_loan';

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  term_loan: 'Term loan',
  revolving_credit: 'Revolving credit',
  friend_loan: 'Friend loan',
};

export function LoansScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, settings, dataVersion, bumpData } = useApp();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loanPayments, setLoanPayments] = useState<Record<string, import('../../types').LoanPayment[]>>({});
  const [showAdd, setShowAdd] = useState(false);

  // edit state
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [editName, setEditName] = useState('');
  const [editMonthly, setEditMonthly] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // add form
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<DebtType>('term_loan');
  const [addPrincipal, setAddPrincipal] = useState('');
  const [addCreditLimit, setAddCreditLimit] = useState('');
  const [addAvailable, setAddAvailable] = useState('');
  const [addTotalOwed, setAddTotalOwed] = useState('');
  const [addCounterparty, setAddCounterparty] = useState('');
  const [addMonthly, setAddMonthly] = useState('');
  const [addLinkedAccount, setAddLinkedAccount] = useState('');
  const [addPrincipalPaid, setAddPrincipalPaid] = useState('');
  const [addInterestPaid, setAddInterestPaid] = useState('');
  const [addIsNew, setAddIsNew] = useState(true);
  const [addStartDate, setAddStartDate] = useState(todayIso());
  const [addEndDate, setAddEndDate] = useState('');
  const [addInterestRate, setAddInterestRate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [dbts, accs] = await Promise.all([
      repos.debts.list(true),
      repos.accounts.list(),
    ]);
    setDebts(dbts);
    setAccounts(accs);
    const lpLists = await Promise.all(dbts.map(d => repos.loanPayments.listForDebt(d.id)));
    const byDebt: Record<string, import('../../types').LoanPayment[]> = {};
    dbts.forEach((d, i) => { byDebt[d.id] = lpLists[i]; });
    setLoanPayments(byDebt);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const currency = settings?.currency ?? 'TND';

  const openEdit = (debt: Debt) => {
    setEditDebt(debt);
    setEditName(debt.name);
    setEditMonthly(debt.monthlyAmount != null ? String(debt.monthlyAmount) : '');
    setEditStartDate(debt.startDate ?? '');
    setEditEndDate(debt.endDate ?? '');
    setEditInterestRate(debt.interestRate != null ? String(debt.interestRate) : '');
  };

  const handleEdit = useCallback(async () => {
    if (!editDebt || !editName.trim()) return;
    setEditSaving(true);
    try {
      await repos.debts.update(editDebt.id, {
        name: editName.trim(),
        monthlyAmount: parseFloat(editMonthly) || null,
        startDate: editStartDate || null,
        endDate: editEndDate || null,
        interestRate: parseFloat(editInterestRate) || null,
      });
      bumpData();
      setEditDebt(null);
    } finally {
      setEditSaving(false);
    }
  }, [editDebt, editName, editMonthly, editStartDate, editEndDate, editInterestRate, bumpData]);

  const handleAdd = useCallback(async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      const base = {
        name: addName.trim(),
        debtType: addType,
        linkedAccountId: addLinkedAccount || null,
        counterparty: addType === 'friend_loan' ? addCounterparty || null : null,
        principalDisbursed: addType === 'term_loan' ? parseFloat(addPrincipal) || null : null,
        creditLimit: addType === 'revolving_credit' ? parseFloat(addCreditLimit) || null : null,
        availableBalance: addType === 'revolving_credit' ? parseFloat(addAvailable) || 0 : null,
        totalInterestPaid: addType === 'revolving_credit' ? 0 : null,
        totalOwed: addType === 'friend_loan' ? parseFloat(addTotalOwed) || null : null,
        monthlyAmount: parseFloat(addMonthly) || null,
        dueDate: null,
        sortOrder: addType === 'revolving_credit' ? 999 : null,
        startDate: addType === 'term_loan' ? (addStartDate || todayIso()) : todayIso(),
        endDate: addType === 'term_loan' ? (addEndDate || null) : null,
        interestRate: addType === 'term_loan' ? (parseFloat(addInterestRate) || null) : null,
        status: 'active' as const,
      };
      const debt = await repos.debts.create(base);

      if (addType === 'term_loan') {
        const histPrincipal = parseFloat(addPrincipalPaid) || 0;
        const histInterest = parseFloat(addInterestPaid) || 0;
        if (histPrincipal > 0 || histInterest > 0) {
          await repos.loanPayments.create({
            debtId: debt.id,
            date: base.startDate,
            totalAmount: histPrincipal + histInterest,
            principalAmount: histPrincipal,
            interestAmount: histInterest,
            feeAmount: 0,
            sourceTransactionRef: null,
          });
          if (base.principalDisbursed && histPrincipal >= base.principalDisbursed) {
            await repos.debts.update(debt.id, { status: 'paid' });
          }
        }
      }

      if (base.linkedAccountId && addIsNew) {
        let amount = 0;
        if (addType === 'term_loan' && base.principalDisbursed) {
          amount = base.principalDisbursed;
        } else if (addType === 'friend_loan' && base.totalOwed) {
          amount = base.totalOwed;
        }

        if (amount > 0) {
          const cats = await repos.categories.list(true);
          let loanCat = cats.find(c => c.name.toLowerCase() === 'loans');
          if (!loanCat) {
            loanCat = await repos.categories.create({
              name: 'Loans',
              emoji: '💰',
              monthlyBudget: null,
              lessSpendGoal: false,
            });
          }

          await repos.transactions.create({
            accountId: base.linkedAccountId,
            type: 'income',
            amount,
            date: base.startDate,
            categoryId: loanCat.id,
            itemId: null,
            paymentMethodNote: `Disbursement: ${base.name}`,
            counterparty: base.counterparty || null,
            clientId: null,
            transferKind: null,
            feeAmount: null,
            linkedTransactionId: null,
            source: 'detailed',
            note: `Loan principal disbursed`,
          });
        }
      }

      bumpData();
      setShowAdd(false);
      setAddName('');
      setAddPrincipal('');
      setAddCreditLimit('');
      setAddAvailable('');
      setAddTotalOwed('');
      setAddCounterparty('');
      setAddMonthly('');
      setAddLinkedAccount('');
      setAddPrincipalPaid('');
      setAddInterestPaid('');
      setAddIsNew(true);
      setAddStartDate(todayIso());
      setAddEndDate('');
      setAddInterestRate('');
    } finally {
      setSaving(false);
    }
  }, [
    addName, addType, addLinkedAccount, addCounterparty, addPrincipal,
    addCreditLimit, addAvailable, addTotalOwed, addMonthly, addPrincipalPaid,
    addInterestPaid, addIsNew, addStartDate, addEndDate, addInterestRate, bumpData,
  ]);

  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));

  const active = debts.filter(d => !d.isArchived && d.status === 'active');
  const paid = debts.filter(d => !d.isArchived && d.status === 'paid');

  const renderDebt = (debt: Debt) => {
    const payments = loanPayments[debt.id] ?? [];
    let subtitle = '';
    let progress = 0;
    let showProgress = false;

    if (debt.debtType === 'term_loan') {
      const remaining = calcTermLoanRemaining(debt.principalDisbursed ?? 0, payments);
      progress = calcTermLoanProgress(debt.principalDisbursed ?? 0, payments);
      subtitle = `${money(remaining)} ${currency} remaining`;
      showProgress = true;
    } else if (debt.debtType === 'revolving_credit') {
      subtitle = `${money(debt.availableBalance ?? 0)} ${currency} available`;
    } else {
      const remaining = calcFriendLoanRemaining(debt.totalOwed ?? 0, payments);
      progress = calcFriendLoanProgress(debt.totalOwed ?? 0, payments);
      subtitle = `${money(remaining)} ${currency} remaining${debt.counterparty ? ` · ${debt.counterparty}` : ''}`;
      showProgress = true;
    }

    return (
      <Pressable
        key={debt.id}
        style={s.debtRow}
        onPress={() => navigation.navigate('DebtDetail', { debtId: debt.id })}
      >
        <View style={s.debtMain}>
          <View style={s.debtLeft}>
            <Text style={s.debtName}>{debt.name}</Text>
            <Text style={s.debtSub}>{subtitle}</Text>
          </View>
          <View style={s.debtRight}>
            {debt.status === 'paid' && <Text style={s.paidBadge}>PAID</Text>}
            <Pressable
              hitSlop={10}
              onPress={(e) => { e.stopPropagation(); openEdit(debt); }}
              style={s.editBtn}
            >
              <Pencil size={13} color={colors.faint} />
            </Pressable>
            <ChevronRight size={14} color={colors.faint} />
          </View>
        </View>

        {showProgress && (
          <View style={s.progressBg}>
            <View
              style={[
                s.progressFill,
                { width: `${Math.min(100, progress * 100)}%` },
                debt.status === 'paid' && { backgroundColor: colors.green },
              ]}
            />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title}>Loans & debts</Text>
        <Pressable onPress={() => setShowAdd(true)} hitSlop={8}>
          <Plus size={20} color={colors.gold} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {active.length === 0 && paid.length === 0 && (
          <Text style={s.empty}>No debts yet. Tap + to add one.</Text>
        )}

        {active.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Active</Text>
            {active.map(renderDebt)}
          </>
        )}

        {paid.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Paid off</Text>
            {paid.map(renderDebt)}
          </>
        )}
      </ScrollView>

      {/* Edit debt sheet */}
      {editDebt && (
        <Sheet title="Edit loan" onClose={() => setEditDebt(null)}>
          <Field label="Name">
            <Input value={editName} onChangeText={setEditName} autoFocus />
          </Field>
          <Field label="Monthly amount (informational)">
            <Input value={editMonthly} onChangeText={setEditMonthly} keyboardType="decimal-pad" placeholder="0" />
          </Field>
          {editDebt.debtType === 'term_loan' && (
            <>
              <Field label="Start date">
                <DatePickerField value={editStartDate} onChange={setEditStartDate} placeholder="Pick start date" />
              </Field>
              <Field label="End date (final payment date)">
                <DatePickerField value={editEndDate} onChange={setEditEndDate} placeholder="Pick end date" />
              </Field>
              <Field label="Annual interest rate (%)">
                <Input value={editInterestRate} onChangeText={setEditInterestRate} keyboardType="decimal-pad" placeholder="e.g. 8.5" />
              </Field>
            </>
          )}
          {editSaving
            ? <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />
            : <Button title="Save" onPress={handleEdit} disabled={!editName.trim()} style={{ marginTop: 8 }} />}
        </Sheet>
      )}

      {/* Add debt sheet */}
      {showAdd && (
        <Sheet title="Add debt" onClose={() => setShowAdd(false)}>
          <Field label="Name">
            <Input
              value={addName}
              onChangeText={setAddName}
              placeholder="e.g. Car loan"
              autoFocus
            />
          </Field>

          <Text style={s.typeLabel}>Type</Text>
          <View style={s.typeRow}>
            {(['term_loan', 'revolving_credit', 'friend_loan'] as DebtType[]).map(t => (
              <Chip key={t} active={addType === t} onPress={() => setAddType(t)}>
                {DEBT_TYPE_LABELS[t]}
              </Chip>
            ))}
          </View>

          {addType === 'term_loan' && (
            <>
              <Field label="Principal amount (total disbursed)">
                <Input value={addPrincipal} onChangeText={setAddPrincipal} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Start date">
                <DatePickerField value={addStartDate} onChange={setAddStartDate} />
              </Field>
              <Field label="End date (final payment date)">
                <DatePickerField value={addEndDate} onChange={setAddEndDate} placeholder="Pick end date" />
              </Field>
              <Field label="Annual interest rate (%)">
                <Input value={addInterestRate} onChangeText={setAddInterestRate} keyboardType="decimal-pad" placeholder="e.g. 8.5" />
              </Field>
              <Field label="Monthly instalment">
                <Input value={addMonthly} onChangeText={setAddMonthly} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Principal already paid (optional)">
                <Input value={addPrincipalPaid} onChangeText={setAddPrincipalPaid} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Interest already paid (optional)">
                <Input value={addInterestPaid} onChangeText={setAddInterestPaid} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Linked account (optional)">
                <Select
                  title="Account"
                  value={addLinkedAccount}
                  options={[{ value: '', label: 'None' }, ...accountOptions]}
                  onChange={setAddLinkedAccount}
                />
              </Field>
              {!!addLinkedAccount && (
                <Field label="Is this a new loan?">
                  <View style={s.typeRow}>
                    <Chip active={addIsNew === true} onPress={() => setAddIsNew(true)}>
                      Yes, add cash to account
                    </Chip>
                    <Chip active={addIsNew === false} onPress={() => setAddIsNew(false)}>
                      No, already active (historical)
                    </Chip>
                  </View>
                </Field>
              )}
            </>
          )}

          {addType === 'revolving_credit' && (
            <>
              <Field label="Credit limit (reference)">
                <Input value={addCreditLimit} onChangeText={setAddCreditLimit} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Current available amount">
                <Input value={addAvailable} onChangeText={setAddAvailable} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Linked account (optional)">
                <Select title="Account" value={addLinkedAccount} options={[{ value: '', label: 'None' }, ...accountOptions]} onChange={setAddLinkedAccount} />
              </Field>
              <Field label="Monthly amount (optional, informational)">
                <Input value={addMonthly} onChangeText={setAddMonthly} keyboardType="decimal-pad" placeholder="0" />
              </Field>
            </>
          )}

          {addType === 'friend_loan' && (
            <>
              <Field label="Who it's with">
                <Input value={addCounterparty} onChangeText={setAddCounterparty} placeholder="Name" />
              </Field>
              <Field label="Total owed">
                <Input value={addTotalOwed} onChangeText={setAddTotalOwed} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Monthly amount (optional, informational)">
                <Input value={addMonthly} onChangeText={setAddMonthly} keyboardType="decimal-pad" placeholder="0" />
              </Field>
            </>
          )}

          {saving
            ? <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />
            : <Button title="Add" onPress={handleAdd} disabled={!addName.trim()} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: typeScale.sm,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 16,
    marginBottom: 8,
  },
  debtRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 8,
  },
  debtMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  debtLeft: { flex: 1 },
  debtName: { fontSize: typeScale.lg, color: colors.text, fontWeight: '500' },
  debtSub: { fontSize: typeScale.sm, color: colors.dim, marginTop: 2 },
  debtRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: { padding: 4 },
  paidBadge: {
    fontSize: typeScale.xs,
    color: colors.green,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressBg: {
    marginTop: 10,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: radii.full,
  },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingTop: 24 },
  typeLabel: {
    fontSize: typeScale.sm,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
});
