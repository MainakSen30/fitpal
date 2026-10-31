import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { KeyRound, LogOut, UserRound, Smartphone } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { BrandLogo } from '../../src/components/ui/BrandLogo';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { colors, radii, spacing } from '../../src/theme/tokens';

export default function ProfileScreen() {
  const handleLogout = async () => {
    Alert.alert('Sign Out', 'End this session on your device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('auth_token');
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenEntrance>
          <View style={styles.header}>
            <BrandLogo size={34} />
            <Text style={styles.headerCaption}>{'Track. Log. Progress.'}</Text>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={100}>
          <GlassCard accent style={styles.accountCard}>
            <View style={styles.avatar}>
              <UserRound size={30} color={colors.brand400} strokeWidth={1.6} />
            </View>
            <View style={styles.accountTextBlock}>
              <Text style={styles.accountName}>FitPal Member</Text>
              <Text style={styles.accountStatus}>Signed in on this device</Text>
            </View>
          </GlassCard>
        </ScreenEntrance>

        <ScreenEntrance delay={180}>
          <Text style={styles.sectionLabel}>{'ACCOUNT'}</Text>
          <View style={styles.rows}>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity accessibilityRole="button">
                <GlassCard style={styles.rowCard}>
                  <View style={styles.rowInner}>
                    <View style={styles.rowIconWell}>
                      <KeyRound size={17} color={colors.brand400} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.rowTitle}>Reset Password</Text>
                    <Text style={styles.rowChevron}>{'\u203A'}</Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </Link>
            <GlassCard style={styles.rowCard}>
              <View style={styles.rowInner}>
                <View style={styles.rowIconWell}>
                  <Smartphone size={17} color={colors.brand400} strokeWidth={1.8} />
                </View>
                <Text style={styles.rowTitle}>Offline Ready</Text>
                <Text style={styles.rowChevron}>{'100%'}</Text>
              </View>
            </GlassCard>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={260}>
          <Text style={styles.sectionLabel}>{'SESSION'}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={styles.signOutButton}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <LogOut size={18} color={colors.error} strokeWidth={1.8} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScreenEntrance>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
  },
  headerCaption: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  accountCard: {
    padding: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextBlock: {
    marginTop: spacing.md,
  },
  accountName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  accountStatus: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  rows: {
    gap: spacing.md,
  },
  rowCard: {
    padding: spacing.md,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIconWell: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowChevron: {
    color: colors.textFaint,
    fontSize: 18,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  signOutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 120,
  },
});
