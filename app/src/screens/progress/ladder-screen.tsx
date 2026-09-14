import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  MAX_TIER,
  PATTERNS,
  SKILL_MILESTONE_TIERS,
  nextMilestone,
  tiersToMilestone,
  type Pattern,
  type Tier,
} from "@fither/engine";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { Screen } from "../../design/primitives/screen";
import { SectionCaption } from "../../design/primitives/section-caption";
import { Tile } from "../../design/primitives/tile";
import { useTheme } from "../../design/theme";
import { fontFamily, glyph, hairline, radius, spacing, trackingWide } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { loadLibrary } from "../../session/load-library";
import { skillFigureId, skillLabel } from "../../session/skill-name";
import { useProfileStore } from "../../state/profile-store";

// One ladder, all six rungs (owner decision 2026-09-14, design A2): the
// answer to the tap a pattern row and the next-skill tile now take.
// Above, the movement she is on, drawn in the green with the pattern
// and the tier line over it and, while a milestone is ahead on this
// ladder, how far. Below, the rungs in order: the ones behind her in
// the ink with a check, hers in the green and marked Now, the ones
// ahead in the soft ink with their number, and a milestone rung marked
// Skill. Every name and figure resolves through session/skill-name.ts,
// the same lookup Progress, Home and the unlock moment use; which
// tiers are milestones is the engine's list, never a number typed here.

/** The route's `pattern` when it names a ladder; otherwise the first. */
export function parseLadderPattern(value: string | string[] | undefined): Pattern {
  const single = Array.isArray(value) ? value[0] : value;
  return (PATTERNS as readonly string[]).includes(single ?? "") ? (single as Pattern) : PATTERNS[0]!;
}

interface LadderScreenProps {
  pattern: Pattern;
}

const TIERS: readonly Tier[] = Array.from({ length: MAX_TIER }, (_, i) => (i + 1) as Tier);

export function LadderScreen({ pattern }: LadderScreenProps) {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  const profile = useProfileStore((s) => s.profile);
  const library = loadLibrary();
  const tier = profile.patterns[pattern].tier;
  const upcoming = nextMilestone(profile);
  const onThisLadder = upcoming !== null && upcoming.pattern === pattern ? upcoming : null;
  const tiersAway = onThisLadder ? tiersToMilestone(profile, onThisLadder) : 0;
  const patternName = strings.profile.patterns.names[pattern];

  useEffect(() => {
    track("ladder_view", { pattern });
  }, [pattern]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        <View style={styles.hero} testID="ladder-hero">
          <MovementFigure
            movementId={skillFigureId(library, pattern, tier)}
            size={spacing.xxxl + spacing.lg}
            tone="accent"
          />
          <View style={styles.heroText}>
            <AppText variant="caption" color={colors.accent} style={styles.eyebrow}>
              {strings.profile.ladder.header(patternName, strings.profile.tier(tier, MAX_TIER))}
            </AppText>
            <AppText variant="title" accessibilityRole="header" testID="ladder-current">
              {skillLabel(library, pattern, tier)}
            </AppText>
            {onThisLadder && (
              <AppText variant="bodySoft" style={styles.toSkill} testID="ladder-to-skill">
                {strings.profile.ladder.toSkill(
                  skillLabel(library, onThisLadder.pattern, onThisLadder.tier),
                  tiersAway,
                )}
              </AppText>
            )}
          </View>
        </View>

        <SectionCaption label={strings.profile.ladder.caption} />
        <Tile inset="list" order={0} reduceMotion={reduceMotion} testID="ladder-rungs">
          {TIERS.map((rung, index) => {
            const state = rung < tier ? "done" : rung === tier ? "now" : "ahead";
            const milestone = SKILL_MILESTONE_TIERS.includes(rung);
            const name = skillLabel(library, pattern, rung);
            const spoken = [
              strings.profile.tier(rung, MAX_TIER),
              name,
              state === "now" ? strings.profile.ladder.now : null,
              milestone ? strings.profile.ladder.skill : null,
            ].filter((part): part is string => part !== null);
            return (
              <View
                key={rung}
                style={[
                  styles.rung,
                  index > 0 && { borderTopWidth: hairline, borderTopColor: colors.line },
                  milestone && [styles.milestone, { borderColor: colors.line }],
                ]}
                accessible
                accessibilityLabel={spoken.join(". ")}
                testID={`ladder-rung-${rung}`}
              >
                <MovementFigure
                  movementId={skillFigureId(library, pattern, rung)}
                  size="small"
                  tone={state === "now" ? "accent" : state === "done" ? "ink" : "soft"}
                />
                <View style={styles.rungText}>
                  {milestone && (
                    <AppText variant="caption" color={colors.accent} style={styles.skillEyebrow}>
                      {strings.profile.ladder.skill}
                    </AppText>
                  )}
                  <AppText
                    variant="body"
                    color={state === "ahead" ? colors.inkSoft : colors.ink}
                    style={state === "ahead" ? undefined : styles.rungNameHeld}
                    testID={`ladder-rung-${rung}-name`}
                  >
                    {name}
                  </AppText>
                </View>
                {state === "done" && (
                  <AppText variant="body" color={colors.accent} testID={`ladder-rung-${rung}-done`}>
                    {glyph.check}
                  </AppText>
                )}
                {state === "now" && (
                  <AppText
                    variant="caption"
                    color={colors.accent}
                    style={styles.now}
                    testID="ladder-now"
                  >
                    {strings.profile.ladder.now}
                  </AppText>
                )}
                {state === "ahead" && (
                  <AppText variant="body" color={colors.inkSoft} style={styles.numeral}>
                    {String(rung)}
                  </AppText>
                )}
              </View>
            );
          })}
        </Tile>
        <AppText variant="bodySoft" style={styles.rule} testID="ladder-rule">
          {strings.profile.skills.empty}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  hero: {
    // Clears the transparent back header, like every pushed page.
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + spacing.xs,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fontFamily.semibold,
    textTransform: "uppercase",
    letterSpacing: trackingWide / 2,
    marginBottom: spacing.xs,
  },
  toSkill: {
    marginTop: spacing.xs,
  },
  rung: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: spacing.xxxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + spacing.xs,
  },
  milestone: {
    borderWidth: hairline,
    borderRadius: radius.card,
  },
  rungText: {
    flex: 1,
    minWidth: 0,
  },
  skillEyebrow: {
    fontFamily: fontFamily.semibold,
    textTransform: "uppercase",
    letterSpacing: trackingWide / 2,
    marginBottom: spacing.xs / 2,
  },
  rungNameHeld: {
    fontFamily: fontFamily.semibold,
  },
  now: {
    fontFamily: fontFamily.semibold,
    textTransform: "uppercase",
    letterSpacing: trackingWide / 2,
  },
  numeral: {
    fontFamily: fontFamily.semibold,
    minWidth: spacing.lg,
    textAlign: "right",
  },
  rule: {
    marginTop: spacing.md + spacing.xs,
  },
});
