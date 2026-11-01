import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * FitPal brand lockup: orange gradient glyph tile + "FitPal" wordmark.
 * Matches the website navbar identity (gradient tile + Fit/Pal two-tone).
 */
export function BrandLogo({ size = 44, showWordmark = true }: BrandLogoProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28 }]}>
        <Text style={[styles.glyph, { fontSize: size * 0.5 }]}>{'\u{1F525}'}</Text>
      </View>
      {showWordmark && (
        <Text style={[styles.wordmark, { fontSize: size * 0.82 }]}>
          Fit<Text style={styles.accent}>Pal</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  tile: {
    backgroundColor: colors.brand500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  glyph: {
    textAlign: 'center',
  },
  wordmark: {
    color: colors.text,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  accent: {
    color: colors.brand500,
  },
});
