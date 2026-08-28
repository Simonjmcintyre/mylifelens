import { REMINDER_OPTIONS } from '@/context/ProjectContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type ReminderPickerProps = {
  selectedHours: number | null;
  onSelect: (hours: number | null) => void;
  disabled?: boolean;
  showNone?: boolean;
};

export function ReminderPicker({ selectedHours, onSelect, disabled = false, showNone = false }: ReminderPickerProps) {
  const colors = useColors();
  const options = showNone ? [{ hours: null, label: 'No reminders' }, ...REMINDER_OPTIONS] : REMINDER_OPTIONS;

  return (
    <View>
      {options.map((option) => {
        const isSelected = selectedHours === option.hours;
        return (
          <Pressable
            key={option.hours ?? 'none'}
            testID={option.hours === null ? 'reminder-none-option' : `reminder-option-${option.hours}`}
            disabled={disabled}
            onPress={() => onSelect(option.hours)}
            style={[styles.option, { borderColor: colors.border, backgroundColor: isSelected ? colors.secondary : colors.background }, disabled && styles.disabled]}
          >
            <View style={[styles.optionIcon, { backgroundColor: option.hours === null ? colors.muted : colors.accent }]}>
              <Feather name={option.hours === null ? 'bell-off' : 'bell'} size={17} color={option.hours === null ? colors.mutedForeground : colors.accentForeground} />
            </View>
            <Text style={[styles.optionText, { color: colors.foreground }]}>{option.label}</Text>
            {isSelected && <Feather name="check" size={18} color={colors.secondaryForeground} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: 61, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  optionIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  optionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  disabled: { opacity: 0.6 },
});