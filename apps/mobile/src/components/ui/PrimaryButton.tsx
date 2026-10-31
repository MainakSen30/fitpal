import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextProps, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, glow, radii, spacing } from '../../theme/tokens';

interface PrimaryButtonProps {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'glass';
  style?: ViewStyle;
  titleStyle?: TextProps['style'];
  /** Small icon element rendered before the title. */
  icon?: React.ReactNode;
}

/**
 * Primary CTA. Orange gradient, glow, tactile press scale, reduced-motion aware.
 * `glass` variant renders the liquid-glass treatment for secondary CTAs.
 */
export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'solid',
  style,
  titleStyle,
  icon,
}: PrimaryButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const animateIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const animateOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
  };

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[style, { transform: [{ scale: reduceMotion ? 1 : scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPress={onPress}
        onPressIn={animateIn}
        onPressOut={animateOut}
        disabled={isDisabled}
        style={({ pressed }) => [styles.base, variant === 'glass' ? styles.glass : styles.solid, pressed && styles.pressedBg]}
      >
        {variant === 'solid' ? (
          <LinearGradient colors={[colors.brand500, colors.brand600]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.fill}>
            {icon}
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={[styles.title, titleStyle]}>{title}</Text>
            )}
          </LinearGradient>
        ) : (
          <React.Fragment>
            {icon}
            {loading ? (
              <ActivityIndicator color={colors.brand400} />
            ) : (
              <Text style={[styles.title, styles.glassTitle, titleStyle]}>{title}</Text>
            )}
          </React.Fragment>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    overflow: 'hidden',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  solid: {
    ...glow.orange,
    elevation: 8,
  },
  glass: {
    backgroundColor: 'rgba(19, 22, 31, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  fill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  pressedBg: {
    borderColor: colors.borderBrand,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  glassTitle: {
    color: colors.text,
  },
});
