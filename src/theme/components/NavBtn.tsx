import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, typeScale } from '../tokens';

interface NavBtnProps {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
}

/** Bottom tab bar item — gold when active, faint otherwise. */
export function NavBtn({ active, icon: Icon, label, onPress }: NavBtnProps) {
  const color = active ? colors.gold : colors.faint;
  return (
    <Pressable
      onPress={onPress}
      style={styles.btn}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Icon size={20} color={color} />
      <Text style={[styles.label, { color }, active && styles.labelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: typeScale.xs,
  },
  labelActive: {
    fontWeight: '500',
  },
});
