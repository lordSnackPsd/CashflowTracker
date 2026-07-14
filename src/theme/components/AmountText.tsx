import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors, money } from '../tokens';

interface AmountTextProps {
  value: number;
  currency?: string; // callers pass settings.currency; defaults to TND
  style?: TextStyle | TextStyle[];
}

/** Renders "1,234.5 TND" — red when negative. */
export function AmountText({ value, currency = 'TND', style }: AmountTextProps) {
  return (
    <Text style={[styles.text, value < 0 && styles.negative, style]}>
      {money(value)} {currency}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.text,
  },
  negative: {
    color: colors.red,
  },
});
