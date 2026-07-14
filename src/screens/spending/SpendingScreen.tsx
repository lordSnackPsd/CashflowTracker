import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { colors, money, radii, typeScale } from '../../theme/tokens';

const monthKey = (d: string) => d.slice(0, 7);

export function SpendingScreen() {
  const { ready, settings, dataVersion } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    const [txs, cats] = await Promise.all([
      repos.transactions.list(),
      repos.categories.list(true),
    ]);
    setTransactions(txs);
    setCategories(cats);
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const currency = settings?.currency ?? 'TND';
  const thisMonth = monthKey(new Date().toISOString());

  const monthTx = useMemo(
    () => transactions.filter(t => monthKey(t.date) === thisMonth && t.type === 'expense'),
    [transactions, thisMonth],
  );

  const totalSpent = useMemo(
    () => monthTx.reduce((s, t) => s + t.amount, 0),
    [monthTx],
  );

  const catBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of monthTx) {
      const key = t.categoryId ?? '__none__';
      totals.set(key, (totals.get(key) ?? 0) + t.amount);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([catId, total]) => {
        const cat = categories.find(c => c.id === catId);
        return {
          id: catId,
          name: cat?.name ?? 'Uncategorized',
          emoji: cat?.emoji ?? '',
          total,
          pct: totalSpent > 0 ? (total / totalSpent) * 100 : 0,
        };
      });
  }, [monthTx, categories, totalSpent]);

  const top3 = catBreakdown.slice(0, 3);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.heading}>Spending</Text>
      <Text style={s.sub}>This month</Text>

      <View style={s.totalBox}>
        <Text style={s.totalLabel}>Total spent</Text>
        <Text style={s.totalAmount}>
          {money(totalSpent)} <Text style={s.cur}>{currency}</Text>
        </Text>
      </View>

      <Text style={s.sectionTitle}>Top categories</Text>
      {top3.length === 0 ? (
        <Text style={s.empty}>No spending logged this month yet.</Text>
      ) : (
        top3.map(c => (
          <View key={c.id} style={s.catRow}>
            <View style={s.catLeft}>
              <Text style={s.catEmoji}>{c.emoji || '📦'}</Text>
              <Text style={s.catName}>{c.name}</Text>
            </View>
            <View style={s.catRight}>
              <Text style={s.catAmount}>{money(c.total)} {currency}</Text>
              <Text style={s.catPct}>{c.pct.toFixed(0)}%</Text>
            </View>
          </View>
        ))
      )}

      {catBreakdown.length > 3 && (
        <>
          <Text style={s.sectionTitle}>All categories</Text>
          {catBreakdown.slice(3).map(c => (
            <View key={c.id} style={s.catRowSmall}>
              <Text style={s.catSmallName}>{c.emoji ? `${c.emoji} ` : ''}{c.name}</Text>
              <Text style={s.catSmallAmount}>{money(c.total)} {currency}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '600', color: colors.text, marginBottom: 2 },
  sub: { fontSize: typeScale.md, color: colors.faint, marginBottom: 20 },
  totalBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 24,
  },
  totalLabel: { fontSize: typeScale.sm, color: colors.faint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  totalAmount: { fontSize: 32, fontWeight: '700', color: colors.red },
  cur: { fontSize: typeScale.xl, fontWeight: '400', color: colors.dim },
  sectionTitle: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 8,
  },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catEmoji: { fontSize: 22 },
  catName: { fontSize: typeScale.lg, color: colors.text, fontWeight: '500' },
  catRight: { alignItems: 'flex-end' },
  catAmount: { fontSize: typeScale.lg, color: colors.text, fontWeight: '600' },
  catPct: { fontSize: typeScale.sm, color: colors.faint },
  catRowSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catSmallName: { fontSize: typeScale.md, color: colors.dim },
  catSmallAmount: { fontSize: typeScale.md, color: colors.text },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingVertical: 12 },
});
