import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import type { Client, ScheduledPayment, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Sheet, Button, Field, Input, useToast } from '../../theme/components';
import { colors, money, radii, typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientDetail'>;
type Route = RouteProp<RootStackParamList, 'ClientDetail'>;

export function ClientDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { clientId } = route.params;
  const { ready, settings, dataVersion, bumpData } = useApp();
  const toast = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPayment[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = settings?.currency ?? 'TND';

  const load = useCallback(async () => {
    const [c, txs, sps] = await Promise.all([
      repos.clients.get(clientId),
      repos.transactions.list(),
      repos.scheduledPayments.list(),
    ]);
    setClient(c);
    setTransactions(txs.filter(t => t.clientId === clientId && !t.isArchived));
    setScheduled(sps.filter(s => s.clientId === clientId && s.status !== 'completed'));
    if (c) { setName(c.name); setEmail(c.email ?? ''); setPhone(c.phone ?? ''); }
  }, [clientId]);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const totalPaid = transactions.reduce((s, t) => s + t.amount, 0);
  const amountOwed = scheduled.reduce((s, sp) => s + sp.remainingAmount, 0);

  const handleSave = useCallback(async () => {
    if (!client || !name.trim()) return;
    setSaving(true);
    try {
      await repos.clients.update(clientId, { name: name.trim(), email: email || null, phone: phone || null });
      bumpData();
      setEditing(false);
      toast.show('Client updated');
    } finally { setSaving(false); }
  }, [client, name, email, phone, clientId, bumpData, toast]);

  const handleArchive = useCallback(async () => {
    await repos.clients.archive(clientId);
    bumpData();
    navigation.goBack();
  }, [clientId, bumpData, navigation]);

  if (!client) return <View style={s.root}><ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{client.name}</Text>
        <Pressable onPress={handleArchive} hitSlop={8}>
          <Trash2 size={18} color={colors.faint} />
        </Pressable>
      </View>

      <View style={s.statRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>Total paid</Text>
          <Text style={[s.statValue, { color: colors.green }]}>{money(totalPaid)} {currency}</Text>
        </View>
        {amountOwed > 0 && (
          <View style={s.stat}>
            <Text style={s.statLabel}>Owed</Text>
            <Text style={s.statValue}>{money(amountOwed)} {currency}</Text>
          </View>
        )}
      </View>

      <Pressable style={s.editBtn} onPress={() => setEditing(true)}>
        <Text style={s.editBtnText}>Edit client</Text>
      </Pressable>

      <Text style={s.sectionLabel}>Payment history</Text>
      {transactions.length === 0
        ? <Text style={s.empty}>No payments yet.</Text>
        : transactions.map(t => (
          <View key={t.id} style={s.txRow}>
            <Text style={s.txDate}>{t.date}</Text>
            <Text style={s.txAmt}>{money(t.amount)} {currency}</Text>
          </View>
        ))
      }

      {editing && (
        <Sheet title="Edit client" onClose={() => setEditing(false)}>
          <Field label="Name"><Input value={name} onChangeText={setName} autoFocus /></Field>
          <Field label="Email"><Input value={email} onChangeText={setEmail} keyboardType="email-address" /></Field>
          <Field label="Phone"><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button label="Save" onPress={handleSave} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, marginBottom: 20 },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text, flex: 1, marginHorizontal: 12 },
  statRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  stat: { flex: 1 },
  statLabel: { fontSize: typeScale.xs, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  statValue: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  editBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 10, alignItems: 'center', marginBottom: 20 },
  editBtnText: { fontSize: typeScale.md, color: colors.gold },
  sectionLabel: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  txDate: { fontSize: typeScale.sm, color: colors.faint },
  txAmt: { fontSize: typeScale.lg, fontWeight: '500', color: colors.green },
  empty: { fontSize: typeScale.md, color: colors.faint },
});
