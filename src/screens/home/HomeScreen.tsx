import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Check, ChevronDown, ChevronRight, ChevronUp, Menu } from 'lucide-react-native';
import type {
  Account,
  BalanceCorrection,
  Category,
  Debt,
  Item,
  LoanPayment,
  ScheduledPayment,
  Transaction,
} from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { colors, colorsExtra, money, radii, typeScale } from '../../theme/tokens';
import { AccountIcon, AmountText, TxRow } from '../../theme/components';
import type { DrawerParamList, RootStackParamList, TabParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  CompositeNavigationProp<
    DrawerNavigationProp<DrawerParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;

/** A Home grid tile — either an account or an active revolving-credit debt,
 *  merged into one pool ordered by the shared sortOrder. */
interface Tile {
  id: string;
  kind: 'account' | 'revolving';
  name: string;
  icon: string;
  balance: number;
  sortOrder: number;
}

const monthKey = (d: string) => d.slice(0, 7);

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, settings, dataVersion, bumpData } = useApp();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [corrections, setCorrections] = useState<BalanceCorrection[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPayment[]>([]);
  const [loanPaymentsByDebt, setLoanPaymentsByDebt] = useState<Record<string, LoanPayment[]>>({});

  const [expanded, setExpanded] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderTiles, setReorderTiles] = useState<Tile[]>([]);

  const load = useCallback(async () => {
    const [accs, dbts, txs, its, cats, sps] = await Promise.all([
      repos.accounts.list(),
      repos.debts.list(),
      repos.transactions.list(),
      repos.items.list(true),
      repos.categories.list(true),
      repos.scheduledPayments.list(),
    ]);
    setAccounts(accs);
    setDebts(dbts);
    setTransactions(txs);
    setItems(its);
    setCategories(cats);
    setScheduled(sps);

    const corrLists = await Promise.all(accs.map(a => repos.balanceCorrections.listForAccount(a.id)));
    setCorrections(corrLists.flat());

    const active = dbts.filter(d => d.status === 'active');
    const lpLists = await Promise.all(active.map(d => repos.loanPayments.listForDebt(d.id)));
    const byDebt: Record<string, LoanPayment[]> = {};
    active.forEach((d, i) => { byDebt[d.id] = lpLists[i]; });
    setLoanPaymentsByDebt(byDebt);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, dataVersion, load]);

  const currency = settings?.currency ?? 'TND';

  const tiles = useMemo<Tile[]>(() => {
    const accountTiles: Tile[] = accounts.map(a => ({
      id: a.id,
      kind: 'account',
      name: a.name,
      icon: a.icon,
      balance: a.runningBalance,
      sortOrder: a.sortOrder,
    }));
    const revolvingTiles: Tile[] = debts
      .filter(d => d.debtType === 'revolving_credit' && d.status === 'active')
      .map(d => ({
        id: d.id,
        kind: 'revolving',
        name: d.name,
        icon: 'card',
        balance: d.availableBalance ?? 0,
        sortOrder: d.sortOrder ?? 999,
      }));
    return [...accountTiles, ...revolvingTiles].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [accounts, debts]);

  // Total money: accounts only — a card's available balance is not the user's money.
  const totalMoney = useMemo(
    () => accounts.reduce((s, a) => s + a.runningBalance, 0),
    [accounts],
  );

  // Unlogged spending: each account's latest correction diff this month, summed.
  const thisMonth = monthKey(new Date().toISOString());
  const unlogged = useMemo(() => {
    const latestByAccount = new Map<string, BalanceCorrection>();
    for (const c of corrections) {
      if (monthKey(c.date) !== thisMonth) continue;
      const prev = latestByAccount.get(c.accountId);
      if (!prev || c.date > prev.date) latestByAccount.set(c.accountId, c);
    }
    let sum = 0;
    for (const c of latestByAccount.values()) sum += Math.max(0, c.diff);
    return sum;
  }, [corrections, thisMonth]);

  const monthTx = useMemo(
    () => transactions.filter(t => monthKey(t.date) === thisMonth),
    [transactions, thisMonth],
  );
  const spentThisMonth = useMemo(
    () => monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthTx],
  );

  // Alert threshold (settings 6.10) — one mode at a time, off by default.
  const alertActive = useMemo(() => {
    if (!settings?.unloggedSpendingAlertMode || settings.unloggedSpendingAlertValue == null) {
      return false;
    }
    const v = settings.unloggedSpendingAlertValue;
    switch (settings.unloggedSpendingAlertMode) {
      case 'percentage':
        return spentThisMonth > 0 && unlogged > (v / 100) * spentThisMonth;
      case 'monthly_allowance':
        return unlogged > v;
      case 'daily_allowance':
        return unlogged > v * new Date().getDate();
      default:
        return false;
    }
  }, [settings, unlogged, spentThisMonth]);

  const recent = transactions.slice(0, 5);

  const itemName = useCallback(
    (tx: Transaction) => {
      const item = tx.itemId ? items.find(i => i.id === tx.itemId) : null;
      if (item) return item.name;
      const cat = tx.categoryId ? categories.find(c => c.id === tx.categoryId) : null;
      if (cat) return cat.name;
      return undefined;
    },
    [items, categories],
  );

  const startReorder = useCallback(() => {
    setReorderTiles(tiles);
    setReorderMode(true);
  }, [tiles]);

  const finishReorder = useCallback(async () => {
    setReorderMode(false);
    await repos.accounts.reorder(reorderTiles.map(t => t.id));
    bumpData();
  }, [reorderTiles, bumpData]);

  // ==== monthly review aggregates ====
  const review = useMemo(() => {
    const prevDate = new Date();
    prevDate.setDate(1);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = monthKey(prevDate.toISOString());

    const incomeThisMonth = monthTx
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);

    const catTotals = new Map<string, number>();
    for (const t of monthTx) {
      if (t.type !== 'expense') continue;
      const key = t.categoryId ?? 'uncategorized';
      catTotals.set(key, (catTotals.get(key) ?? 0) + t.amount);
    }
    const prevTx = transactions.filter(t => monthKey(t.date) === prevMonth);
    const prevCatTotals = new Map<string, number>();
    for (const t of prevTx) {
      if (t.type !== 'expense') continue;
      const key = t.categoryId ?? 'uncategorized';
      prevCatTotals.set(key, (prevCatTotals.get(key) ?? 0) + t.amount);
    }

    const breakdown = [...catTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([catId, total]) => {
        const cat = categories.find(c => c.id === catId);
        return {
          id: catId,
          name: cat?.name ?? 'Uncategorized',
          emoji: cat?.emoji ?? '',
          total,
          delta: total - (prevCatTotals.get(catId) ?? 0),
        };
      });

    const accuracy =
      spentThisMonth + unlogged > 0
        ? Math.round((spentThisMonth / (spentThisMonth + unlogged)) * 100)
        : 100;

    const expectedIncome = scheduled
      .filter(s => s.status !== 'completed')
      .reduce((s, sp) => s + sp.remainingAmount, 0);

    // Reduction projections — only lessSpendGoal items feed these (spec 6.9).
    const projections = items
      .filter(i => i.lessSpendGoal && !i.isArchived)
      .map(i => {
        const monthSpend = monthTx
          .filter(t => t.type === 'expense' && t.itemId === i.id)
          .reduce((s, t) => s + t.amount, 0);
        return { name: i.name, yearlySaving: monthSpend * 0.25 * 12 };
      })
      .filter(p => p.yearlySaving > 0);

    // Debt trending (active debts only).
    const debtTrends = debts
      .filter(d => d.status === 'active')
      .map(d => {
        if (d.debtType === 'revolving_credit') {
          return `${d.name}: ${money(d.availableBalance ?? 0)} ${currency} available of ${money(d.creditLimit ?? 0)} limit`;
        }
        const paid = (loanPaymentsByDebt[d.id] ?? []).reduce((s, p) => s + p.principalAmount, 0);
        const target = d.debtType === 'term_loan' ? d.principalDisbursed ?? 0 : d.totalOwed ?? 0;
        return `${d.name}: ${money(target - paid)} ${currency} remaining`;
      });

    const net = incomeThisMonth - spentThisMonth;
    const narrative =
      monthTx.length === 0
        ? 'Nothing logged yet this month.'
        : net >= 0
          ? `You're ahead this month — income covered spending with ${money(net)} ${currency} to spare${unlogged > 0 ? `, though ${money(unlogged)} ${currency} slipped through untracked` : ''}.`
          : `Spending ran ${money(-net)} ${currency} past income this month${unlogged > 0 ? `, with another ${money(unlogged)} ${currency} untracked` : ''} — worth a look at the biggest category below.`;

    return { incomeThisMonth, breakdown, accuracy, expectedIncome, projections, debtTrends, narrative };
  }, [monthTx, transactions, categories, items, debts, scheduled, spentThisMonth, unlogged, currency, loanPaymentsByDebt]);

  const openTile = useCallback(
    (tile: Tile) => {
      if (tile.kind === 'revolving') {
        navigation.navigate('DebtDetail', { debtId: tile.id });
      } else {
        navigation.navigate('AccountDetail', { accountId: tile.id });
      }
    },
    [navigation],
  );

  // ==== reorder mode: a dedicated draggable list replaces the screen ====
  if (reorderMode) {
    return (
      <View style={styles.root}>
        <View style={styles.reorderHeader}>
          <Text style={styles.sectionTitle}>Drag to reorder</Text>
          <Pressable onPress={finishReorder} style={styles.doneBtn} hitSlop={8}>
            <Check size={14} color={colors.gold} />
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <DraggableFlatList
          data={reorderTiles}
          keyExtractor={t => t.id}
          onDragEnd={({ data }) => setReorderTiles(data)}
          contentContainerStyle={styles.reorderList}
          renderItem={({ item, drag, isActive }) => (
            <ScaleDecorator>
              <Pressable
                onLongPress={drag}
                disabled={isActive}
                style={[styles.reorderRow, isActive && styles.reorderRowActive]}
              >
                <AccountIcon name={item.icon} color={colors.dim} />
                <Text style={styles.reorderName}>{item.name}</Text>
                <Text
                  style={[
                    styles.tileBalance,
                    item.kind === 'account' && item.balance < 0 && styles.negative,
                  ]}
                >
                  {money(item.balance)}
                </Text>
              </Pressable>
            </ScaleDecorator>
          )}
        />
      </View>
    );
  }

  const visibleTiles = expanded ? tiles : tiles.slice(0, 3);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={20} color={colors.dim} />
        </Pressable>
        <Text style={styles.headerTitle}>Where's my money</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* total money box */}
      <View style={styles.totalBox}>
        <Text style={styles.boxLabel}>Total</Text>
        <AmountText value={totalMoney} currency={currency} style={styles.totalAmount} />
      </View>

      {/* unlogged spending box */}
      <UnloggedBox value={unlogged} currency={currency} alert={alertActive} />

      {/* accounts grid */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Accounts</Text>
      </View>
      <View style={styles.grid}>
        {visibleTiles.map(tile => (
          <Pressable
            key={tile.id}
            style={styles.tile}
            onPress={() => openTile(tile)}
            onLongPress={startReorder}
            delayLongPress={550}
          >
            <AccountIcon name={tile.icon} color={colors.dim} />
            <Text style={styles.tileName} numberOfLines={1}>
              {tile.name}
            </Text>
            <Text
              style={[
                styles.tileBalance,
                // revolving credit can never go negative — never renders red
                tile.kind === 'account' && tile.balance < 0 && styles.negative,
              ]}
            >
              {money(tile.balance)}
            </Text>
          </Pressable>
        ))}
        {tiles.length === 0 && (
          <Text style={styles.emptyText}>
            No accounts yet — add one from the menu → Cash management.
          </Text>
        )}
      </View>
      {tiles.length > 3 && (
        <Pressable style={styles.expandBtn} onPress={() => setExpanded(v => !v)}>
          {expanded ? (
            <>
              <Text style={styles.expandText}>Show less</Text>
              <ChevronUp size={14} color={colors.dim} />
            </>
          ) : (
            <>
              <Text style={styles.expandText}>Show all {tiles.length} accounts</Text>
              <ChevronDown size={14} color={colors.dim} />
            </>
          )}
        </Pressable>
      )}
      {tiles.length > 1 && (
        <Text style={styles.hint}>Long-press a tile to reorder.</Text>
      )}

      {/* recent transactions */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Recent</Text>
        <Pressable
          onPress={() => navigation.navigate('Transactions')}
          style={styles.seeAll}
          hitSlop={8}
        >
          <Text style={styles.seeAllText}>See all</Text>
          <ChevronRight size={13} color={colors.gold} />
        </Pressable>
      </View>
      <View style={styles.card}>
        {recent.length === 0 ? (
          <Text style={styles.emptyCardText}>No transactions yet.</Text>
        ) : (
          recent.map(t => (
            <TxRow
              key={t.id}
              tx={t}
              accounts={accounts}
              showAccount
              label={itemName(t)}
              currency={currency}
              onPress={() => navigation.navigate('TransactionDetail', { transactionId: t.id })}
            />
          ))
        )}
      </View>

      {/* monthly review — bottom of the Home scroll, not a separate destination */}
      <Text style={[styles.sectionTitle, styles.reviewTitle]}>Monthly review</Text>
      <View style={styles.card}>
        <View style={styles.reviewInner}>
          <Text style={styles.narrative}>{review.narrative}</Text>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={[styles.statValue, styles.income]}>
                {money(review.incomeThisMonth)} {currency}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Spending</Text>
              <Text style={[styles.statValue, styles.expense]}>
                {money(spentThisMonth)} {currency}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Unbilled</Text>
              <Text style={styles.statValue}>
                {money(unlogged)} {currency}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Tracking accuracy</Text>
              <Text style={styles.statValue}>{review.accuracy}%</Text>
            </View>
          </View>

          {review.expectedIncome > 0 && (
            <View style={styles.reviewLine}>
              <Text style={styles.statLabel}>Expected income</Text>
              <Text style={styles.statValue}>
                {money(review.expectedIncome)} {currency}
              </Text>
            </View>
          )}

          {review.breakdown.length > 0 && (
            <>
              <Text style={styles.subheading}>By category</Text>
              {review.breakdown.map(b => (
                <View key={b.id} style={styles.reviewLine}>
                  <Text style={styles.catName} numberOfLines={1}>
                    {b.emoji ? `${b.emoji} ` : ''}
                    {b.name}
                  </Text>
                  <Text style={styles.statValue}>
                    {money(b.total)}
                    <Text style={b.delta > 0 ? styles.deltaUp : styles.deltaDown}>
                      {'  '}
                      {b.delta === 0 ? '' : b.delta > 0 ? `+${money(b.delta)}` : money(b.delta)}
                    </Text>
                  </Text>
                </View>
              ))}
            </>
          )}

          {review.debtTrends.length > 0 && (
            <>
              <Text style={styles.subheading}>Debts</Text>
              {review.debtTrends.map(line => (
                <Text key={line} style={styles.trendLine}>
                  {line}
                </Text>
              ))}
            </>
          )}

          {review.projections.length > 0 && (
            <>
              <Text style={styles.subheading}>If you cut back</Text>
              {review.projections.map(p => (
                <Text key={p.name} style={styles.trendLine}>
                  Reducing {p.name} by 25% saves ~{money(p.yearlySaving)} {currency}/year
                </Text>
              ))}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function UnloggedBox({ value, currency, alert }: { value: number; currency: string; alert: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (alert) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: false }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
  }, [alert, pulse]);

  const borderColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.red],
  });

  return (
    <Animated.View style={[styles.unloggedBox, { borderColor }]}>
      <Text style={styles.boxLabel}>Unlogged spending</Text>
      <Text style={[styles.unloggedAmount, alert && styles.negative]}>
        {money(value)} {currency}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: typeScale.xl,
    fontWeight: '500',
    color: colors.text,
  },
  headerSpacer: {
    flex: 1,
  },
  totalBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
  },
  boxLabel: {
    fontSize: typeScale.base,
    color: colors.dim,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '500',
  },
  unloggedBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 20,
  },
  unloggedAmount: {
    fontSize: typeScale.xl + 3,
    fontWeight: '500',
    color: colors.text,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: typeScale.md,
    color: colors.dim,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
  },
  tileName: {
    fontSize: typeScale.base,
    color: colors.dim,
    marginTop: 8,
    marginBottom: 2,
  },
  tileBalance: {
    fontSize: typeScale.xl,
    fontWeight: '500',
    color: colors.text,
  },
  negative: {
    color: colors.red,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    marginTop: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  expandText: {
    fontSize: typeScale.base,
    color: colors.dim,
  },
  hint: {
    fontSize: typeScale.xs,
    color: colors.faint,
    marginTop: 6,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: typeScale.base,
    color: colors.gold,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: typeScale.md,
    color: colors.faint,
    padding: 8,
  },
  emptyCardText: {
    fontSize: typeScale.md,
    color: colors.faint,
    padding: 16,
  },
  reviewTitle: {
    marginTop: 24,
    marginBottom: 10,
  },
  reviewInner: {
    padding: 16,
  },
  narrative: {
    fontSize: typeScale.lg,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: typeScale.sm,
    color: colors.faint,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typeScale.lg,
    fontWeight: '500',
    color: colors.text,
  },
  income: {
    color: colors.green,
  },
  expense: {
    color: colors.red,
  },
  subheading: {
    fontSize: typeScale.sm,
    color: colors.faint,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  catName: {
    flex: 1,
    fontSize: typeScale.lg,
    color: colors.text,
    marginRight: 8,
  },
  deltaUp: {
    fontSize: typeScale.sm,
    color: colors.red,
  },
  deltaDown: {
    fontSize: typeScale.sm,
    color: colors.green,
  },
  trendLine: {
    fontSize: typeScale.md,
    color: colors.dim,
    paddingVertical: 3,
  },
  reorderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneText: {
    fontSize: typeScale.base,
    fontWeight: '500',
    color: colors.gold,
  },
  reorderList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 8,
  },
  reorderRowActive: {
    borderColor: colors.gold,
    backgroundColor: colorsExtra.goldTint,
  },
  reorderName: {
    flex: 1,
    fontSize: typeScale.lg,
    color: colors.text,
  },
});
