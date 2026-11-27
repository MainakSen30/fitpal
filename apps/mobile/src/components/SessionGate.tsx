import React from 'react';
import { RotateCcw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from './ui/AppBackground';
import { BrandLogo } from './ui/BrandLogo';
import { GlassCard } from './ui/GlassCard';
import { GradientText } from './ui/GradientText';
import { PrimaryButton } from './ui/PrimaryButton';
import { session, useSessionSnapshot, type SessionErrorReason } from '../lib/session';
import { colors, glow, radii, spacing } from '../theme/tokens';

const ERROR_COPY: Record<SessionErrorReason, { title: string; message: string }> = {
  network: {
    title: 'Connection lost',
    message: 'We could not check your saved sign-in. Nothing was cleared. Try again.',
  },
  server: {
    title: 'Sign-in check unavailable',
    message: 'The service is temporarily unavailable. Your saved sign-in is unchanged.',
  },
  'storage-read': {
    title: 'Saved sign-in unavailable',
    message: 'We could not read your saved sign-in on this device. Nothing was changed. Try again.',
  },
  cleanup: {
    title: 'Sign-out needs another try',
    message: 'We could not clear the saved session on this device. Your account is still protected.',
  },
};

export function SessionGate({ children }: { children: React.ReactNode }) {
  const state = useSessionSnapshot();

  React.useEffect(() => {
    void session.restore();
  }, []);

  if (state.status === 'loading') {
    return (
      <View style={styles.splash}>
        <AppBackground />
        <View style={styles.splashInner}>
          <BrandLogo size={48} />
        </View>
      </View>
    );
  }

  if (state.status === 'error') {
    const reason = state.errorReason ?? 'server';
    const copy = ERROR_COPY[reason];
    return (
      <SafeAreaView style={styles.safe}>
        <AppBackground />
        <View style={styles.errorContent}>
          <GlassCard accent style={styles.errorCard}>
            <GradientText style={styles.title}>{copy.title}</GradientText>
            <Text style={styles.message}>{copy.message}</Text>
            <PrimaryButton
              title="Try Again"
              icon={<RotateCcw size={16} color="#ffffff" strokeWidth={2} />}
              onPress={() => void session.retry()}
              style={styles.retry}
            />
          </GlassCard>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorCard: {
    padding: spacing.lg,
    gap: spacing.sm,
    ...glow.card,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  retry: {
    marginTop: spacing.md,
    borderRadius: radii.xl,
  },
});
