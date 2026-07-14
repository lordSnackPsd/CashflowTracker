import React from 'react';
import { NativeModules, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { colors, radii, typeScale } from '../tokens';

interface DatePickerFieldProps {
  value: string;         // ISO date: YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
}

function isoToDate(iso: string): Date {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Android-native calendar date picker.
 * Uses the built-in DateTimePicker via the NativeModules bridge.
 * Falls back gracefully on unsupported platforms.
 */
export function DatePickerField({ value, onChange, placeholder = 'Select date' }: DatePickerFieldProps) {
  const openPicker = () => {
    if (Platform.OS !== 'android') return;

    // Use the RNDateTimePickerAndroid module directly
    // (shipped with @react-native-community/datetimepicker, bundled with RN 0.65+)
    const RNDateTimePicker = NativeModules.RNDateTimePickerAndroid;
    if (!RNDateTimePicker) {
      // Fallback: no-op if the module isn't available
      return;
    }

    const currentDate = value ? isoToDate(value) : new Date();

    RNDateTimePicker.open(
      {
        mode: 'date',
        value: currentDate.getTime(),
      },
      (event: { type: string; timestamp?: number }) => {
        if (event.type === 'set' && event.timestamp != null) {
          onChange(dateToIso(new Date(event.timestamp)));
        }
      },
    );
  };

  return (
    <Pressable style={s.container} onPress={openPicker} accessibilityRole="button">
      <Text style={[s.text, !value && s.placeholder]}>
        {value || placeholder}
      </Text>
      <CalendarDays size={16} color={colors.dim} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  text: {
    fontSize: typeScale.lg,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.faint,
  },
});
