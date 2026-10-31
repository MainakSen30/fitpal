import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, PressableProps, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { colors, glow, radii } from '../../theme/tokens';

interface GlassCardProps extends Pick<PressableProps, 'onPress' | 'disabled'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Slight orange tint on the border for emphasized cards. */
  accent?: boolean;
  /** Press scale micro-interaction (default true when pressable). */
  interactive?: boolean;
}

/**
 * Dark forehead surface with a thin border. When `onPress` is provided it
 * becomes an interactive card with a subtle press scale (Aceternity glare feel).
 */
export function GlassCard({ children, style, accent = false, interactive = true, onPress, disabled }: GlassCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const pressable = Boolean(onPress);

  const pressIn = () => {
    if (!interactive || reduceMotion) return;
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };

  const pressOut = () => {
    if (!interactive || reduceMotion) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 5 }).start();
  };

  const content = <View style={[styles.card, accent && styles.accentBorder, style as ViewStyle]}>{children}</View>;

  if (!pressable) {
    return content;
  }

  return (
    <Animated.View style={{ transform: [{ scale: reduceMotion ? 1 : scale }] }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={styles.pressable}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(13, 16, 22, 0.78)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accentBorder: {
    borderColor: colors.borderBrand,
  },
  pressable: {},
});
