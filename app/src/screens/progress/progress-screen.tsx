import { ScrollView, StyleSheet, View } from "react-native";
import { MAX_TIER, PATTERNS, type Pattern, type Tier } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Screen } from "../../design/primitives/screen";
import { useTheme } from "../../design/theme";
import { glyph, radius, spacing } from "../../design/tokens";
import { loadLibrary } from "../../session/load-library";
import { skillLabel } from "../../session/skill-name";
import { totalPoints, useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";

// Her capability, made visible: the five pattern ladders, the named
// skills she has unlocked, and the points ledger's total. Everything here
// is a read of what the stores/engine already carry — tiers from the
// profile, names from the movement library (via the engine's
// milestoneMovement, the same resolution the unlock flow's ApplyResult
// uses), points summed by the ledger module's own totalPoints. No rule,
// threshold or derived value is computed on this screen.

// Skill rows resolve their names through session/skill-name.ts (the
// engine's milestoneMovement) — the same lookup the home hub uses, so
// one skill is never named two ways. Ladder rows use
// strings.profile.patterns.names.

/**
 * A calm six-step track (length from MAX_TIER, never a hardcoded 6):
 * reached steps in accent, the rest in accentSoft. Decorative — the tier
 * line beside it carries the accessible reading. No percentages, no
 * comparison; only her own ladder.
 */
function TierTrack({ pattern, tier }: { pattern: Pattern; tier: Tier }) {
  const colors = useTheme();
  const steps = Array.from({ length: MAX_TIER }, (_, i) => i + 1);
  return (
    <View
      style={styles.track}
      testID={`tier-track-${pattern}`}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {steps.map((step) => (
        <View
          key={step}
          testID={
            step <= tier ? `tier-track-${pattern}-filled-${step}` : undefined
          }
          style={[
            styles.trackStep,
            {
              backgroundColor:
                step <= tier ? colors.accent : colors.accentSoft,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function ProgressScreen() {
  const colors = useTheme();
  const profile = useProfileStore((s) => s.profile);
  const events = useLedgerStore((s) => s.events);
  const library = loadLibrary();

  // Absence tolerated per the engine contract (types.ts): treated as an
  // empty list. Skills are never lost — this list only ever grows.
  const milestones = profile.unlockedMilestones ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={styles.title}>
          {strings.profile.title}
        </AppText>

        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.profile.patterns.title}
          </AppText>
          {PATTERNS.map((pattern) => {
            const state = profile.patterns[pattern];
            return (
              <View
                key={pattern}
                style={styles.patternRow}
                testID={`pattern-${pattern}`}
              >
                <View style={styles.patternLine}>
                  <AppText variant="body" style={styles.patternName}>
                    {strings.profile.patterns.names[pattern]}
                  </AppText>
                  <AppText variant="caption" testID={`pattern-${pattern}-tier`}>
                    {strings.profile.tier(state.tier, MAX_TIER)}
                  </AppText>
                </View>
                <TierTrack pattern={pattern} tier={state.tier} />
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionHeading}>
            {strings.profile.skills.title}
          </AppText>
          {milestones.length === 0 ? (
            <AppText variant="bodySoft" testID="skills-empty">
              {strings.profile.skills.empty}
            </AppText>
          ) : (
            milestones.map((m) => (
              <View
                key={`${m.pattern}-${m.tier}`}
                style={styles.skillRow}
                testID={`skill-${m.pattern}-${m.tier}`}
              >
                {/* Gold marks the earned moment (design system: skill
                    unlocks only). Decorative — the name carries the row. */}
                <AppText
                  variant="body"
                  color={colors.gold}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                >
                  {glyph.check}
                </AppText>
                <AppText variant="body" style={styles.skillName}>
                  {skillLabel(library, m.pattern, m.tier)}
                </AppText>
              </View>
            ))
          )}
        </View>

        <AppText variant="bodySoft" testID="progress-points">
          {strings.profile.points.total(totalPoints(events))}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    // A tab, not a pushed route (ADR-0013 §4): no header to clear, so
    // the title starts just below the safe area and breathes normally.
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    marginBottom: spacing.md,
  },
  patternRow: {
    marginBottom: spacing.md + spacing.xs,
  },
  patternLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  patternName: {
    flexShrink: 1,
    marginRight: spacing.md,
  },
  track: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  trackStep: {
    flex: 1,
    height: spacing.xs,
    borderRadius: radius.pill,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  skillName: {
    flexShrink: 1,
  },
});
