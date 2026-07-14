import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CreditCard, Wallet } from 'lucide-react-native';
import type { Account, Category, Debt, Item, MerchantRule } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { useQuickAdd } from '../../context/QuickAddContext';
import { normalizePattern, matchByAmount, STRONG_MATCH_THRESHOLD } from '../../logic/merchantLearning';
import { Sheet, Button, EmojiPicker, useToast } from '../../theme/components';
import { colors, colorsExtra, money, radii, spacing, typeScale } from '../../theme/tokens';
import { todayIso } from '../../db/client';

type Step = 'main' | 'newItem' | 'newCategory';

interface PaymentChip {
  id: string;
  kind: 'account' | 'revolving';
  label: string;
  balance: number;
}

export function QuickAddHost() {
  const { isOpen, close, presetAccountId } = useQuickAdd();
  const { ready, settings, bumpData } = useApp();
  const toast = useToast();

  // data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pastTx, setPastTx] = useState<import('../../types').Transaction[]>([]);

  // form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedPayId, setSelectedPayId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  // step
  const [step, setStep] = useState<Step>('main');
  const [saving, setSaving] = useState(false);

  // new item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemEmoji, setNewItemEmoji] = useState('');
  const [newItemLessSpend, setNewItemLessSpend] = useState(false);
  const [newItemCategoryId, setNewItemCategoryId] = useState<string | null>(null);

  // new category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');

  const amountRef = useRef<TextInput>(null);
  const currency = settings?.currency ?? 'TND';

  const loadData = useCallback(async () => {
    const [accs, dbts, its, cats, txs] = await Promise.all([
      repos.accounts.list(),
      repos.debts.list(),
      repos.items.list(),
      repos.categories.list(),
      repos.transactions.list(),
    ]);
    setAccounts(accs);
    setDebts(dbts);
    setItems(its);
    setCategories(cats);
    setPastTx(txs.filter(t => t.type === 'expense'));
  }, []);

  useEffect(() => {
    if (isOpen && ready) {
      loadData();
      // reset form
      setAmount('');
      setDescription('');
      setSelectedItemId(null);
      setSelectedCategoryId(null);
      setNote('');
      setStep('main');
      setTimeout(() => amountRef.current?.focus(), 200);
    }
  }, [isOpen, ready, loadData]);

  // preset account from context
  useEffect(() => {
    if (isOpen && presetAccountId) setSelectedPayId(presetAccountId);
    else if (isOpen) setSelectedPayId(null);
  }, [isOpen, presetAccountId]);

  // ---- merchant learning ----
  const amountNum = parseFloat(amount.replace(',', '.')) || 0;
  const normalizedDesc = normalizePattern(description);

  const textMatches = useMemo<{ item: Item; rule: MerchantRule | null; strong: boolean }[]>(() => {
    if (!normalizedDesc) return [];
    const matching = items.filter(i =>
      !i.isArchived && i.name.toLowerCase().includes(normalizedDesc),
    );
    // also do a merchant rule look-up (sync, from loaded data)
    return matching.map(item => ({ item, rule: null, strong: false }));
  }, [normalizedDesc, items]);

  const amountSuggestion = useMemo(() => {
    if (normalizedDesc || amountNum <= 0) return null;
    return matchByAmount(amountNum, pastTx);
  }, [normalizedDesc, amountNum, pastTx]);

  const suggestedItem = useMemo(() => {
    if (amountSuggestion && !normalizedDesc) {
      return items.find(i => i.id === amountSuggestion.itemId) ?? null;
    }
    return null;
  }, [amountSuggestion, items, normalizedDesc]);

  // ---- payment chips ----
  const chips = useMemo<PaymentChip[]>(() => {
    const accountChips: PaymentChip[] = accounts.map(a => ({
      id: a.id,
      kind: 'account',
      label: a.name,
      balance: a.runningBalance,
    }));
    const revChips: PaymentChip[] = debts
      .filter(d => d.debtType === 'revolving_credit' && d.status === 'active')
      .map(d => ({
        id: d.id,
        kind: 'revolving',
        label: d.name,
        balance: d.availableBalance ?? 0,
      }));
    return [...accountChips, ...revChips];
  }, [accounts, debts]);

  const selectedChip = chips.find(c => c.id === selectedPayId) ?? null;

  const isHardBlocked =
    selectedChip?.kind === 'revolving' && amountNum > selectedChip.balance;
  const isSoftWarning =
    selectedChip?.kind === 'account' && amountNum > selectedChip.balance;

  // ---- pick item ----
  const pickItem = useCallback((item: Item) => {
    setSelectedItemId(item.id);
    setSelectedCategoryId(item.categoryId);
    setDescription(item.name);
    Keyboard.dismiss();
  }, []);

  // ---- submit ----
  const handleSubmit = useCallback(async () => {
    if (!amountNum || amountNum <= 0) return;
    if (!selectedPayId) return;
    if (isHardBlocked) return;

    setSaving(true);
    try {
      const payChip = chips.find(c => c.id === selectedPayId)!;

      await repos.transactions.create({
        accountId: selectedPayId,
        type: 'expense',
        amount: amountNum,
        date: todayIso(),
        categoryId: selectedCategoryId,
        itemId: selectedItemId,
        paymentMethodNote: null,
        counterparty: null,
        clientId: null,
        transferKind: null,
        feeAmount: null,
        linkedTransactionId: null,
        source: 'quick_add',
        note: note || null,
      });

      // update revolving available balance
      if (payChip.kind === 'revolving') {
        const debt = debts.find(d => d.id === selectedPayId);
        if (debt) {
          await repos.debts.update(selectedPayId, {
            availableBalance: Math.max(0, (debt.availableBalance ?? 0) - amountNum),
          });
        }
      }

      // merchant learning
      if (normalizedDesc && selectedCategoryId) {
        await repos.merchantRules.upsertOnConfirm(normalizedDesc, selectedCategoryId);
      }

      bumpData();
      const label = selectedItemId
        ? items.find(i => i.id === selectedItemId)?.name ?? money(amountNum)
        : money(amountNum);
      toast.show(`Logged ${money(amountNum)} ${currency} · ${label}`);
      close();
    } finally {
      setSaving(false);
    }
  }, [
    amountNum, selectedPayId, isHardBlocked, chips, selectedCategoryId,
    selectedItemId, note, normalizedDesc, debts, bumpData, items, currency, toast, close,
  ]);

  // ---- create new item ----
  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim() || !newItemCategoryId) return;
    setSaving(true);
    try {
      const item = await repos.items.create({
        name: newItemName.trim(),
        categoryId: newItemCategoryId,
        lessSpendGoal: newItemLessSpend,
        emoji: newItemEmoji,
      });
      await loadData();
      setSelectedItemId(item.id);
      setSelectedCategoryId(item.categoryId);
      setDescription(item.name);
      setStep('main');
    } finally {
      setSaving(false);
    }
  }, [newItemName, newItemCategoryId, newItemLessSpend, newItemEmoji, loadData]);

  // ---- create new category ----
  const handleCreateCategory = useCallback(async () => {
    if (!newCatName.trim()) return;
    setSaving(true);
    try {
      const cat = await repos.categories.create({
        name: newCatName.trim(),
        emoji: newCatEmoji,
        monthlyBudget: null,
        lessSpendGoal: false,
      });
      await loadData();
      setNewItemCategoryId(cat.id);
      setStep('newItem');
    } finally {
      setSaving(false);
    }
  }, [newCatName, newCatEmoji, loadData]);

  if (!isOpen) return null;

  // ---- NEW CATEGORY step ----
  if (step === 'newCategory') {
    return (
      <Sheet title="New category" onClose={() => setStep('newItem')}>
        <View style={s.field}>
          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={newCatName}
            onChangeText={setNewCatName}
            placeholder="e.g. Groceries"
            placeholderTextColor={colors.faint}
            autoFocus
          />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Emoji (optional)</Text>
          <EmojiPicker value={newCatEmoji} onChange={setNewCatEmoji} />
        </View>
        <Button
          title="Create category"
          onPress={handleCreateCategory}
          disabled={!newCatName.trim() || saving}
          style={s.btn}
        />
      </Sheet>
    );
  }

  // ---- NEW ITEM step ----
  if (step === 'newItem') {
    const catOptions = categories.filter(c => !c.isArchived);
    return (
      <Sheet title={`Add "${newItemName || description}"`} onClose={() => setStep('main')}>
        <View style={s.field}>
          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={newItemName || description}
            onChangeText={setNewItemName}
            placeholder="Item name"
            placeholderTextColor={colors.faint}
            autoFocus
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
            {catOptions.map(c => (
              <Pressable
                key={c.id}
                onPress={() => setNewItemCategoryId(c.id)}
                style={[s.catChip, newItemCategoryId === c.id && s.catChipActive]}
              >
                <Text style={[s.catChipText, newItemCategoryId === c.id && s.catChipTextActive]}>
                  {c.emoji ? `${c.emoji} ` : ''}{c.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                setNewCatName('');
                setNewCatEmoji('');
                setStep('newCategory');
              }}
              style={s.catChip}
            >
              <Text style={s.catChipNew}>+ New category</Text>
            </Pressable>
          </ScrollView>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Emoji (optional)</Text>
          <EmojiPicker value={newItemEmoji} onChange={setNewItemEmoji} />
        </View>

        <Pressable
          style={s.toggleRow}
          onPress={() => setNewItemLessSpend(v => !v)}
        >
          <Text style={s.toggleLabel}>Want to spend less on this?</Text>
          <View style={[s.toggle, newItemLessSpend && s.toggleOn]}>
            <View style={[s.toggleThumb, newItemLessSpend && s.toggleThumbOn]} />
          </View>
        </Pressable>

        <Button
          title="Add item"
          onPress={handleCreateItem}
          disabled={!newItemCategoryId || saving}
          style={s.btn}
        />
      </Sheet>
    );
  }

  // ---- MAIN step ----
  const canSubmit = amountNum > 0 && !!selectedPayId && !isHardBlocked && !saving;

  return (
    <Sheet title="Quick add" onClose={close}>
      {/* Amount */}
      <View style={s.amountRow}>
        <TextInput
          ref={amountRef}
          style={s.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.faint}
          selectionColor={colors.gold}
        />
        <Text style={s.currencyLabel}>{currency}</Text>
      </View>

      {/* Description */}
      <View style={s.field}>
        <Text style={s.label}>Description</Text>
        <TextInput
          style={s.input}
          value={description}
          onChangeText={v => {
            setDescription(v);
            setSelectedItemId(null);
          }}
          placeholder="What was this for?"
          placeholderTextColor={colors.faint}
          returnKeyType="done"
        />
      </View>

      {/* Item suggestions */}
      {!!normalizedDesc && textMatches.length > 0 && !selectedItemId && (
        <View style={s.suggestions}>
          {textMatches.slice(0, 5).map(({ item }) => (
            <Pressable
              key={item.id}
              style={s.suggRow}
              onPress={() => pickItem(item)}
            >
              <Text style={s.suggText}>
                {item.emoji ? `${item.emoji} ` : ''}{item.name}
              </Text>
              <Text style={s.suggCat}>
                {categories.find(c => c.id === item.categoryId)?.name ?? ''}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[s.suggRow, s.suggAdd]}
            onPress={() => {
              setNewItemName(description);
              setNewItemEmoji('');
              setNewItemLessSpend(false);
              setNewItemCategoryId(null);
              setStep('newItem');
            }}
          >
            <Text style={s.suggAddText}>Add "{description}"</Text>
          </Pressable>
        </View>
      )}

      {/* amount-only suggestion */}
      {suggestedItem && !selectedItemId && (
        <Pressable style={s.amountSugg} onPress={() => pickItem(suggestedItem)}>
          <Text style={s.amountSuggText}>
            Usually means: {suggestedItem.emoji ? `${suggestedItem.emoji} ` : ''}
            <Text style={s.amountSuggName}>{suggestedItem.name}</Text>
          </Text>
        </Pressable>
      )}

      {/* selected item badge */}
      {selectedItemId && (
        <View style={s.selectedBadge}>
          <Text style={s.selectedBadgeText}>
            {(() => {
              const item = items.find(i => i.id === selectedItemId);
              const cat = categories.find(c => c.id === (item?.categoryId ?? selectedCategoryId));
              return `${item?.emoji ? item.emoji + ' ' : ''}${item?.name ?? ''}  ·  ${cat?.name ?? ''}`;
            })()}
          </Text>
          <Pressable onPress={() => { setSelectedItemId(null); setSelectedCategoryId(null); }}>
            <Text style={s.clearBadge}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Paid with */}
      <Text style={[s.label, { marginTop: spacing.md }]}>Paid with</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipRow}
        contentContainerStyle={s.chipRowContent}
      >
        {chips.map(chip => {
          const isSelected = chip.id === selectedPayId;
          const wouldBlock = chip.kind === 'revolving' && amountNum > chip.balance;
          const wouldWarn = chip.kind === 'account' && amountNum > chip.balance;
          return (
            <Pressable
              key={chip.id}
              onPress={() => setSelectedPayId(chip.id)}
              style={[
                s.payChip,
                isSelected && s.payChipSelected,
                wouldBlock && isSelected && s.payChipBlocked,
              ]}
            >
              {chip.kind === 'revolving'
                ? <CreditCard size={12} color={isSelected ? colors.gold : colors.dim} />
                : <Wallet size={12} color={isSelected ? colors.gold : colors.dim} />}
              <Text style={[s.payChipLabel, isSelected && s.payChipLabelSelected]}>
                {chip.label}
              </Text>
              <Text style={[
                s.payChipBalance,
                wouldBlock && s.payChipBalanceBlocked,
                wouldWarn && s.payChipBalanceWarn,
              ]}>
                {money(chip.balance)} {currency}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* warnings */}
      {isSoftWarning && (
        <Text style={s.softWarn}>
          Only {money(selectedChip!.balance)} {currency} available — will go negative
        </Text>
      )}
      {isHardBlocked && (
        <Text style={s.hardBlock}>
          Only {money(selectedChip!.balance)} {currency} available — cannot exceed card limit
        </Text>
      )}

      {/* Note */}
      <View style={[s.field, { marginTop: spacing.md }]}>
        <Text style={s.label}>Note (optional)</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder="Add a note…"
          placeholderTextColor={colors.faint}
        />
      </View>

      {/* Submit */}
      <View style={s.submitRow}>
        {saving
          ? <ActivityIndicator color={colors.gold} />
          : (
            <Button
              title={`Log ${amountNum > 0 ? `${money(amountNum)} ${currency}` : ''}`}
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={s.btn}
            />
          )}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: spacing.lg,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    padding: 0,
  },
  currencyLabel: {
    fontSize: typeScale.lg,
    color: colors.dim,
    marginBottom: 6,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typeScale.sm,
    color: colors.faint,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typeScale.lg,
    color: colors.text,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggText: {
    fontSize: typeScale.lg,
    color: colors.text,
  },
  suggCat: {
    fontSize: typeScale.sm,
    color: colors.faint,
  },
  suggAdd: {
    borderBottomWidth: 0,
  },
  suggAddText: {
    fontSize: typeScale.lg,
    color: colors.gold,
  },
  amountSugg: {
    backgroundColor: colorsExtra.goldFaintTint,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.sm,
    padding: 10,
    marginBottom: spacing.md,
  },
  amountSuggText: {
    fontSize: typeScale.md,
    color: colors.dim,
  },
  amountSuggName: {
    color: colors.gold,
    fontWeight: '500',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colorsExtra.goldTint,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  selectedBadgeText: {
    fontSize: typeScale.md,
    color: colors.gold,
  },
  clearBadge: {
    fontSize: typeScale.md,
    color: colors.gold,
  },
  chipRow: {
    marginBottom: spacing.sm,
  },
  chipRowContent: {
    gap: 8,
    paddingRight: 4,
  },
  payChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  payChipSelected: {
    borderColor: colors.gold,
    backgroundColor: colorsExtra.goldTint,
  },
  payChipBlocked: {
    borderColor: colors.red,
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  payChipLabel: {
    fontSize: typeScale.md,
    color: colors.dim,
    fontWeight: '500',
  },
  payChipLabelSelected: {
    color: colors.gold,
  },
  payChipBalance: {
    fontSize: typeScale.xs,
    color: colors.faint,
  },
  payChipBalanceBlocked: {
    color: colors.red,
    fontWeight: '500',
  },
  payChipBalanceWarn: {
    color: colors.red,
  },
  softWarn: {
    fontSize: typeScale.sm,
    color: colors.red,
    marginBottom: spacing.sm,
  },
  hardBlock: {
    fontSize: typeScale.sm,
    color: colors.red,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  submitRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  btn: {
    marginTop: spacing.sm,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  catChipActive: {
    borderColor: colors.gold,
    backgroundColor: colorsExtra.goldTint,
  },
  catChipText: {
    fontSize: typeScale.md,
    color: colors.dim,
  },
  catChipTextActive: {
    color: colors.gold,
    fontWeight: '500',
  },
  catChipNew: {
    fontSize: typeScale.md,
    color: colors.gold,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  toggleLabel: {
    fontSize: typeScale.lg,
    color: colors.text,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  toggleOn: {
    backgroundColor: colors.gold,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.dim,
  },
  toggleThumbOn: {
    backgroundColor: colors.bg,
    alignSelf: 'flex-end',
  },
});
