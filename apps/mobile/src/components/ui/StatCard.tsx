import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, spacing, fontFamily } from '../../theme/tokens';

interface StatCardProps {
  value: string;
  label: string;
  /** Accent color for the value. Defaults to brand orange. */
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Metric chip used in summary rows (mirrors website stat tiles:
 * mono value + muted caption on a glass surface).
 */
export function StatCard({ value, label, valueColor = colors.brand400, style }: StatCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  value: {
    fontFamily: fontFamily.mono,
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
