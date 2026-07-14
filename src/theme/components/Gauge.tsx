import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radii } from '../tokens';

interface GaugeProps {
  /** 0..1 — availableBalance / creditLimit. Unlike a payoff bar this moves
   *  in both directions over time (usage can outpace repayment). */
  value: number;
}

/** Revolving-credit gauge — same visual family as ProgressBar but explicitly
 *  bidirectional; green when plenty available, gold as it thins out. */
export function Gauge({ value }: GaugeProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const color = clamped >= 0.5 ? colors.green : clamped >= 0.2 ? colors.gold : colors.red;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
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
