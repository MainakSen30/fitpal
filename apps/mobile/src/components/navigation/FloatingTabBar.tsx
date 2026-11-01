import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../../theme/tokens';

/** Expert-level minimal shape of the tab bar props supplied by expo-router v58's bottom tags. */
type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string; params?: object }[];
  };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarAccessibilityLabel?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
      };
    }
  >;
  navigateToTab: (routeKey: string) => void;
};

/**
 * Floating translucent pill tab bar (liquid glass).
 * - expo-blur translucency, with a translucent surface fallback where blur is unsupported
 * - sliding soft orange highlight for the active route
 * - icons come from each screen's `tabBarIcon` option (lucide-react-native)
 */
export function FloatingTabBar({ state, descriptors, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const hasAppeared = useRef(false);
  const tabWidth = state.routes.length > 0 ? trackWidth / state.routes.length : 0;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useLayoutEffect(() => {
    if (trackWidth === 0) return;
    const indicatorWidth = tabWidth - INDICATOR_INSET * 2;
    const target = state.index * tabWidth + INDICATOR_INSET;
    if (reduceMotion) {
      indicatorX.setValue(target);
      indicatorOpacity.setValue(1);
      hasAppeared.current = true;
      return;
    }
    if (!hasAppeared.current) {
      hasAppeared.current = true;
      Animated.parallel([
        Animated.spring(indicatorX, { toValue: target, useNativeDriver: true, speed: 30, bounciness: 0 }),
        Animated.timing(indicatorOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.spring(indicatorX, {
      toValue: target,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  }, [state.index, tabWidth, trackWidth, reduceMotion, indicatorX, indicatorOpacity]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + spacing.xs,
          paddingHorizontal: spacing.lg,
        },
      ] as StyleProp<ViewStyle>}
    >
      <View style={styles.pillShadow}>
        <View style={styles.pillClip}>
          <BlurView intensity={28} tint="dark" style={styles.blur} experimentalBlurMethod="dimezisBlurView">
            <View style={styles.pillInner}>
              <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
                <Animated.View
                  style={[
                    styles.indicator,
                    {
                      opacity: indicatorOpacity,
                      width: Math.max(0, tabWidth - INDICATOR_INSET * 2),
                      transform: [{ translateX: indicatorX }],
                    },
                  ]}
                />
                {state.routes.map((route, index) => {
                  const { options } = descriptors[route.key];
                  const isFocused = state.index === index;

                  const onPress = () => {
                    if (!isFocused) {
                      navigateToTab(route.key);
                    }
                  };

                  return (
                    <Pressable
                      key={route.key}
                      accessibilityRole="tab"
                      accessibilityState={isFocused ? { selected: true } : {}}
                      accessibilityLabel={options.tabBarAccessibilityLabel}
                      onPress={onPress}
                      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
                    >
                      {options.tabBarIcon?.({ color: isFocused ? colors.brand400 : colors.textFaint, size: 22, focused: isFocused })}
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={[styles.label, { color: isFocused ? colors.brand400 : colors.textFaint }]}
                      >
                        {options.title ?? route.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  );
}

const INDICATOR_INSET = 5;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  pillShadow: {
    alignSelf: 'stretch',
    borderRadius: radii.pill,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  pillClip: {
    alignSelf: 'stretch',
    borderRadius: radii.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(9, 8, 7, 0.72)',
  },
  blur: {
    backgroundColor: 'rgba(9, 8, 7, 0.35)',
  },
  pillInner: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  track: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radii.pill,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.28)',
    shadowColor: colors.brand500,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  tabPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
