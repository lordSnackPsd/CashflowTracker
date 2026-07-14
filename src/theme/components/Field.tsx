import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typeScale } from '../tokens';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

/** Label + input wrapper used throughout every form sheet. */
export function Field({ label, children }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    fontSize: typeScale.base,
    color: colors.faint,
    marginBottom: 6,
  },
});
