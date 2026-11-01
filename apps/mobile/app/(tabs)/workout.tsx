import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Dumbbell, CircleCheck, Timer } from 'lucide-react-native';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { GradientText } from '../../src/components/ui/GradientText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { StatCard } from '../../src/components/ui/StatCard';
import { colors, radii, spacing } from '../../src/theme/tokens';

type SetRow = { weight: string; reps: string; done: boolean };

const previewExercise = {
  name: 'Barbell Bench Press',
  sets: [
    { weight: '135', reps: '8', done: true },
    { weight: '155', reps: '6', done: true },
    { weight: '175', reps: '4', done: false },
  ] as SetRow[],
};

export default function WorkoutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenEntrance>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{'WORKOUT'}</Text>
            <GradientText style={styles.title}>Log Every Set.</GradientText>
            <Text style={styles.description}>
              No active session. Start one to begin logging exercises, sets, reps, and weight.
            </Text>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={100}>
          <View style={styles.statRow}>
            <StatCard value="0" label="Exercises" />
            <StatCard value="0" label="Sets" valueColor={colors.textSecondary} />
            <StatCard value="0 min" label="Duration" valueColor={colors.textSecondary} />
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={180}>
          <View style={styles.loggingPreview}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleBlock}>
                <Text style={styles.previewEyebrow}>{'SESSION PREVIEW'}</Text>
                <Text style={styles.previewTitle}>{previewExercise.name}</Text>
              </View>
              <View style={styles.timerPill}>
                <Timer size={12} color={colors.textFaint} strokeWidth={2} />
                <Text style={styles.timerText}>{'--:--'}</Text>
              </View>
            </View>

            {previewExercise.sets.map((set, index) => (
              <View key={index} style={styles.setRow}>
                <Text style={styles.setIndex}>{index + 1}</Text>
                <Text style={styles.setDetail}>
                  {set.weight} {'lbs'} {'\u00D7'} {set.reps}
                </Text>
                <View style={[styles.setCircle, set.done ? styles.setDone : styles.setPending]}>
                  {set.done && <CircleCheck size={14} color={colors.bg} strokeWidth={2.4} />}
                </View>
              </View>
            ))}

            <View style={styles.previewFooter}>
              <View style={styles.footerIconWell}>
                <Dumbbell size={16} color={colors.brand400} strokeWidth={1.8} />
              </View>
              <Text style={styles.previewHint}>
                This is how your working sets will look once a session is running.
              </Text>
            </View>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={260}>
          <EmptyState
            icon={<Dumbbell size={26} color={colors.brand400} strokeWidth={1.8} />}
            title="Own the next hour."
            description="Start a session from Home or a saved routine, then keep it running while you train."
          />
          <GlassCard
            onPress={() => router.push('/(tabs)/routines')}
            style={styles.linkCard}
          >
            <Text style={styles.linkCardTitle}>Browse Routines</Text>
            <Text style={styles.linkCardSubtitle}>Warm up your plan before you touch a barbell.</Text>
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
    marginBottom: spacing.lg,
  },
  loggingPreview: {
    backgroundColor: 'rgba(13, 16, 22, 0.78)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  previewTitleBlock: {
    flex: 1,
  },
  previewEyebrow: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerText: {
    color: colors.textFaint,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  setIndex: {
    color: colors.textFaint,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    width: 16,
  },
  setDetail: {
    color: colors.text,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  setCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDone: {
    backgroundColor: colors.success,
  },
  setPending: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  footerIconWell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHint: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  linkCard: {
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  linkCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  linkCardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  bottomSpacer: {
    height: 120,
  },
});
