import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, colorsExtra, radii } from '../tokens';

interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  danger?: boolean;
}

/** Pill-shaped selector button. active = gold border + tinted background;
 *  danger = red border/text. */
export function Chip({ children, active, onPress, danger }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.active, danger && styles.danger]}
    >
      <View style={styles.inner}>
        {typeof children === 'string' ? (
          <Text
            style={[
              styles.label,
              active && styles.labelActive,
              danger && styles.labelDanger,
            ]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  active: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colorsExtra.goldTint,
    // compensate the thicker border so the chip doesn't jump
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  danger: {
    borderColor: colors.red,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: colors.dim,
  },
  labelActive: {
    color: colors.gold,
    fontWeight: '500',
  },
  labelDanger: {
    color: colors.red,
  },
});
