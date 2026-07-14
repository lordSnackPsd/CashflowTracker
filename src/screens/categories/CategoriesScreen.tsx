import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import type { Category } from '../../types';
import { repos } from '../../db/repositories';
import { useApp } from '../../context/AppContext';
import { Sheet, Button, Field, Input, EmojiPicker } from '../../theme/components';
import { colors, radii, typeScale } from '../../theme/tokens';
import type { DrawerParamList, RootStackParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function CategoriesScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, dataVersion, bumpData } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmoji, setAddEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setCategories(await repos.categories.list());
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, dataVersion, load]);

  const handleAdd = useCallback(async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      await repos.categories.create({ name: addName.trim(), emoji: addEmoji, monthlyBudget: null, lessSpendGoal: false });
      bumpData();
      setShowAdd(false);
      setAddName(''); setAddEmoji('');
    } finally { setSaving(false); }
  }, [addName, addEmoji, bumpData]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={colors.dim} />
        </Pressable>
        <Text style={s.title}>Categories &amp; items</Text>
        <Pressable onPress={() => setShowAdd(true)} hitSlop={8}>
          <Plus size={20} color={colors.gold} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {categories.length === 0 && <Text style={s.empty}>No categories yet.</Text>}
        {categories.map(c => (
          <Pressable
            key={c.id}
            style={s.row}
            onPress={() => navigation.navigate('CategoryDetail', { categoryId: c.id })}
          >
            <Text style={s.emoji}>{c.emoji || '📦'}</Text>
            <Text style={s.name}>{c.name}</Text>
            {c.monthlyBudget != null && <Text style={s.budget}>{c.monthlyBudget} budget</Text>}
            <ChevronRight size={14} color={colors.faint} />
          </Pressable>
        ))}
      </ScrollView>

      {showAdd && (
        <Sheet title="New category" onClose={() => setShowAdd(false)}>
          <Field label="Name"><Input value={addName} onChangeText={setAddName} placeholder="e.g. Groceries" autoFocus /></Field>
          <Field label="Emoji"><EmojiPicker value={addEmoji} onChange={setAddEmoji} /></Field>
          {saving ? <ActivityIndicator color={colors.gold} /> : <Button title="Add" onPress={handleAdd} disabled={!addName.trim()} style={{ marginTop: 8 }} />}
        </Sheet>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  title: { fontSize: typeScale.xl, fontWeight: '600', color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 8 },
  emoji: { fontSize: 20 },
  name: { flex: 1, fontSize: typeScale.lg, color: colors.text },
  budget: { fontSize: typeScale.sm, color: colors.faint },
  empty: { fontSize: typeScale.md, color: colors.faint, paddingTop: 12 },
});
