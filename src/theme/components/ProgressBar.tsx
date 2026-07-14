import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii } from '../tokens';

interface ProgressBarProps {
  /** 0..1 — clamped. Payoff-style: fills left→right as principal is repaid. */
  value: number;
  color?: string;
}

/** Linear payoff bar, used for term loans and friend loans (paid / target). */
export function ProgressBar({ value, color = colors.gold }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
  },
});
