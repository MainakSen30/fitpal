import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import { GradientText } from './GradientText';

interface EmptyStateProps {
  /** Lucide icon element rendered in the glowing glyph well. */
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Optional gradient call-to-action word in the title. */
  highlight?: string;
}

/**
 * Thoughtful empty state: glowing icon well, gradient-accented title,
 * muted description. Used across feature screens.
 */
export function EmptyState({ icon, title, description, highlight }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.glyphWell}>
        <View style={styles.glyphGlow} />
        {icon}
      </View>
      {highlight ? (
        <GradientText style={[styles.title, styles.titleBase]}>
          {title}
        </GradientText>
      ) : (
        <Text style={[styles.title, styles.titleBase, { color: colors.text }]}>{title}</Text>
      )}
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  glyphWell: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderBrand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  glyphGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  titleBase: {},
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },
});
