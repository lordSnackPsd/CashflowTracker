import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { colors, radii, typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Archive'>;

type EntityType = 'accounts' | 'categories' | 'items' | 'debts' | 'clients' | 'transactions';

interface ArchivedItem {
  id: string;
  label: string;
  type: EntityType;
}

export function ArchiveScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, dataVersion, bumpData } = useApp();
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [accs, cats, its, dbts, cls, txs] = await Promise.all([
      repos.accounts.list(true),
      repos.categories.list(true),
      repos.items.list(true),
      repos.debts.list(true),
      repos.clients.list(true),
      repos.transactions.list({ includeArchived: true }),
    ]);
    const all: ArchivedItem[] = [
      ...accs.filter(a => a.isArchived).map(a => ({ id: a.id, label: `Account: ${a.name}`, type: 'accounts' as EntityType })),
      ...cats.filter(c => c.isArchived).map(c => ({ id: c.id, label: `Category: ${c.name}`, type: 'categories' as EntityType })),
      ...its.filter(i => i.isArchived).map(i => ({ id: i.id, label: `Item: ${i.name}`, type: 'items' as EntityType })),
      ...dbts.filter(d => d.isArchived).map(d => ({ id: d.id, label: `Debt: ${d.name}`, type: 'debts' as EntityType })),
      ...cls.filter(c => c.isArchived).map(c => ({ id: c.id, label: `Client: ${c.name}`, type: 'clients' as EntityType })),
      ...txs.filter(t => t.isArchived).map(t => ({ id: t.id, label: `Transaction: ${t.amount} on ${t.date}`, type: 'transactions' as EntityType })),
    ];
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const handleRestore = useCallback(async (item: ArchivedItem) => {
    const repo = repos[item.type] as { restore: (id: string) => Promise<void> };
    await repo.restore(item.id);
    bumpData();
  }, [bumpData]);

  const handleDelete = useCallback(async (item: ArchivedItem) => {
    Alert.alert(
      'Permanently delete?',
      `This will permanently remove "${item.label}". This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            const repo = repos[item.type] as { permanentDelete: (id: string) => Promise<unknown> };
            await repo.permanentDelete(item.id);
            bumpData();
          },
        },
      ],
    );
  }, [bumpData]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title}>Archive</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <Text style={s.empty}>Nothing archived yet.</Text>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {items.map(item => (
            <View key={`${item.type}-${item.id}`} style={s.row}>
              <Text style={s.label} numberOfLines={2}>{item.label}</Text>
              <View style={s.actions}>
                <Pressable onPress={() => handleRestore(item)} style={s.restoreBtn}>
                  <Text style={s.restoreText}>Restore</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item)} style={s.deleteBtn}>
                  <Text style={s.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  label: { fontSize: typeScale.md, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  restoreBtn: { flex: 1, backgroundColor: colors.surface2, borderRadius: radii.sm, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  restoreText: { fontSize: typeScale.sm, color: colors.gold },
  deleteBtn: { flex: 1, backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: radii.sm, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.red },
  deleteText: { fontSize: typeScale.sm, color: colors.red },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingHorizontal: 20, paddingTop: 24 },
});
