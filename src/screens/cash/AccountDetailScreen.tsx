import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import type { Account, BalanceCorrection, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { calcUnbilledSpending } from '../../logic/unbilledSpending';
import { calcBankFeeSplit } from '../../logic/bankFeeSplit';
import { useQuickAdd } from '../../context/QuickAddContext';
import { Sheet, Button, Field, Input, TxRow, Select, useToast } from '../../theme/components';
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
  const quickAdd = useQuickAdd();

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [corrections, setCorrections] = useState<BalanceCorrection[]>([]);
  const [editing, setEditing] = useState(false);
  const [accName, setAccName] = useState('');
  const [showUpdateTotal, setShowUpdateTotal] = useState(false);
  const [actualBalance, setActualBalance] = useState('');
  const [saving, setSaving] = useState(false);

  const [showAddTxSheet, setShowAddTxSheet] = useState(false);
  const [txFlow, setTxFlow] = useState<'menu' | 'cash' | 'friend_loan' | 'transfer'>('menu');

  // data lists
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<import('../../types').Client[]>([]);

  // form cash
  const [cashAmount, setCashAmount] = useState('');
  const [cashType, setCashType] = useState<'client' | 'personal'>('client');
  const [clientId, setClientId] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [newBalanceInput, setNewBalanceInput] = useState('');

  // form friend loan
  const [friendAmount, setFriendAmount] = useState('');
  const [friendFrom, setFriendFrom] = useState('');

  // form transfer
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSourceId, setTransferSourceId] = useState('');

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    const [acc, txs, corrs, accs, cls] = await Promise.all([
      repos.accounts.get(accountId),
      repos.transactions.list({ accountId }),
      repos.balanceCorrections.listForAccount(accountId),
      repos.accounts.list(),
      repos.clients.list(),
    ]);
    setAccount(acc);
    setTransactions(txs.filter(t => !t.isArchived));
    setCorrections(corrs);
    if (acc) setAccName(acc.name);
    setAllAccounts(accs);
    setClients(cls);
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

  const handlePaidInCash = useCallback(async () => {
    if (!account) return;
    const amount = parseFloat(cashAmount);
    if (!amount || isNaN(amount)) return;
    setSaving(true);
    try {
      let finalAmount = amount;
      let feeAmount = 0;

      if (account.type !== 'cash' && newBalanceInput) {
        const newBal = parseFloat(newBalanceInput);
        if (!isNaN(newBal)) {
          const result = calcBankFeeSplit({
            currentBalance: account.runningBalance,
            amountReceived: amount,
            newBalance: newBal,
          });
          if (result.discrepancy) {
            Alert.alert('Discrepancy', 'The resulting balance does not match expectations (derived fee is zero or negative). Please double check your input.');
            setSaving(false);
            return;
          }
          finalAmount = result.netIncome;
          feeAmount = result.fee;
        }
      }

      // Find or create category for bank fees if fee exists
      let feeCatId: string | null = null;
      if (feeAmount > 0) {
        const cats = await repos.categories.list(true);
        let cat = cats.find(c => c.name === 'Bank account fees');
        if (!cat) {
          cat = await repos.categories.create({
            name: 'Bank account fees',
            emoji: '🏦',
            monthlyBudget: null,
            lessSpendGoal: false,
          });
        }
        feeCatId = cat.id;
      }

      const isClient = cashType === 'client';
      
      await repos.transactions.create({
        accountId: account.id,
        type: 'income',
        amount: finalAmount,
        date: todayIso(),
        categoryId: null,
        itemId: null,
        paymentMethodNote: isClient ? 'Client work deposit' : 'Personal deposit',
        counterparty: isClient ? null : counterparty || null,
        clientId: isClient ? clientId || null : null,
        transferKind: isClient ? 'client' : 'personal',
        feeAmount: null,
        linkedTransactionId: null,
        source: 'detailed',
        note: null,
      });

      if (feeAmount > 0) {
        await repos.transactions.create({
          accountId: account.id,
          type: 'expense',
          amount: feeAmount,
          date: todayIso(),
          categoryId: feeCatId,
          itemId: null,
          paymentMethodNote: 'Bank deposit fee',
          counterparty: null,
          clientId: null,
          transferKind: null,
          feeAmount: null,
          linkedTransactionId: null,
          source: 'detailed',
          note: null,
        });
      }

      bumpData();
      setShowAddTxSheet(false);
      setCashAmount(''); setNewBalanceInput(''); setCounterparty(''); setClientId('');
      toast.show(`Logged deposit of ${money(amount)} ${currency}`);
    } finally {
      setSaving(false);
    }
  }, [account, cashAmount, cashType, clientId, counterparty, newBalanceInput, bumpData, currency, toast]);

  const handleFriendLoan = useCallback(async () => {
    if (!account) return;
    const amount = parseFloat(friendAmount);
    if (!amount || isNaN(amount) || !friendFrom.trim()) return;
    setSaving(true);
    try {
      // Create friend loan debt first
      await repos.debts.create({
        name: `Friend loan: ${friendFrom}`,
        debtType: 'friend_loan',
        linkedAccountId: account.id,
        counterparty: friendFrom,
        principalDisbursed: null,
        creditLimit: null,
        availableBalance: null,
        totalInterestPaid: 0,
        totalOwed: amount,
        monthlyAmount: null,
        dueDate: null,
        sortOrder: null,
        startDate: todayIso(),
        endDate: null,
        interestRate: null,
        interestType: null,
        status: 'active',
      });

      // Create income transaction
      await repos.transactions.create({
        accountId: account.id,
        type: 'income',
        amount,
        date: todayIso(),
        categoryId: null,
        itemId: null,
        paymentMethodNote: `Friend loan from ${friendFrom}`,
        counterparty: friendFrom,
        clientId: null,
        transferKind: null,
        feeAmount: null,
        linkedTransactionId: null,
        source: 'detailed',
        note: null,
      });

      bumpData();
      setShowAddTxSheet(false);
      setFriendAmount(''); setFriendFrom('');
      toast.show(`Logged loan of ${money(amount)} ${currency}`);
    } finally {
      setSaving(false);
    }
  }, [account, friendAmount, friendFrom, bumpData, currency, toast]);

  const handleTransfer = useCallback(async () => {
    if (!account) return;
    const amount = parseFloat(transferAmount);
    if (!amount || isNaN(amount) || !transferSourceId) return;
    setSaving(true);
    try {
      await repos.transactions.createTransferPair(
        {
          accountId: transferSourceId,
          type: 'transfer_out',
          amount,
          date: todayIso(),
          categoryId: null,
          itemId: null,
          paymentMethodNote: `Transfer to ${account.name}`,
          counterparty: null,
          clientId: null,
          transferKind: null,
          feeAmount: null,
          source: 'detailed',
          note: null,
        },
         {
           accountId: account.id,
           type: 'transfer_in',
           amount,
           date: todayIso(),
           categoryId: null,
           itemId: null,
           paymentMethodNote: `Transfer from ${allAccounts.find(a => a.id === transferSourceId)?.name ?? 'Account'}`,
           counterparty: null,
           clientId: null,
           transferKind: null,
           feeAmount: null,
           source: 'detailed',
           note: null,
         }
       );
       bumpData();
       setShowAddTxSheet(false);
       setTransferAmount(''); setTransferSourceId('');
       toast.show(`Transferred ${money(amount)} ${currency}`);
     } finally {
       setSaving(false);
     }
   }, [account, transferAmount, transferSourceId, allAccounts, bumpData, currency, toast]);

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

      <View style={s.actionRow}>
        <Pressable style={[s.actionBtn, { marginRight: 8 }]} onPress={() => setShowUpdateTotal(true)}>
          <Text style={s.actionBtnText}>Reconcile</Text>
        </Pressable>
        <Pressable style={s.actionBtn} onPress={() => { setTxFlow('menu'); setShowAddTxSheet(true); }}>
          <Text style={s.actionBtnText}>Add money / expense</Text>
        </Pressable>
      </View>

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
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Save" onPress={handleSaveEdit} style={{ marginTop: 8 }} />}
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
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Save correction" onPress={handleUpdateTotal} style={{ marginTop: 8 }} />}
        </Sheet>
      )}

      {showAddTxSheet && (
        <Sheet title={txFlow === 'menu' ? 'Add transaction' : 'Log entry'} onClose={() => setShowAddTxSheet(false)}>
          {txFlow === 'menu' && (
            <View>
              <Pressable
                style={s.flowBtn}
                onPress={() => {
                  setShowAddTxSheet(false);
                  quickAdd.open(accountId);
                }}
              >
                <Text style={s.flowBtnText}>Quick-add expense</Text>
              </Pressable>

              <Pressable style={s.flowBtn} onPress={() => setTxFlow('cash')}>
                <Text style={s.flowBtnText}>Paid in cash (Income)</Text>
              </Pressable>

              <Pressable style={s.flowBtn} onPress={() => setTxFlow('friend_loan')}>
                <Text style={s.flowBtnText}>Loan from a friend</Text>
              </Pressable>

              <Pressable style={s.flowBtn} onPress={() => setTxFlow('transfer')}>
                <Text style={s.flowBtnText}>Transfer from another account</Text>
              </Pressable>
            </View>
          )}

          {txFlow === 'cash' && (
            <View>
              <Pressable style={s.backBtn} onPress={() => setTxFlow('menu')}>
                <Text style={s.backBtnText}>← Back</Text>
              </Pressable>

              <Pressable
                style={s.toggleRow}
                onPress={() => setCashType(v => (v === 'client' ? 'personal' : 'client'))}
              >
                <Text style={s.toggleLabel}>Client work? (otherwise personal)</Text>
                <View style={[s.toggle, cashType === 'client' && s.toggleOn]}>
                  <View style={[s.toggleThumb, cashType === 'client' && s.toggleThumbOn]} />
                </View>
              </Pressable>

              {cashType === 'client' ? (
                <Field label="Select Client">
                  <Select
                    title="Client"
                    value={clientId}
                    options={[{ value: '', label: 'Select client' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                    onChange={setClientId}
                  />
                </Field>
              ) : (
                <Field label="Who is it from?">
                  <Input value={counterparty} onChangeText={setCounterparty} placeholder="e.g. John Doe" />
                </Field>
              )}

              <Field label="Amount received (gross)">
                <Input value={cashAmount} onChangeText={setCashAmount} keyboardType="decimal-pad" placeholder="0" autoFocus />
              </Field>

              {account.type !== 'cash' && (
                <Field label="Your new balance (to calculate bank fee automatically)">
                  <Input
                    value={newBalanceInput}
                    onChangeText={setNewBalanceInput}
                    keyboardType="decimal-pad"
                    placeholder={`${money(account.runningBalance + (parseFloat(cashAmount) || 0))} ${currency}`}
                  />
                </Field>
              )}

              {saving ? (
                <ActivityIndicator color={colors.gold} style={{ marginVertical: 12 }} />
              ) : (
                <Button
                  title="Log Income"
                  onPress={handlePaidInCash}
                  disabled={!cashAmount || (cashType === 'client' && !clientId)}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          )}

          {txFlow === 'friend_loan' && (
            <View>
              <Pressable style={s.backBtn} onPress={() => setTxFlow('menu')}>
                <Text style={s.backBtnText}>← Back</Text>
              </Pressable>

              <Field label="Amount">
                <Input value={friendAmount} onChangeText={setFriendAmount} keyboardType="decimal-pad" placeholder="0" autoFocus />
              </Field>

              <Field label="Friend's Name">
                <Input value={friendFrom} onChangeText={setFriendFrom} placeholder="Who is lending you this?" />
              </Field>

              {saving ? (
                <ActivityIndicator color={colors.gold} style={{ marginVertical: 12 }} />
              ) : (
                <Button
                  title="Log Friend Loan"
                  onPress={handleFriendLoan}
                  disabled={!friendAmount || !friendFrom.trim()}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          )}

          {txFlow === 'transfer' && (
            <View>
              <Pressable style={s.backBtn} onPress={() => setTxFlow('menu')}>
                <Text style={s.backBtnText}>← Back</Text>
              </Pressable>

              <Field label="Transfer Amount">
                <Input value={transferAmount} onChangeText={setTransferAmount} keyboardType="decimal-pad" placeholder="0" autoFocus />
              </Field>

              <Field label="From Account">
                <Select
                  title="Source account"
                  value={transferSourceId}
                  options={[{ value: '', label: 'Select source' }, ...allAccounts.filter(a => a.id !== account.id).map(a => ({ value: a.id, label: a.name }))]}
                  onChange={setTransferSourceId}
                />
              </Field>

              {saving ? (
                <ActivityIndicator color={colors.gold} style={{ marginVertical: 12 }} />
              ) : (
                <Button
                  title="Execute Transfer"
                  onPress={handleTransfer}
                  disabled={!transferAmount || !transferSourceId}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          )}
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
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 10, alignItems: 'center' },
  actionBtnText: { fontSize: typeScale.md, color: colors.gold },
  flowBtn: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 14, marginBottom: 8, alignItems: 'center' },
  flowBtnText: { fontSize: typeScale.lg, color: colors.text, fontWeight: '500' },
  backBtn: { padding: 10, alignSelf: 'flex-start', marginBottom: 12 },
  backBtnText: { fontSize: typeScale.md, color: colors.gold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleLabel: { fontSize: typeScale.lg, color: colors.text },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: colors.gold },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.dim },
  toggleThumbOn: { backgroundColor: colors.bg, alignSelf: 'flex-end' },
});
