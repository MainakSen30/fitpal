import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, type TextInputInstance } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { BrandLogo } from '../../src/components/ui/BrandLogo';
import { GradientText } from '../../src/components/ui/GradientText';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import {
  createSignupService,
  mapSignupResult,
  signupSchema,
  toRegisterInput,
  type SignupActions,
  type SignupFormValues,
  type SignupScreenOutcome,
} from '../../src/lib/signup';
import { createSignupPost } from '../../src/lib/signup-http';
import { createSignupStorage, type SignupStorage as SignupStorageAdapter } from '../../src/lib/signup-storage';
import { colors, glow, radii, spacing } from '../../src/theme/tokens';

type SignupScreenServiceDeps = {
  post?: SignupActions['post'];
  storage?: SignupStorageAdapter;
};

export function createSignupScreenService(deps: SignupScreenServiceDeps = {}) {
  const storage = deps.storage ?? createSignupStorage();
  const service = createSignupService({ ...storage, post: deps.post ?? createSignupPost() });
  return { service, storage };
}

const { service: signupService, storage: signupStorage } = createSignupScreenService();

export default function SignupScreen() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submittingRef = useRef(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const phoneRef = useRef<TextInputInstance>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { verificationChannel: 'email' },
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await signupStorage.loadSessionToken();
        if (!active) return;
        if (token) {
          router.replace('/(tabs)');
          return;
        }
        const pending = await signupService.loadPending();
        if (active && pending.kind === 'loaded') router.replace('./verify-signup');
      } catch {
        if (active) {
          Alert.alert('Signup unavailable', 'We could not check for an existing signup. Please retry.');
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const applyOutcome = async (outcome: SignupScreenOutcome) => {
    if (outcome.kind === 'verify') {
      router.replace('./verify-signup');
      return;
    }
    if (outcome.kind === 'recover') {
      Alert.alert('Signup not saved', outcome.message, [
        { text: 'Not now' },
        {
          text: 'Retry',
          onPress: async () => {
            const saved = await signupService.persistPending(outcome.pending);
            if (saved) router.replace('./verify-signup');
            else Alert.alert('Still not saved', 'We still could not save this signup. Please try again later.');
          },
        },
      ]);
      return;
    }
    Alert.alert('Registration failed', outcome.message);
  };

  const onSubmit = async (data: SignupFormValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await applyOutcome(mapSignupResult(await signupService.register(toRegisterInput(data))));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <ScreenEntrance>
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <BrandLogo size={44} />
                </View>
                <Text style={styles.subtitle}>Track Your Workouts. Own Your Progress.</Text>
              </View>
            </ScreenEntrance>

            <ScreenEntrance delay={120}>
              <View style={styles.formCard}>
                <GradientText style={styles.title}>Create Account</GradientText>
                <Text style={styles.description}>Start your fitness journey today</Text>

                <View style={styles.form}>
                  <Controller
                    control={control}
                    name="name"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Full Name</Text>
                        <View style={[styles.inputWrapper, errors.name && styles.inputWrapperError]}>
                          <TextInput
                            style={styles.input}
                            placeholder="Enter your full name"
                            placeholderTextColor="#6b7280"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            returnKeyType="next"
                            onSubmitEditing={() => emailRef.current?.focus()}
                            autoCapitalize="words"
                          />
                        </View>
                        {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
                      </View>
                    )}
                  />

                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email</Text>
                        <View style={[styles.inputWrapper, errors.email && styles.inputWrapperError]}>
                          <TextInput
                            ref={emailRef}
                            style={styles.input}
                            placeholder="you@example.com"
                            placeholderTextColor="#6b7280"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            returnKeyType="next"
                            onSubmitEditing={() => phoneRef.current?.focus()}
                          />
                        </View>
                        {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
                      </View>
                    )}
                  />

                  <Controller
                    control={control}
                    name="phone"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Phone</Text>
                        <View style={[styles.inputWrapper, errors.phone && styles.inputWrapperError]}>
                          <TextInput
                            ref={phoneRef}
                            style={styles.input}
                            placeholder="+14155550123"
                            placeholderTextColor="#6b7280"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            autoCapitalize="none"
                            keyboardType="phone-pad"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordRef.current?.focus()}
                          />
                        </View>
                        {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
                      </View>
                    )}
                  />

                  <Controller
                    control={control}
                    name="verificationChannel"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Verify code via</Text>
                        <View style={styles.channelRow}>
                          {(['email', 'sms'] as const).map((channel) => (
                            <TouchableOpacity
                              key={channel}
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityState={{ selected: value === channel }}
                              onPress={() => onChange(channel)}
                              style={[styles.channelButton, value === channel && styles.channelButtonActive]}
                            >
                              <Text style={[styles.channelText, value === channel && styles.channelTextActive]}>
                                {channel === 'email' ? 'Email' : 'SMS'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  />

                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <View style={[styles.inputWrapper, errors.password && styles.inputWrapperError]}>
                          <TextInput
                            ref={passwordRef}
                            style={[styles.input, styles.passwordInput]}
                            placeholder="Min. 8 characters"
                            placeholderTextColor="#6b7280"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            secureTextEntry={!showPassword}
                            returnKeyType="done"
                            onSubmitEditing={() => { handleSubmit(onSubmit)(); }}
                          />
                          <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword(!showPassword)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                          </TouchableOpacity>
                        </View>
                        {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
                      </View>
                    )}
                  />

                  <PrimaryButton
                    title={loading ? 'Creating Account' : 'Create Account'}
                    loading={loading}
                    disabled={loading}
                    onPress={handleSubmit(onSubmit)}
                    style={styles.button}
                  />
                </View>

                <ScreenEntrance delay={240}>
                  <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <Link href="/(auth)/login" asChild>
                      <TouchableOpacity activeOpacity={0.7}>
                        <Text style={styles.linkText}>Sign In</Text>
                      </TouchableOpacity>
                    </Link>
                  </View>
                </ScreenEntrance>
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
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: 'rgba(13, 16, 22, 0.75)',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderBrand,
    ...glow.card,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
    color: colors.text,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 28,
  },
  form: {
    gap: 18,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    backgroundColor: 'rgba(19, 22, 31, 0.8)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 70,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eyeText: {
    color: colors.brand400,
    fontSize: 14,
    fontWeight: '600',
  },
  channelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  channelButton: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(19, 22, 31, 0.8)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  channelButtonActive: {
    borderColor: colors.brand400,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
  },
  channelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  channelTextActive: {
    color: colors.brand400,
  },
  error: {
    color: colors.error,
    fontSize: 12,
  },
  button: {
    marginTop: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 4,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  linkText: {
    color: colors.brand400,
    fontWeight: '600',
    fontSize: 15,
  },
});
