import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

interface SectionHeaderProps {
  title: string;
  /** Optional right-side action label (e.g. "See all"). */
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <Text style={styles.action} onPress={onAction} accessibilityRole="button">
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  action: {
    color: colors.brand400,
    fontSize: 14,
    fontWeight: '600',
  },
});
