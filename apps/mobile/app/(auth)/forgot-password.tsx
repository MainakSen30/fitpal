import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { GradientText } from '../../src/components/ui/GradientText';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { api } from '../../src/lib/api';
import { colors, glow, radii, spacing } from '../../src/theme/tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sentScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const onSubmit = async () => {
    if (!email.includes('@')) {
      Alert.alert('Error', 'Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      if (!reduceMotion) {
        Animated.sequence([
          Animated.spring(sentScale, { toValue: 1.03, useNativeDriver: true, speed: 40, bounciness: 0 }),
          Animated.spring(sentScale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 5 }),
        ]).start();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Back to sign in">
              <ArrowLeft size={20} color={colors.textMuted} strokeWidth={1.8} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.header}>
            <GradientText style={styles.title}>Reset Password.</GradientText>
            <Text style={styles.description}>
              {sent
                ? 'Check your inbox for a reset link and follow the instructions.'
                : 'Enter the email tied to your account and we will send you a reset link.'}
            </Text>
          </View>

          <Animated.View style={[styles.card, { transform: reduceMotion ? [] : [{ scale: sent ? sentScale : 1 }] }]}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color={colors.textFaint} strokeWidth={1.8} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textFaint}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                editable={!sent}
              />
            </View>

            <PrimaryButton
              title={sent ? 'Email Sent' : 'Send Reset Link'}
              loading={loading}
              disabled={sent}
              onPress={onSubmit}
              style={styles.cta}
            />

            {sent && (
              <TouchableOpacity onPress={() => setSent(false)} accessibilityRole="button">
                <Text style={styles.resend}>Wrong email? Edit it</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Remembered it? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: 'rgba(13, 16, 22, 0.75)',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderBrand,
    ...glow.card,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(19, 22, 31, 0.8)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  cta: {
    marginBottom: spacing.lg,
  },
  resend: {
    color: colors.brand400,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
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
