import type { ErrorBoundaryProps } from 'expo-router';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../../theme/tokens';
import { AppBackground } from './AppBackground';
import { GlassCard } from './GlassCard';
import { GradientText } from './GradientText';
import { PrimaryButton } from './PrimaryButton';

interface ErrorFallbackProps extends ErrorBoundaryProps {
  /** Screen-specific headline; defaults to a generic one. */
  title?: string;
}

/**
 * Full-screen fallback rendered by Expo Router's ErrorBoundary export when a
 * route throws during render. Keeps the app usable: retry re-renders the route
 * without a cold restart, and the raw message is only shown in development.
 */
export function ErrorFallback({ error, retry, title = 'Something gave out.' }: ErrorFallbackProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWell}>
          <AlertTriangle size={28} color={colors.brand400} strokeWidth={1.8} />
        </View>

        <GradientText style={styles.title}>{title}</GradientText>
        <Text style={styles.description}>
          The screen hit an unexpected error. Your saved workouts are safe — try again, and if it
          keeps happening, restart the app.
        </Text>

        {__DEV__ && error.message ? (
          <GlassCard style={styles.detailCard}>
            <Text style={styles.detailLabel}>{'DETAILS'}</Text>
            <Text style={styles.detailText}>{error.message}</Text>
          </GlassCard>
        ) : null}

        <PrimaryButton
          title="Try Again"
          icon={<RotateCcw size={16} color="#ffffff" strokeWidth={2} />}
          onPress={() => {
            void retry();
          }}
          style={styles.retry}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderBrand,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  detailCard: {
    marginTop: spacing.lg,
  },
  detailLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  retry: {
    marginTop: spacing.xl,
  },
});
