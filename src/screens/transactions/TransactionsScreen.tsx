import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import type { Account, Category, Item, Transaction } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Select, TxRow } from '../../theme/components';
import { colors, typeScale } from '../../theme/tokens';
import type { RootStackParamList, TabParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Transactions'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type DateRange = 'all' | 'month' | 'week';

export function TransactionsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<TabParamList, 'Transactions'>>();
  const { ready, settings, dataVersion } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');

  // deep-links from category detail / account rows pre-apply a filter
  useEffect(() => {
    if (route.params?.categoryId) setFilterCategory(route.params.categoryId);
    if (route.params?.accountId) setFilterAccount(route.params.accountId);
  }, [route.params]);

  const load = useCallback(async () => {
    const [txs, accs, cats, its] = await Promise.all([
      repos.transactions.list(),
      repos.accounts.list(true),
      repos.categories.list(true),
      repos.items.list(true),
    ]);
    setTransactions(txs);
    setAccounts(accs);
    setCategories(cats);
    setItems(its);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, dataVersion, load]);

  const currency = settings?.currency ?? 'TND';

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateRange === 'week' ? now - 7 * 86400000 : dateRange === 'month' ? now - 30 * 86400000 : 0;
    return transactions
      .filter(t => filterAccount === 'all' || t.accountId === filterAccount)
      .filter(t => filterCategory === 'all' || t.categoryId === filterCategory)
      .filter(t => dateRange === 'all' || new Date(t.date).getTime() >= cutoff);
  }, [transactions, filterAccount, filterCategory, dateRange]);

  const label = useCallback(
    (tx: Transaction) => {
      const item = tx.itemId ? items.find(i => i.id === tx.itemId) : null;
      if (item) return item.name;
      const cat = tx.categoryId ? categories.find(c => c.id === tx.categoryId) : null;
      if (cat) return cat.name;
      return undefined;
    },
    [items, categories],
  );

  const accountOptions = useMemo(
    () => [
      { value: 'all', label: 'All accounts' },
      ...accounts.filter(a => !a.isArchived).map(a => ({ value: a.id, label: a.name })),
    ],
    [accounts],
  );
  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...categories
        .filter(c => !c.isArchived)
        .map(c => ({ value: c.id, label: `${c.emoji} ${c.name}`.trim() })),
    ],
    [categories],
  );
  const dateOptions = [
    { value: 'all', label: 'All time' },
    { value: 'month', label: 'Last 30 days' },
    { value: 'week', label: 'Last 7 days' },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.navigate('Home')} style={styles.back} hitSlop={8}>
          <ChevronLeft size={16} color={colors.dim} />
        </Pressable>
        <Text style={styles.title}>Transactions</Text>
      </View>

      <View style={styles.filters}>
        <Select
          compact
          title="Account"
          value={filterAccount}
          options={accountOptions}
          onChange={setFilterAccount}
        />
        <Select
          compact
          title="Category"
          value={filterCategory}
          options={categoryOptions}
          onChange={setFilterCategory}
        />
        <Select
          compact
          title="Date range"
          value={dateRange}
          options={dateOptions}
          onChange={v => setDateRange(v as DateRange)}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No transactions match these filters.</Text>}
        renderItem={({ item: t }) => (
          <TxRow
            tx={t}
            accounts={accounts}
            showAccount
            label={label(t)}
            currency={currency}
            onPress={() => navigation.navigate('TransactionDetail', { transactionId: t.id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  back: {
    padding: 2,
  },
  title: {
    fontSize: typeScale.xl,
    fontWeight: '500',
    color: colors.text,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: {
    paddingBottom: 80,
  },
  empty: {
    fontSize: typeScale.md,
    color: colors.faint,
    padding: 20,
  },
});
