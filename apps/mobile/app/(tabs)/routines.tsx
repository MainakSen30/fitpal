import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardList, Layers, Plus } from 'lucide-react-native';
import { AppBackground } from '../../src/components/ui/AppBackground';
import { GradientText } from '../../src/components/ui/GradientText';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { ScreenEntrance } from '../../src/components/ui/ScreenEntrance';
import { colors, radii, spacing } from '../../src/theme/tokens';

const ghostRoutines = [
  { name: 'Push Day', blocks: 'Chest, Shoulders, Triceps' },
  { name: 'Pull Day', blocks: 'Back, Biceps' },
  { name: 'Legs', blocks: 'Quads, Hamstrings, Calves' },
];

export default function RoutinesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenEntrance>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{'ROUTINES'}</Text>
            <GradientText style={styles.title}>Start Faster.</GradientText>
            <Text style={styles.description}>
              Routines let you reuse a plan so every training session is one tap away.
            </Text>
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={120}>
          <EmptyState
            icon={<ClipboardList size={26} color={colors.brand400} strokeWidth={1.8} />}
            title="Build your first routine."
            highlight=""
            description="Group exercises into a reusable template. It will show up here ready to launch."
          />
        </ScreenEntrance>

        <ScreenEntrance delay={200}>
          <Text style={styles.previewLabel}>{'WHAT THEY WILL LOOK LIKE'}</Text>
          <View style={styles.ghostList}>
            {ghostRoutines.map((routine, index) => (
              <View
                key={routine.name}
                style={[styles.ghostCard, index > 0 && styles.ghostStack, { opacity: 1 - index * 0.12 }]}
              >
                <View style={styles.ghostIconWell}>
                  <Layers size={18} color={colors.brand400} strokeWidth={1.8} />
                </View>
                <View style={styles.ghostTextBlock}>
                  <Text style={styles.ghostTitle}>{routine.name}</Text>
                  <Text style={styles.ghostSubtitle}>{routine.blocks}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={280}>
          <GlassCard onPress={() => router.push('/(tabs)/workout')} style={styles.linkCard}>
            <View style={styles.linkInner}>
              <View style={styles.plusWell}>
                <Plus size={18} color={colors.brand400} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.linkTitle}>See the Workout Space</Text>
                <Text style={styles.linkSubtitle}>Where routines become live sessions.</Text>
              </View>
            </View>
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
  previewLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  ghostList: {
    gap: spacing.sm,
  },
  ghostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(13, 16, 22, 0.78)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  ghostStack: {
    marginTop: -spacing.xs,
  },
  ghostIconWell: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostTextBlock: {
    flex: 1,
  },
  ghostTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  ghostSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  linkCard: {
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  linkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  plusWell: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  linkSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  bottomSpacer: {
    height: 120,
  },
});
