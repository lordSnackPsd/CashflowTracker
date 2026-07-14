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
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UserPlus } from 'lucide-react-native';
import type { Client, ScheduledPayment, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import {
  Sheet, Button, Field, Input, Select, Chip, DatePickerField, useToast,
} from '../../theme/components';
import { colors, money, radii, spacing, typeScale } from '../../theme/tokens';
import type { TabParamList, RootStackParamList } from '../../navigation/types';
import { todayIso } from '../../db/client';
import { schedulePaymentReminder } from '../../services/notifications';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Business'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function BusinessScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, settings, dataVersion, bumpData } = useApp();
  const toast = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPayment[]>([]);
  const [accounts, setAccounts] = useState<import('../../types').Account[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [showLogPayment, setShowLogPayment] = useState(false);

  // log payment form
  const [lpClientId, setLpClientId] = useState('');
  const [lpAccountId, setLpAccountId] = useState('');
  const [lpAmount, setLpAmount] = useState('');
  const [lpIsAdvance, setLpIsAdvance] = useState(false);
  const [lpTotalAgreed, setLpTotalAgreed] = useState('');
  const [lpDueDate, setLpDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // add client form
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addContact, setAddContact] = useState('');

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    const [cls, txs, sps, accs] = await Promise.all([
      repos.clients.list(),
      repos.transactions.list(),
      repos.scheduledPayments.list(),
      repos.accounts.list(),
    ]);
    setClients(cls);
    setTransactions(txs.filter(t => t.transferKind === 'client'));
    setScheduled(sps.filter(s => s.status !== 'completed'));
    setAccounts(accs);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  // top 3 clients all-time
  const clientTotals = clients.map(c => ({
    client: c,
    total: transactions.filter(t => t.clientId === c.id).reduce((s, t) => s + t.amount, 0),
  })).sort((a, b) => b.total - a.total);

  const top3 = clientTotals.slice(0, 3);
  const expectedIncome = scheduled.reduce((s, sp) => s + sp.remainingAmount, 0);
  const receivedTotal = scheduled.reduce((s, sp) => s + sp.receivedSoFar, 0);
  const grandTotal = expectedIncome + receivedTotal;
  const receivedRatio = grandTotal > 0 ? receivedTotal / grandTotal : 0;

  const handleAddClient = useCallback(async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      await repos.clients.create({
        name: addName.trim(),
        matriculeFiscal: null,
        contactName: addContact || null,
        email: addEmail || null,
        phone: addPhone || null,
        logoPath: null,
      });
      bumpData();
      setShowAdd(false);
      setAddName(''); setAddEmail(''); setAddPhone(''); setAddContact('');
    } finally {
      setSaving(false);
    }
  }, [addName, addEmail, addPhone, addContact, bumpData]);

  const handleLogPayment = useCallback(async () => {
    const amount = parseFloat(lpAmount) || 0;
    if (!lpClientId) return;
    setSaving(true);
    try {
      const clientObj = clients.find(c => c.id === lpClientId);
      const clientName = clientObj ? clientObj.name : 'Client';

      let txId: string | null = null;

      // Only create an income transaction if amount > 0
      if (amount > 0 && lpAccountId) {
        const tx = await repos.transactions.create({
          accountId: lpAccountId,
          type: 'income',
          amount,
          date: todayIso(),
          categoryId: null,
          itemId: null,
          paymentMethodNote: null,
          counterparty: null,
          clientId: lpClientId,
          transferKind: 'client',
          feeAmount: null,
          linkedTransactionId: null,
          source: 'detailed',
          note: null,
        });
        txId = tx.id;
      }

      if (lpIsAdvance) {
        const total = parseFloat(lpTotalAgreed) || (amount > 0 ? amount : 0);
        let notifId: string | null = null;
        if (lpDueDate && (total - amount) > 0) {
          try {
            notifId = await schedulePaymentReminder(
              `sp-${lpClientId}-${Date.now()}`,
              clientName,
              total - amount,
              currency,
              lpDueDate,
              '11:00'
            );
          } catch (e) {
            console.error('Failed to schedule reminder:', e);
          }
        }

        await repos.scheduledPayments.create({
          clientId: lpClientId,
          totalAmount: total > 0 ? total : amount,
          receivedSoFar: amount,
          dueDate: lpDueDate || null,
          reminderTime: '11:00',
          status: amount > 0 && amount >= total ? 'completed' : amount > 0 ? 'partially_paid' : 'pending',
          advanceTransactionId: txId,
          notificationId: notifId,
        });
      }

      bumpData();
      setShowLogPayment(false);
      setLpAmount('');
      setLpTotalAgreed('');
      setLpDueDate('');
      setLpIsAdvance(false);
      setLpClientId('');
      setLpAccountId('');
      if (amount > 0) {
        toast.show(`Logged ${money(amount)} ${currency} from client`);
      } else {
        toast.show('Forecast payment created');
      }
    } finally {
      setSaving(false);
    }
  }, [lpAmount, lpClientId, lpAccountId, lpIsAdvance, lpTotalAgreed, lpDueDate, clients, currency, bumpData, toast]);

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }));
  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <Text style={s.heading}>Business</Text>
        <View style={s.headerBtns}>
          <Pressable onPress={() => setShowLogPayment(true)} style={s.headerBtn}>
            <Text style={s.headerBtnText}>Log payment</Text>
          </Pressable>
          <Pressable onPress={() => setShowAdd(true)} style={[s.headerBtn, s.addClientBtn]}>
            <UserPlus size={14} color={colors.bg} style={{ marginRight: 4 }} />
            <Text style={s.addClientBtnText}>Add client</Text>
          </Pressable>
        </View>
      </View>

      {/* Expected income card — tappable */}
      {(expectedIncome > 0 || receivedTotal > 0) && (
        <Pressable
          style={s.expectedBox}
          onPress={() => navigation.navigate('ExpectedPayments')}
        >
          <View style={s.expectedTopRow}>
            <View>
              <Text style={s.expectedLabel}>Expected income</Text>
              <Text style={s.expectedAmount}>{money(expectedIncome)} {currency}</Text>
              <Text style={s.expectedSub}>from {scheduled.length} open payment(s) · tap to manage</Text>
            </View>
            <View style={s.receivedBadge}>
              <Text style={s.receivedLabel}>Received</Text>
              <Text style={s.receivedAmt}>{money(receivedTotal)}</Text>
            </View>
          </View>

          {/* Progress graph */}
          {grandTotal > 0 && (
            <View style={s.graphContainer}>
              <View style={s.graphBar}>
                {/* Received portion */}
                <View
                  style={[
                    s.graphSegmentGreen,
                    { flex: receivedRatio },
                  ]}
                />
                {/* Outstanding portion */}
                <View
                  style={[
                    s.graphSegmentGold,
                    { flex: 1 - receivedRatio },
                  ]}
                />
              </View>
              <View style={s.graphLegend}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: colors.green }]} />
                  <Text style={s.legendText}>Received ({Math.round(receivedRatio * 100)}%)</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: colors.gold }]} />
                  <Text style={s.legendText}>Outstanding</Text>
                </View>
              </View>
            </View>
          )}
        </Pressable>
      )}

      {top3.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Top clients</Text>
          <View style={s.topGrid}>
            {top3.map(({ client, total }) => (
              <Pressable
                key={client.id}
                style={s.topTile}
                onPress={() => navigation.navigate('ClientDetail', { clientId: client.id })}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{client.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={s.tileName} numberOfLines={1}>{client.name}</Text>
                <Text style={s.tileTotal}>{money(total)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={s.sectionLabel}>All clients</Text>
      {clients.length === 0
        ? <Text style={s.empty}>No clients yet.</Text>
        : clients.filter(c => !c.isArchived).map(c => {
          const total = transactions.filter(t => t.clientId === c.id).reduce((s, t) => s + t.amount, 0);
          return (
            <Pressable
              key={c.id}
              style={s.clientRow}
              onPress={() => navigation.navigate('ClientDetail', { clientId: c.id })}
            >
              <View style={s.clientLeft}>
                <View style={s.avatarSm}>
                  <Text style={s.avatarSmText}>{c.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={s.clientName}>{c.name}</Text>
              </View>
              <Text style={s.clientTotal}>{money(total)} {currency}</Text>
            </Pressable>
          );
        })
      }

      {/* "Add client" footer row (always visible in All clients section) */}
      <Pressable style={s.addClientRow} onPress={() => setShowAdd(true)}>
        <UserPlus size={16} color={colors.gold} />
        <Text style={s.addClientRowText}>Add new client</Text>
      </Pressable>

      {showAdd && (
        <Sheet title="Add client" onClose={() => setShowAdd(false)}>
          <Field label="Name"><Input value={addName} onChangeText={setAddName} placeholder="Client name" autoFocus /></Field>
          <Field label="Contact name"><Input value={addContact} onChangeText={setAddContact} placeholder="Optional" /></Field>
          <Field label="Email"><Input value={addEmail} onChangeText={setAddEmail} placeholder="Optional" keyboardType="email-address" /></Field>
          <Field label="Phone"><Input value={addPhone} onChangeText={setAddPhone} placeholder="Optional" keyboardType="phone-pad" /></Field>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Add client" onPress={handleAddClient} disabled={!addName.trim()} style={{ marginTop: 8 }} />}
        </Sheet>
      )}

      {showLogPayment && (
        <Sheet title="Log client payment" onClose={() => setShowLogPayment(false)}>
          <Field label="Client">
            <Select
              title="Client"
              value={lpClientId}
              options={[{ value: '', label: 'Select client' }, ...clientOptions]}
              onChange={setLpClientId}
            />
          </Field>
          {/* Inline "add client" link in the sheet */}
          <Pressable style={s.inlineAddClient} onPress={() => { setShowLogPayment(false); setShowAdd(true); }}>
            <UserPlus size={13} color={colors.gold} />
            <Text style={s.inlineAddClientText}>Add new client</Text>
          </Pressable>

          <Field label="Amount received (enter 0 for forecast)">
            <Input value={lpAmount} onChangeText={setLpAmount} keyboardType="decimal-pad" placeholder="0" />
          </Field>

          {parseFloat(lpAmount) > 0 && (
            <Field label="Account received into">
              <Select title="Account" value={lpAccountId} options={[{ value: '', label: 'Select account' }, ...accountOptions]} onChange={setLpAccountId} />
            </Field>
          )}

          <Pressable style={s.toggleRow} onPress={() => setLpIsAdvance(v => !v)}>
            <Text style={s.toggleLabel}>Create scheduled payment?</Text>
            <View style={[s.toggle, lpIsAdvance && s.toggleOn]}>
              <View style={[s.toggleThumb, lpIsAdvance && s.toggleThumbOn]} />
            </View>
          </Pressable>

          {lpIsAdvance && (
            <>
              <Field label="Total agreed amount">
                <Input value={lpTotalAgreed} onChangeText={setLpTotalAgreed} keyboardType="decimal-pad" placeholder="0" />
              </Field>
              <Field label="Due date (optional)">
                <DatePickerField value={lpDueDate} onChange={setLpDueDate} placeholder="Pick a date" />
              </Field>
            </>
          )}

          {saving
            ? <ActivityIndicator color={colors.gold} />
            : <Button
                title="Log payment"
                onPress={handleLogPayment}
                disabled={!lpClientId || (!lpAmount && !lpIsAdvance)}
                style={{ marginTop: 8 }}
              />
          }
        </Sheet>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: '600', color: colors.text },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerBtnText: { fontSize: typeScale.sm, color: colors.gold },
  addClientBtn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addClientBtnText: { fontSize: typeScale.sm, color: colors.bg, fontWeight: '600' },

  // Expected box
  expectedBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 20,
  },
  expectedTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  expectedLabel: { fontSize: typeScale.xs, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  expectedAmount: { fontSize: 24, fontWeight: '700', color: colors.gold, marginBottom: 2 },
  expectedSub: { fontSize: typeScale.sm, color: colors.dim },
  receivedBadge: { alignItems: 'flex-end' },
  receivedLabel: { fontSize: typeScale.xs, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  receivedAmt: { fontSize: typeScale.xl, fontWeight: '700', color: colors.green },

  // Graph
  graphContainer: { marginTop: 4 },
  graphBar: {
    height: 10,
    flexDirection: 'row',
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  graphSegmentGreen: { backgroundColor: colors.green },
  graphSegmentGold: { backgroundColor: colors.gold },
  graphLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: typeScale.xs, color: colors.dim },

  sectionLabel: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  topGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  topTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    alignItems: 'center',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontSize: typeScale.base, fontWeight: '700', color: colors.bg },
  tileName: { fontSize: typeScale.sm, color: colors.dim, marginBottom: 2, textAlign: 'center' },
  tileTotal: { fontSize: typeScale.md, fontWeight: '600', color: colors.text },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
  },
  clientLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarSmText: { fontSize: typeScale.xs, fontWeight: '700', color: colors.bg },
  clientName: { fontSize: typeScale.lg, color: colors.text },
  clientTotal: { fontSize: typeScale.md, color: colors.dim },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingVertical: 12 },

  // Add client footer in list
  addClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.md,
  },
  addClientRowText: { fontSize: typeScale.md, color: colors.gold },

  // Inline add client in log-payment sheet
  inlineAddClient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
    marginTop: -4,
  },
  inlineAddClientText: { fontSize: typeScale.sm, color: colors.gold },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  toggleLabel: { fontSize: typeScale.lg, color: colors.text },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: colors.gold },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.dim },
  toggleThumbOn: { backgroundColor: colors.bg, alignSelf: 'flex-end' },
});
