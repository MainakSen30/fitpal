import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, Trophy, Dumbbell } from 'lucide-react-native';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { GradientText } from '../../src/components/ui/GradientText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { StatCard } from '../../src/components/ui/StatCard';
import { colors, radii, spacing } from '../../src/theme/tokens';

export default function LogbookScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenEntrance>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{'LOGBOOK'}</Text>
            <GradientText style={styles.title}>Every Rep, Recorded.</GradientText>
            <Text style={styles.description}>
              Look back at previous workouts and keep track of your personal records.
            </Text>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={100}>
          <View style={styles.statRow}>
            <StatCard value="12.4M+" label="Sets Logged Product Wide" />
            <StatCard value="Free" label="No Ads" valueColor={colors.success} />
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={180}>
          <EmptyState
            icon={<BookOpen size={26} color={colors.brand400} strokeWidth={1.8} />}
            title="Your history starts here."
            description="Finish your first session and it will appear in this log, with PRs highlighted automatically."
          />
        </ScreenEntrance>

        <ScreenEntrance delay={240}>
          <Text style={styles.previewLabel}>{'WHAT EACH ENTRY SHOWS'}</Text>
          <View style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryIconWell}>
                <Dumbbell size={16} color={colors.brand400} strokeWidth={1.8} />
              </View>
              <View style={styles.entryTitleBlock}>
                <Text style={styles.entryTitle}>Session Entry</Text>
                <Text style={styles.entryMeta}>{'Date, duration, volume'}</Text>
              </View>
              <View style={styles.prPill}>
                <Trophy size={11} color={colors.warning} strokeWidth={2} />
                <Text style={styles.prText}>{'PR READY'}</Text>
              </View>
            </View>
            <View style={styles.entryRow}>
              <Text style={styles.entryExercise}>{'Barbell Bench Press'}</Text>
              <Text style={styles.entryDetail}>{'225 \u00D7 5'}</Text>
            </View>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={300}>
          <GlassCard onPress={() => router.push('/(tabs)/workout')} style={styles.linkCard}>
            <Text style={styles.linkTitle}>Start Logging</Text>
            <Text style={styles.linkSubtitle}>Jump into the workout space to begin your log.</Text>
          </GlassCard>
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
  eyebrow: {
    color: colors.brand400,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
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
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  previewLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  entryCard: {
    backgroundColor: 'rgba(13, 16, 22, 0.78)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  entryIconWell: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitleBlock: {
    flex: 1,
  },
  entryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  entryMeta: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  prPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  prText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  entryExercise: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  entryDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  linkCard: {
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  linkTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  linkSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  bottomSpacer: {
    height: 120,
  },
});
