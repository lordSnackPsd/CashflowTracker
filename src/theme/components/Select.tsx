import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { colors, radii, typeScale } from '../tokens';
import { Sheet } from './Sheet';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Title shown on the picker sheet. */
  title?: string;
  compact?: boolean;
}

/** Dropdown select — opens a bottom-sheet option list (native pickers don't
 *  match the dark theme). */
export function Select({ value, options, onChange, placeholder = 'Select', title = 'Select', compact }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <>
      <Pressable
        style={[styles.trigger, compact && styles.compact]}
        onPress={() => setOpen(true)}
      >
        <Text
          style={[styles.triggerText, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={14} color={colors.faint} />
      </Pressable>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <View style={styles.list}>
            {options.map(o => (
              <Pressable
                key={o.value}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Text
                  style={[styles.optionText, o.value === value && styles.optionActive]}
                  numberOfLines={1}
                >
                  {o.label}
                </Text>
                {o.value === value && <Check size={16} color={colors.gold} />}
              </Pressable>
            ))}
          </View>
        </Sheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  compact: {
    height: 36,
    paddingHorizontal: 10,
    flex: 1,
  },
  triggerText: {
    flex: 1,
    fontSize: typeScale.md,
    color: colors.text,
  },
  placeholder: {
    color: colors.faint,
  },
  list: {
    paddingBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionPressed: {
    backgroundColor: colors.surface,
  },
  optionText: {
    flex: 1,
    fontSize: typeScale.lg,
    color: colors.text,
  },
  optionActive: {
    color: colors.gold,
    fontWeight: '500',
  },
});
