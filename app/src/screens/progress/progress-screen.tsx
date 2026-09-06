import { ScrollView, StyleSheet, View } from "react-native";
import { MAX_TIER, PATTERNS } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Card } from "../../design/primitives/card";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { Screen } from "../../design/primitives/screen";
import { useTheme } from "../../design/theme";
import { glyph, motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { loadLibrary } from "../../session/load-library";
import { skillFigureId, skillLabel } from "../../session/skill-name";
import { totalPoints, useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { TierTrack } from "./tier-track";

// Her capability, made visible (ADR-0013 gives it the same card language
// as the hub): the five pattern ladders drawing themselves in, the named
// skills she has unlocked with the figure of each movement beside it, and
// the points ledger's total set on the numeral scale.
//
// Everything here is a read of what the stores/engine already carry —
// tiers from the profile, names and ids from the movement library (via
// the engine's milestoneMovement, the same resolution the unlock flow's
// ApplyResult uses), points summed by the ledger module's own
// totalPoints. No rule, threshold or derived value is computed on this
// screen.
//
// Skill rows resolve their names through session/skill-name.ts (the
// engine's milestoneMovement) — the same lookup the home hub uses, so
// one skill is never named two ways. Ladder rows use
// strings.profile.patterns.names.

/** Card entrance delay, so a card's contents animate after it lands. */
function cardDelay(order: number): number {
  return order * motion.staggerMs;
}

export function ProgressScreen() {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const profile = useProfileStore((s) => s.profile);
  const events = useLedgerStore((s) => s.events);
  const library = loadLibrary();

  // Absence tolerated per the engine contract (types.ts): treated as an
  // empty list. Skills are never lost — this list only ever grows.
  const milestones = profile.unlockedMilestones ?? [];
  const points = totalPoints(events);


  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        // Signifiers: the owner could not tell a tab scrolled. Shown on
        // every hub surface; only the session player stays clean.
        showsVerticalScrollIndicator
      >
        <AppText
          variant="title"
          style={styles.title}
          accessibilityRole="header"
        >
          {strings.profile.title}
        </AppText>

        <Card order={0} reduceMotion={reduceMotion} testID="progress-patterns">
          <AppText variant="caption" style={styles.cardHeading}>
            {strings.profile.patterns.title}
          </AppText>
          {PATTERNS.map((pattern, index) => {
            const state = profile.patterns[pattern];
            return (
              <View
                key={pattern}
                // The last row sits flush with the card's own padding —
                // a trailing margin reads as a lopsided card.
                style={
                  index === PATTERNS.length - 1 ? undefined : styles.patternRow
                }
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
                <TierTrack
                  pattern={pattern}
                  tier={state.tier}
                  reduceMotion={reduceMotion}
                  baseDelayMs={cardDelay(0)}
                />
              </View>
            );
          })}
        </Card>

        <Card order={1} reduceMotion={reduceMotion} testID="progress-skills">
          <AppText variant="caption" style={styles.cardHeading}>
            {strings.profile.skills.title}
          </AppText>
          {milestones.length === 0 ? (
            <AppText variant="bodySoft" testID="skills-empty">
              {strings.profile.skills.empty}
            </AppText>
          ) : (
            milestones.map((m, index) => (
              <View
                key={`${m.pattern}-${m.tier}`}
                style={[
                  styles.skillRow,
                  index === milestones.length - 1 && styles.skillRowLast,
                ]}
                testID={`skill-${m.pattern}-${m.tier}`}
              >
                {/* The movement she earned, drawn — the same figure she
                    meets in the session (ADR-0013). */}
                <MovementFigure movementId={skillFigureId(library, m.pattern, m.tier)} />
                <AppText variant="body" style={styles.skillName}>
                  {skillLabel(library, m.pattern, m.tier)}
                </AppText>
                {/* Gold marks the earned moment (design system: skill
                    unlocks only), and sits on the row it marks
                    (mapping). Decorative — the name carries the row. */}
                <AppText
                  variant="body"
                  color={colors.accent}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                >
                  {glyph.check}
                </AppText>
              </View>
            ))
          )}
        </Card>

        {/* Points are a record of work done, never a balance
            (gamification.md) — so they close the screen rather than open
            it, and the card stays a plain surface: the sage wash belongs
            to the day's action on the hub, not to a score. The numeral
            is the finish screen's own treatment, so one number is set one
            way everywhere. */}
        <Card order={2} reduceMotion={reduceMotion} testID="progress-points">
          <View
            style={styles.points}
            accessible
            accessibilityLabel={strings.profile.points.total(points)}
            testID="progress-points-total"
          >
            <AppText variant="numeral">{String(points)}</AppText>
            <AppText variant="caption">
              {strings.finish.pointsUnit(points)}
            </AppText>
          </View>
        </Card>
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
    marginBottom: spacing.lg,
  },
  cardHeading: {
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
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  skillRowLast: {
    marginBottom: 0,
  },
  skillName: {
    flex: 1,
  },
  points: {
    alignItems: "center",
    gap: spacing.xs,
  },
});
