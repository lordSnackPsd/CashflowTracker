import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typeScale } from '../theme/tokens';

/** Temporary stand-in while a section is under construction. */
export function Placeholder({ title, back }: { title: string; back?: boolean }) {
  const navigation = useNavigation();
  return (
    <View style={styles.root}>
      {back && (
        <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft size={16} color={colors.dim} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    paddingTop: 24,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backText: {
    fontSize: typeScale.md,
    color: colors.dim,
  },
  title: {
    fontSize: typeScale.xl,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typeScale.md,
    color: colors.faint,
  },
});
