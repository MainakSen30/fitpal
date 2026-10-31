import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, type TextInputInstance } from 'react-native';
import { useState, useRef } from 'react';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../src/lib/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { BrandLogo } from '../../src/components/ui/BrandLogo';
import { GradientText } from '../../src/components/ui/GradientText';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { colors, glow, radii, spacing } from '../../src/theme/tokens';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', data);
      if (response.data.user) {
        await SecureStore.setItemAsync('auth_token', 'session');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
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
                <GradientText style={styles.title}>Welcome Back</GradientText>
                <Text style={styles.description}>Sign in to continue training</Text>

              <View style={styles.form}>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Email</Text>
                      <View style={[styles.inputWrapper, errors.email && styles.inputWrapperError]}>
                        <TextInput
                          style={styles.input}
                          placeholder="you@example.com"
                          placeholderTextColor="#6b7280"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          returnKeyType="next"
                          onSubmitEditing={() => passwordRef.current?.focus()}
                        />
                      </View>
                      {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
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
                          placeholder="Enter your password"
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

                <Link href="/(auth)/forgot-password" asChild>
                  <TouchableOpacity style={styles.forgotContainer} activeOpacity={0.7}>
                    <Text style={styles.forgotPassword}>Forgot Password?</Text>
                  </TouchableOpacity>
                </Link>

                <PrimaryButton
                  title={loading ? 'Signing In' : 'Sign In'}
                  loading={loading}
                  onPress={handleSubmit(onSubmit)}
                  style={styles.button}
                />

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.otpButton} activeOpacity={0.7}>
                  <Text style={styles.otpButtonText}>Sign in with OTP</Text>
                </TouchableOpacity>
              </View>

              <ScreenEntrance delay={240}>
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Don't have an account? </Text>
                  <Link href="/(auth)/signup" asChild>
                    <TouchableOpacity activeOpacity={0.7}>
                      <Text style={styles.linkText}>Sign Up</Text>
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
  error: {
    color: colors.error,
    fontSize: 12,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
  },
  forgotPassword: {
    color: colors.brand400,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    marginTop: 6,
    ...glow.orange,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    color: colors.textFaint,
    marginHorizontal: 16,
    fontSize: 13,
  },
  otpButton: {
    backgroundColor: 'rgba(19, 22, 31, 0.8)',
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  otpButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
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
