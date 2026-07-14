import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, colorsExtra, radii } from '../tokens';
import { Emoji } from './Emoji';
import { Input } from './Input';

const EMOJI_PRESET = [
  '🚕', '☕', '🚬', '🛒', '⛽', '🧾', '🎮', '🍔', '🏠', '💊',
  '📱', '👕', '🎁', '✈️', '🎓', '🐾', '💇', '🧻', '🔧', '🎵',
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

/** Preset grid of common emoji plus a free-text field for pasting any emoji
 *  (categories/items use arbitrary emoji, not a closed set). */
export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [custom, setCustom] = useState('');

  return (
    <View>
      <View style={styles.grid}>
        {EMOJI_PRESET.map(e => (
          <Pressable
            key={e}
            onPress={() => onChange(e)}
            style={[styles.cell, value === e && styles.cellActive]}
          >
            <Emoji char={e} size={15} />
          </Pressable>
        ))}
      </View>
      <Input
        placeholder="or paste any emoji"
        value={custom}
        onChangeText={text => {
          setCustom(text);
          if (text.trim()) onChange(text.trim());
        }}
        style={styles.customInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  cell: {
    width: 36,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colorsExtra.goldTint,
  },
  customInput: {
    height: 36,
    textAlign: 'center',
  },
});
