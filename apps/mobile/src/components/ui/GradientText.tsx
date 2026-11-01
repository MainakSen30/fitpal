import React from 'react';
import { Text, TextProps, StyleSheet, StyleProp, TextStyle } from 'react-native';
// typed cast below keeps TS 6 + React 19 JSX checks happy with this package's legacy class types
import MaskedViewDefault from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../theme/tokens';

const MaskedView = MaskedViewDefault as unknown as React.FC<{
  maskElement?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
}>;

export type GradientColors = readonly [string, string, ...string[]];

interface GradientTextProps extends TextProps {
  /** Gradient stops. Minimum two. Defaults to the FitPal brand ramp. */
  colors?: GradientColors;
}

/**
 * Brand gradient text (Aceternity-style) implemented with MaskedView
 * + LinearGradient. Works on iOS and Android without DOM tricks.
 */
export function GradientText({ colors: stops = gradients.heroText, style, children, ...rest }: GradientTextProps) {
  return (
    <MaskedView maskElement={<Text style={[style, styles.mask]} {...rest}>{children}</Text>}>
      <LinearGradient colors={stops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, styles.ghost]} {...rest}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  mask: {
    backgroundColor: 'transparent',
  },
  ghost: {
    opacity: 0,
  },
});
