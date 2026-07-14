import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import type { Category, Item } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Sheet, Button, Field, Input, EmojiPicker, useToast } from '../../theme/components';
import { colors, radii, typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CategoryDetail'>;
type Route = RouteProp<RootStackParamList, 'CategoryDetail'>;

export function CategoryDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { categoryId } = route.params;
  const { ready, dataVersion, bumpData } = useApp();
  const toast = useToast();

  const [category, setCategory] = useState<Category | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [editCat, setEditCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('');
  const [catBudget, setCatBudget] = useState('');
  const [catLess, setCatLess] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemEmoji, setItemEmoji] = useState('');
  const [itemLess, setItemLess] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [cat, its] = await Promise.all([
      repos.categories.get(categoryId),
      repos.items.list(),
    ]);
    setCategory(cat);
    const catItems = its.filter(i => i.categoryId === categoryId && !i.isArchived);
    setItems(catItems);
    if (cat) {
      setCatName(cat.name); setCatEmoji(cat.emoji);
      setCatBudget(cat.monthlyBudget != null ? String(cat.monthlyBudget) : '');
      setCatLess(cat.lessSpendGoal);
    }
  }, [categoryId]);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const handleSaveCat = useCallback(async () => {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      await repos.categories.update(categoryId, {
        name: catName.trim(),
        emoji: catEmoji,
        monthlyBudget: catBudget ? parseFloat(catBudget) : null,
        lessSpendGoal: catLess,
      });
      bumpData();
      setEditCat(false);
      toast.show('Category updated');
    } finally { setSaving(false); }
  }, [catName, catEmoji, catBudget, catLess, categoryId, bumpData, toast]);

  const handleArchiveCat = useCallback(async () => {
    await repos.categories.archive(categoryId);
    bumpData();
    navigation.goBack();
  }, [categoryId, bumpData, navigation]);

  const handleAddItem = useCallback(async () => {
    if (!itemName.trim()) return;
    setSaving(true);
    try {
      await repos.items.create({ name: itemName.trim(), categoryId, emoji: itemEmoji, lessSpendGoal: itemLess });
      bumpData();
      setShowAddItem(false);
      setItemName(''); setItemEmoji(''); setItemLess(false);
    } finally { setSaving(false); }
  }, [itemName, categoryId, itemEmoji, itemLess, bumpData]);

  const handleArchiveItem = useCallback(async (itemId: string) => {
    await repos.items.archive(itemId);
    bumpData();
  }, [bumpData]);

  if (!category) return <View style={s.root}><ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}><ChevronLeft size={20} color={colors.dim} /></Pressable>
        <Text style={s.title}>{category.emoji ? `${category.emoji} ` : ''}{category.name}</Text>
        <View style={s.headerBtns}>
          <Pressable onPress={() => setEditCat(true)} hitSlop={8}><Text style={s.editLink}>Edit</Text></Pressable>
          <Pressable onPress={handleArchiveCat} hitSlop={8}><Trash2 size={18} color={colors.faint} /></Pressable>
        </View>
      </View>

      <Pressable
        style={s.txLink}
        onPress={() => navigation.navigate('Main', { screen: 'Tabs', params: { screen: 'Transactions', params: { categoryId } } })}
      >
        <Text style={s.txLinkText}>View all transactions</Text>
        <ChevronRight size={14} color={colors.gold} />
      </Pressable>

      <Text style={s.sectionLabel}>Items</Text>
      {items.map(item => (
        <View key={item.id} style={s.itemRow}>
          <Text style={s.itemEmoji}>{item.emoji || '·'}</Text>
          <Text style={s.itemName}>{item.name}</Text>
          {item.lessSpendGoal && <Text style={s.lessBadge}>↓ less</Text>}
          <Pressable onPress={() => handleArchiveItem(item.id)} hitSlop={8}>
            <Trash2 size={14} color={colors.faint} />
          </Pressable>
        </View>
      ))}
      <Pressable style={s.addItemBtn} onPress={() => setShowAddItem(true)}>
        <Plus size={14} color={colors.gold} />
        <Text style={s.addItemText}>Add item</Text>
      </Pressable>

      {editCat && (
        <Sheet title="Edit category" onClose={() => setEditCat(false)}>
          <Field label="Name"><Input value={catName} onChangeText={setCatName} autoFocus /></Field>
          <Field label="Emoji"><EmojiPicker value={catEmoji} onChange={setCatEmoji} /></Field>
          <Field label="Monthly budget (optional)"><Input value={catBudget} onChangeText={setCatBudget} keyboardType="decimal-pad" placeholder="0" /></Field>
          <Pressable style={s.toggleRow} onPress={() => setCatLess(v => !v)}>
            <Text style={s.toggleLabel}>Want to spend less on this?</Text>
            <View style={[s.toggle, catLess && s.toggleOn]}><View style={[s.toggleThumb, catLess && s.toggleThumbOn]} /></View>
          </Pressable>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Save" onPress={handleSaveCat} style={{ marginTop: 8 }} />}
        </Sheet>
      )}

      {showAddItem && (
        <Sheet title="Add item" onClose={() => setShowAddItem(false)}>
          <Field label="Name"><Input value={itemName} onChangeText={setItemName} placeholder="e.g. Coffee" autoFocus /></Field>
          <Field label="Emoji"><EmojiPicker value={itemEmoji} onChange={setItemEmoji} /></Field>
          <Pressable style={s.toggleRow} onPress={() => setItemLess(v => !v)}>
            <Text style={s.toggleLabel}>Want to spend less on this?</Text>
            <View style={[s.toggle, itemLess && s.toggleOn]}><View style={[s.toggleThumb, itemLess && s.toggleThumbOn]} /></View>
          </Pressable>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Add item" onPress={handleAddItem} disabled={!itemName.trim()} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 24, marginBottom: 16, gap: 8 },
  title: { flex: 1, fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editLink: { fontSize: typeScale.md, color: colors.gold },
  txLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 12 },
  txLinkText: { flex: 1, fontSize: typeScale.md, color: colors.gold },
  sectionLabel: { fontSize: typeScale.sm, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: 12, marginBottom: 6 },
  itemEmoji: { fontSize: 16 },
  itemName: { flex: 1, fontSize: typeScale.lg, color: colors.text },
  lessBadge: { fontSize: typeScale.xs, color: colors.green },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, marginTop: 4 },
  addItemText: { fontSize: typeScale.md, color: colors.gold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleLabel: { fontSize: typeScale.lg, color: colors.text },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: colors.gold },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.dim },
  toggleThumbOn: { backgroundColor: colors.bg, alignSelf: 'flex-end' },
});
