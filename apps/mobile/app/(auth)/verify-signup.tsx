import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { BrandLogo } from '../../src/components/ui/BrandLogo';
import { GradientText } from '../../src/components/ui/GradientText';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { createSignupService, mapResendResult, mapVerifyResult, type SignupActions } from '../../src/lib/signup';
import { createSignupPost } from '../../src/lib/signup-http';
import { session } from '../../src/lib/session';
import {
  createSignupStorage,
  isValidOtpCode,
  loadVerifyContext,
  normalizeOtpCode,
  resendCooldownRemaining,
  type PendingSignupRecord,
  type SignupStorage as SignupStorageAdapter,
} from '../../src/lib/signup-storage';
import { colors, glow, radii, spacing } from '../../src/theme/tokens';

type VerifyScreenServiceDeps = {
  post?: SignupActions['post'];
  storage?: SignupStorageAdapter;
};

export function createVerifyScreenService(deps: VerifyScreenServiceDeps = {}) {
  const baseStorage = deps.storage ?? createSignupStorage();
  const saveSessionToken = baseStorage.saveSessionToken.bind(baseStorage);
  const storage: SignupStorageAdapter = {
    ...baseStorage,
    saveSessionToken: async (token) => {
      await saveSessionToken(token);
      session.establish(token);
    },
  };
  const service = createSignupService({ ...storage, post: deps.post ?? createSignupPost() });
  return { service, storage };
}

const { service: signupService, storage: signupStorage } = createVerifyScreenService();

export default function VerifySignupScreen() {
  const [record, setRecord] = useState<PendingSignupRecord | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const verifyRef = useRef(false);
  const resendRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await loadVerifyContext({ service: signupService, storage: signupStorage });
      if (!active) return;
      if (result.kind === 'ready') setRecord(result.record);
      else if (result.kind === 'authenticated') router.replace('/(tabs)');
      else if (result.kind === 'failed') setLoadFailed(true);
      else router.replace('./signup');
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!record || record.pending.kind !== 'accepted') {
      setCooldown(0);
      return;
    }
    const update = () => setCooldown(resendCooldownRemaining(record.updatedAt, Date.now()));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [record]);

  const startOver = async () => {
    try {
      const cleared = await signupService.clearPending();
      if (!cleared) {
        Alert.alert('Could not start over', 'We could not clear the saved signup. Please retry.');
        return;
      }
      router.replace('./signup');
    } catch {
      Alert.alert('Could not start over', 'We could not clear the saved signup. Please retry.');
    }
  };

  const onSubmit = async () => {
    if (verifyRef.current) return;
    if (!isValidOtpCode(code)) {
      setErrorMessage('Enter the 6-digit code.');
      return;
    }
    verifyRef.current = true;
    setVerifying(true);
    setErrorMessage(null);
    setLoginRequired(false);
    try {
      const outcome = mapVerifyResult(await signupService.verify({ code }));
      if (outcome.kind === 'success') {
        if (outcome.cleanupFailed) await signupService.clearPending().catch(() => false);
        router.replace('/(tabs)');
        return;
      }
      if (outcome.kind === 'sessionPersistenceFailed') {
        setCode('');
        setInfoMessage(outcome.message);
        setLoginRequired(true);
        return;
      }
      if (outcome.kind === 'restart') {
        Alert.alert('Verification unavailable', outcome.message, [
          { text: 'Cancel' },
          { text: 'Start over', onPress: startOver },
        ]);
        return;
      }
      setErrorMessage(outcome.message);
    } finally {
      setVerifying(false);
      verifyRef.current = false;
    }
  };

  const onResend = async () => {
    if (resendRef.current || cooldown > 0) return;
    resendRef.current = true;
    setResending(true);
    setErrorMessage(null);
    try {
      const outcome = mapResendResult(await signupService.resend());
      if (outcome.kind === 'restart') {
        Alert.alert('Verification unavailable', outcome.message, [
          { text: 'Cancel' },
          { text: 'Start over', onPress: startOver },
        ]);
        return;
      }
      setInfoMessage(outcome.message);
      try {
        setRecord(await signupStorage.loadPendingRecord());
      } catch {
        setInfoMessage(null);
        setErrorMessage('We could not refresh your signup after resending. Please retry.');
      }
    } finally {
      setResending(false);
      resendRef.current = false;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppBackground />
        <View style={styles.loading}>
          <BrandLogo size={48} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadFailed || !record) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppBackground />
        <View style={styles.container}>
          <View style={styles.formCard}>
            <GradientText style={styles.title}>Signup unavailable</GradientText>
            <Text style={styles.description}>
              We could not restore your pending signup on this device. Start again to continue.
            </Text>
            <PrimaryButton title="Start over" onPress={startOver} style={styles.button} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const deliveryUnavailable = record.pending.kind === 'delivery-failed';
  const channelLabel = record.pending.kind === 'accepted'
    ? record.pending.channel === 'email' ? 'email' : 'phone'
    : 'your contact method';

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <ScreenEntrance>
              <View style={styles.formCard}>
                <View style={styles.logoContainer}>
                  <BrandLogo size={44} />
                </View>
                <GradientText style={styles.title}>Verify signup</GradientText>
                <Text style={styles.description}>
                  {deliveryUnavailable
                    ? "We couldn't deliver a code. Request a new one to continue."
                    : `Enter the 6-digit code sent to ${channelLabel}.`}
                </Text>

                {infoMessage && <Text style={styles.info}>{infoMessage}</Text>}
                {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
                {loginRequired && (
                  <PrimaryButton
                    title="Sign in with password"
                    onPress={() => router.replace('/(auth)/login')}
                    style={styles.button}
                  />
                )}

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Verification code</Text>
                  <TextInput
                    style={[styles.input, errorMessage && styles.inputError]}
                    placeholder="000000"
                    placeholderTextColor="#6b7280"
                    value={code}
                    onChangeText={(value) => setCode(normalizeOtpCode(value))}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                    editable={!verifying && !deliveryUnavailable && !loginRequired}
                    returnKeyType="done"
                    onSubmitEditing={onSubmit}
                  />
                </View>

                <PrimaryButton
                  title={verifying ? 'Verifying' : 'Verify code'}
                  loading={verifying}
                  disabled={verifying || resending || deliveryUnavailable || loginRequired}
                  onPress={onSubmit}
                  style={styles.button}
                />

                <PrimaryButton
                  variant="glass"
                  title={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
                  loading={resending}
                  disabled={resending || verifying || cooldown > 0 || loginRequired}
                  onPress={onResend}
                  style={styles.resendButton}
                />

                <TouchableOpacity activeOpacity={0.7} onPress={startOver} style={styles.startOver}>
                  <Text style={styles.linkText}>Use a different account</Text>
                </TouchableOpacity>
              </View>
            </ScreenEntrance>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: 'rgba(13, 16, 22, 0.75)',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderBrand,
    gap: 14,
    ...glow.card,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
  },
  info: {
    color: colors.brand400,
    fontSize: 13,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  inputContainer: {
    gap: 8,
    marginTop: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(19, 22, 31, 0.8)',
    color: '#ffffff',
    fontSize: 22,
    letterSpacing: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
  },
  inputError: {
    borderColor: colors.error,
  },
  button: {
    marginTop: spacing.sm,
  },
  resendButton: {
    marginTop: 2,
  },
  startOver: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.brand400,
    fontWeight: '600',
    fontSize: 14,
  },
});
