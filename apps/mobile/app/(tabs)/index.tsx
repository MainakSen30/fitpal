import React from 'react';
import { ScrollView, StyleSheet, Text, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Dumbbell, ClipboardList, BookOpen, CalendarClock, Flame } from 'lucide-react-native';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { GradientText } from '../../src/components/ui/GradientText';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { SectionHeader } from '../../src/components/ui/SectionHeader';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { StatCard } from '../../src/components/ui/StatCard';
import { colors, glow, radii, spacing } from '../../src/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();

  const quickActions = [
    {
      icon: <ClipboardList size={22} color={colors.brand400} strokeWidth={1.8} />,
      title: 'My Routines',
      subtitle: 'Start from a saved routine',
      action: () => router.push('/(tabs)/routines'),
    },
    {
      icon: <BookOpen size={22} color={colors.brand400} strokeWidth={1.8} />,
      title: 'Workout History',
      subtitle: 'Review your past sessions',
      action: () => router.push('/(tabs)/logbook'),
    },
    {
      icon: <CalendarClock size={22} color={colors.brand400} strokeWidth={1.8} />,
      title: 'Weekly Progress',
      subtitle: 'See how this week compares',
      action: () => router.push('/(tabs)/logbook'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBackground />
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <ScreenEntrance>
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>Mobile-First Workout Tracker</Text>
              </View>
            </View>
            <Text style={styles.titleLine}>Track Your Workouts.</Text>
            <GradientText style={styles.titleLine}>Own Your Progress.</GradientText>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={90}>
          <View style={styles.ctaRow}>
            <PrimaryButton
              title="Start Workout"
              icon={<Flame size={18} color="#ffffff" strokeWidth={2.2} />}
              onPress={() => router.push('/(tabs)/workout')}
              style={styles.cta}
            />
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={160}>
          <View style={styles.statRow}>
            <StatCard value="0.4s" label="Set Logging" />
            <StatCard value="100%" label="Offline Ready" valueColor={colors.success} />
            <StatCard value="Smart" label="PR Tracking" valueColor={colors.warning} />
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={230}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsList}>
            {quickActions.map((item) => (
              <GlassCard key={item.title} onPress={item.action} style={styles.actionCard}>
                <View style={styles.actionInner}>
                  <View style={styles.iconWell}>{item.icon}</View>
                  <View style={styles.actionTextBlock}>
                    <Text style={styles.actionTitle}>{item.title}</Text>
                    <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Text style={styles.chevron}>{'\u203A'}</Text>
                </View>
              </GlassCard>
            ))}
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={300}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroEyebrowTone}>ACTIVE SESSION</Text>
                <Text style={styles.heroTitle}>Chest & Triceps</Text>
              </View>
              <View style={styles.timerPill}>
                <Text style={styles.timerText}>{'00:00:00'}</Text>
              </View>
            </View>
            <View style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>Barbell Bench Press</Text>
              <Text style={styles.setsMeta}>{'3 sets'}</Text>
            </View>
            <View style={[styles.exerciseRow, styles.exerciseRowLast]}>
              <Text style={styles.exerciseName}>Incline Dumbbell Press</Text>
              <Text style={styles.setsMeta}>{'3 sets'}</Text>
            </View>
            <Text style={styles.heroHint}>Your next session is waiting. Press Start Workout to log it.</Text>
          </View>
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
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand500,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  titleLine: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.text,
    lineHeight: 38,
  },
  ctaRow: {
    marginBottom: spacing.md,
  },
  cta: {
    ...glow.orange,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionsList: {
    gap: spacing.md,
  },
  actionCard: {
    padding: spacing.md,
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radii.sm + 2,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBlock: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  chevron: {
    color: colors.textFaint,
    fontSize: 20,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: 'rgba(13, 16, 22, 0.78)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  heroEyebrowTone: {
    color: colors.brand400,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  timerPill: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  timerText: {
    color: colors.success,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  exerciseRowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  exerciseName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  setsMeta: {
    color: colors.textFaint,
    fontSize: 12,
  },
  heroHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  bottomSpacer: {
    height: 120,
  },
});
