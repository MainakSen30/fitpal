import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useRef } from 'react';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as SecureStore from 'expo-secure-store';
import { api } from '../../src/lib/api';
import { SafeAreaView } from 'react-native-safe-area-context';

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const { control, handleSubmit, formState: { errors }, setFocus } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', data);
      if (response.data.user) {
        await SecureStore.setItemAsync('auth_token', 'session');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                  <Text style={styles.logoIconText}>🔥</Text>
                </View>
                <Text style={styles.logoText}>
                  Fit<Text style={styles.logoAccent}>Pal</Text>
                </Text>
              </View>
              <Text style={styles.subtitle}>Track Your Workouts. Own Your Progress.</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.title}>Create Account</Text>
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
                          placeholder="Min. 8 characters"
                          placeholderTextColor="#6b7280"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          secureTextEntry={!showPassword}
                          returnKeyType="done"
                          onSubmitEditing={handleSubmit(onSubmit)}
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

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSubmit(onSubmit)}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.linkText}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060709',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#060709',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  logoIconText: {
    fontSize: 22,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: '#f97316',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: 'rgba(13, 16, 22, 0.7)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  description: {
    color: '#9ca3af',
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
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    backgroundColor: 'rgba(19, 22, 31, 0.8)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  inputWrapperError: {
    borderColor: '#ef4444',
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
    color: '#f97316',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
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
    color: '#9ca3af',
    fontSize: 15,
  },
  linkText: {
    color: '#f97316',
    fontWeight: '600',
    fontSize: 15,
  },
});
