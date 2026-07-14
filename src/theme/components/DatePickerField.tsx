import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { colors, radii, spacing, typeScale } from '../tokens';

interface DatePickerFieldProps {
  value: string;         // ISO date: YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
}

export function DatePickerField({ value, onChange, placeholder = 'Select date' }: DatePickerFieldProps) {
  const [showModal, setShowModal] = useState(false);

  // Parse initial date safely
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-indexed

  // Months names
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Days of week
  const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Helper to get number of days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // Generate grid cells (null for empty spaces, number for days)
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    grid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(d);
  }

  // Next and Prev handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const y = currentYear;
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setShowModal(false);
  };

  // Check if cell is the currently selected date
  let selectedDay: number | null = null;
  let selectedMonth: number | null = null;
  let selectedYear: number | null = null;
  if (value) {
    const parsed = new Date(value + 'T00:00:00');
    selectedDay = parsed.getDate();
    selectedMonth = parsed.getMonth();
    selectedYear = parsed.getFullYear();
  }

  return (
    <>
      <Pressable style={s.container} onPress={() => setShowModal(true)} accessibilityRole="button">
        <Text style={[s.text, !value && s.placeholder]}>
          {value || placeholder}
        </Text>
        <CalendarDays size={16} color={colors.dim} />
      </Pressable>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={s.modal} onPress={e => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select date</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={12}>
                <X size={18} color={colors.dim} />
              </Pressable>
            </View>

            {/* Month/Year selector */}
            <View style={s.monthSelector}>
              <Pressable onPress={handlePrevMonth} style={s.arrowBtn} hitSlop={12}>
                <ChevronLeft size={20} color={colors.text} />
              </Pressable>
              <Text style={s.monthYearLabel}>
                {MONTHS[currentMonth]} {currentYear}
              </Text>
              <Pressable onPress={handleNextMonth} style={s.arrowBtn} hitSlop={12}>
                <ChevronRight size={20} color={colors.text} />
              </Pressable>
            </View>

            {/* Days of week header */}
            <View style={s.daysOfWeekHeader}>
              {DAYS_OF_WEEK.map((d, i) => (
                <Text key={i} style={s.dayOfWeekText}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={s.grid}>
              {grid.map((day, i) => {
                const isSelected =
                  day !== null &&
                  day === selectedDay &&
                  currentMonth === selectedMonth &&
                  currentYear === selectedYear;

                return (
                  <Pressable
                    key={i}
                    style={[
                      s.gridCell,
                      day === null && s.emptyCell,
                      isSelected && s.selectedCell
                    ]}
                    disabled={day === null}
                    onPress={() => day !== null && handleSelectDay(day)}
                  >
                    {day !== null && (
                      <Text style={[s.cellText, isSelected && s.selectedCellText]}>
                        {day}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typeScale.lg,
    fontWeight: '600',
    color: colors.text,
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  arrowBtn: {
    padding: 6,
  },
  monthYearLabel: {
    fontSize: typeScale.md,
    fontWeight: '600',
    color: colors.text,
  },
  daysOfWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayOfWeekText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: typeScale.sm,
    fontWeight: '500',
    color: colors.faint,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  gridCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: radii.sm,
  },
  emptyCell: {
    backgroundColor: 'transparent',
  },
  selectedCell: {
    backgroundColor: colors.gold,
  },
  cellText: {
    fontSize: typeScale.md,
    color: colors.text,
  },
  selectedCellText: {
    color: colors.bg,
    fontWeight: '700',
  },
});
