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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import type { Client, ScheduledPayment } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Sheet, Button, Field, Input, Select, useToast } from '../../theme/components';
import { colors, money, radii, spacing, typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ExpectedPayments'>;

export function ExpectedPaymentsScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, settings, dataVersion, bumpData } = useApp();
  const toast = useToast();

  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<import('../../types').Account[]>([]);

  // Log payment sheet
  const [selected, setSelected] = useState<ScheduledPayment | null>(null);
  const [logAmount, setLogAmount] = useState('');
  const [logAccountId, setLogAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    const [sps, cls, accs] = await Promise.all([
      repos.scheduledPayments.list(),
      repos.clients.list(),
      repos.accounts.list(),
    ]);
    setPayments(sps.filter(sp => sp.status !== 'completed'));
    setClients(cls);
    setAccounts(accs);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));

  const handleLog = useCallback(async () => {
    if (!selected || !logAccountId) return;
    const amount = parseFloat(logAmount) || 0;
    setSaving(true);
    try {
      if (amount > 0) {
        await repos.scheduledPayments.logPayment(selected.id, amount, logAccountId);
      } else {
        // Amount = 0: just update status without creating a transaction
        const newReceived = selected.receivedSoFar;
        await repos.scheduledPayments.update(selected.id, {
          receivedSoFar: newReceived,
          status: newReceived >= selected.totalAmount ? 'completed' : selected.status,
        });
      }
      toast.show(amount > 0 ? `Logged ${money(amount)} ${currency}` : 'Payment updated');
      bumpData();
      setSelected(null);
      setLogAmount('');
      setLogAccountId('');
    } finally {
      setSaving(false);
    }
  }, [selected, logAmount, logAccountId, currency, bumpData, toast]);

  const totalExpected = payments.reduce((s, sp) => s + sp.remainingAmount, 0);
  const totalReceived = payments.reduce((s, sp) => s + sp.receivedSoFar, 0);

  const statusColor = (status: string) => {
    if (status === 'overdue') return colors.red;
    if (status === 'partially_paid') return colors.gold;
    return colors.dim;
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title}>Expected payments</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Summary bar */}
      <View style={s.summaryRow}>
        <View style={s.summaryItem}>
          <Text style={s.summaryLabel}>Received</Text>
          <Text style={[s.summaryValue, { color: colors.green }]}>{money(totalReceived)} {currency}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryLabel}>Outstanding</Text>
          <Text style={[s.summaryValue, { color: colors.gold }]}>{money(totalExpected)} {currency}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {payments.length === 0 ? (
          <Text style={s.empty}>No outstanding payments.</Text>
        ) : (
          payments.map(sp => {
            const client = clientMap[sp.clientId];
            const progress = sp.totalAmount > 0 ? sp.receivedSoFar / sp.totalAmount : 0;
            return (
              <Pressable
                key={sp.id}
                style={s.card}
                onPress={() => {
                  setSelected(sp);
                  setLogAmount('');
                  setLogAccountId('');
                }}
              >
                <View style={s.cardHeader}>
                  <View style={s.avatarSm}>
                    <Text style={s.avatarSmText}>
                      {(client?.name ?? '?').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.cardLeft}>
                    <Text style={s.clientName}>{client?.name ?? 'Unknown'}</Text>
                    {sp.dueDate && (
                      <Text style={[s.dueDate, { color: statusColor(sp.status) }]}>
                        Due {sp.dueDate} · {sp.status.replace('_', ' ')}
                      </Text>
                    )}
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.remaining}>{money(sp.remainingAmount)}</Text>
                    <Text style={s.remainingLabel}>{currency} left</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${Math.min(100, progress * 100)}%` }]} />
                </View>
                <View style={s.cardFooter}>
                  <Text style={s.footerText}>
                    Received {money(sp.receivedSoFar)} of {money(sp.totalAmount)} {currency}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {selected && (
        <Sheet
          title={`Log payment · ${clientMap[selected.clientId]?.name ?? ''}`}
          onClose={() => setSelected(null)}
        >
          <Text style={s.sheetInfo}>
            Outstanding: {money(selected.remainingAmount)} {currency}
          </Text>
          <Field label="Amount received (0 to keep as forecast)">
            <Input
              value={logAmount}
              onChangeText={setLogAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              autoFocus
            />
          </Field>
          <Field label="Into account">
            <Select
              title="Account"
              value={logAccountId}
              options={[{ value: '', label: 'Select account' }, ...accountOptions]}
              onChange={setLogAccountId}
            />
          </Field>
          {saving
            ? <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />
            : <Button
                title="Confirm"
                onPress={handleLog}
                disabled={!logAccountId}
                style={{ marginTop: 8 }}
              />
          }
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
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryLabel: { fontSize: typeScale.xs, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  summaryValue: { fontSize: typeScale.xl, fontWeight: '700' },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 10 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarSmText: { fontSize: typeScale.xs, fontWeight: '700', color: colors.bg },
  cardLeft: { flex: 1 },
  clientName: { fontSize: typeScale.lg, color: colors.text, fontWeight: '500' },
  dueDate: { fontSize: typeScale.sm, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  remaining: { fontSize: typeScale.xl, fontWeight: '700', color: colors.gold },
  remainingLabel: { fontSize: typeScale.xs, color: colors.faint },
  barBg: { height: 5, backgroundColor: colors.border, borderRadius: radii.full, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', backgroundColor: colors.green, borderRadius: radii.full },
  cardFooter: {},
  footerText: { fontSize: typeScale.sm, color: colors.faint },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingTop: 24, textAlign: 'center' },
  sheetInfo: { fontSize: typeScale.md, color: colors.gold, marginBottom: spacing.md, fontWeight: '600' },
});
