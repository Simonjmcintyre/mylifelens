import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { backgroundColor: colors.primary }]}>
        <Feather name="aperture" size={compact ? 16 : 19} color={colors.primaryForeground} />
      </View>
      {!compact && (
        <Text style={[styles.wordmark, { color: colors.foreground }]}>Digital Life</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.7 },
});