import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, AccessibilityInfo, ViewStyle, StyleProp } from 'react-native';

interface AppBackgroundProps {
  /** Extra overlays rendered above the orbs (below content). */
  overlays?: React.ReactNode;
  /** Disable ambient motion (used when reduced motion is on). */
  static?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Dark near-black canvas with two slow-drifting orange ambient orbs.
 * Mirrors the website's radial-glow hero treatment.
 */
export function AppBackground({ overlays, static: isStatic, style }: AppBackgroundProps) {
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const animate = !isStatic && !reduceMotion;

  useEffect(() => {
    if (!animate) return;
    const v1 = Animated.loop(
      Animated.sequence([
        Animated.timing(orb1, { toValue: 1, duration: 10000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orb1, { toValue: 0, duration: 10000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const v2 = Animated.loop(
      Animated.sequence([
        Animated.timing(orb2, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orb2, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    v1.start();
    v2.start();
    return () => {
      v1.stop();
      v2.stop();
    };
  }, [animate, orb1, orb2]);

  const orb1Transform = animate
    ? [
        {
          translateX: orb1.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }),
        },
        {
          translateY: orb1.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }),
        },
      ]
    : [];

  const orb2Transform = animate
    ? [
        {
          translateX: orb2.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }),
        },
        {
          translateY: orb2.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }),
        },
      ]
    : [];

  return (
    <View style={[styles.canvas, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.orbTop, { transform: orb1Transform }]} />
      <Animated.View style={[styles.orbBottom, { transform: orb2Transform }]} />
      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#060709',
    overflow: 'hidden',
  },
  orbTop: {
    position: 'absolute',
    top: -220,
    right: -110,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -260,
    left: -160,
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(234, 88, 12, 0.11)',
  },
});
