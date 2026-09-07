import { StyleSheet, View } from "react-native";
import type { MovementLibrary, SkillMilestone } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { Tile } from "../../design/primitives/tile";
import { useTheme } from "../../design/theme";
import { fontFamily, glyph, hairline, spacing } from "../../design/tokens";
import { skillFigureId, skillLabel } from "../../session/skill-name";

// The skill she is climbing toward (round 6): its figure in the green,
// an eyebrow with how many tiers ahead it sits, the skill's name, and,
// before any skill has landed, the one line saying where skills come
// from. Skills already named are listed beneath, each with its own
// figure, so the tile reads forward first and record second.
//
// Which milestone is next and how far it is are the engine's answers
// (nextMilestone, tiersToMilestone), passed in by the screen; names and
// figures resolve through session/skill-name.ts, the same lookup the
// hub and the unlock moment use.

interface NextSkillTileProps {
  library: MovementLibrary | null;
  /** The engine's nearest unearned milestone; null when all are behind her. */
  upcoming: SkillMilestone | null;
  tiersAway: number;
  /** Skills she has named, in the order they landed. */
  milestones: readonly SkillMilestone[];
  order: number;
  reduceMotion: boolean;
}

export function NextSkillTile({
  library,
  upcoming,
  tiersAway,
  milestones,
  order,
  reduceMotion,
}: NextSkillTileProps) {
  const colors = useTheme();
  const rule = { borderTopWidth: hairline, borderTopColor: colors.line };
  return (
    <Tile order={order} reduceMotion={reduceMotion} testID="progress-skills">
      {upcoming ? (
        <View style={styles.next} testID="progress-next-skill">
          <MovementFigure
            movementId={skillFigureId(library, upcoming.pattern, upcoming.tier)}
            size={spacing.xxxl + spacing.sm}
            tone="accent"
          />
          <View style={styles.nextText}>
            <AppText
              variant="caption"
              color={colors.accent}
              style={styles.eyebrow}
              testID="progress-next-skill-away"
            >
              {strings.home.skills.away(tiersAway)}
            </AppText>
            <AppText variant="bodyLarge">
              {skillLabel(library, upcoming.pattern, upcoming.tier)}
            </AppText>
            {milestones.length === 0 && (
              <AppText variant="bodySoft" style={styles.body} testID="skills-empty">
                {strings.profile.skills.empty}
              </AppText>
            )}
          </View>
        </View>
      ) : (
        <AppText variant="bodySoft" testID="skills-all-reached">
          {strings.home.skills.empty}
        </AppText>
      )}
      {milestones.map((m) => (
        <View
          key={`${m.pattern}-${m.tier}`}
          style={[styles.skillRow, rule]}
          testID={`skill-${m.pattern}-${m.tier}`}
        >
          {/* The movement she earned, drawn — the same figure she met in
              the session (ADR-0013). */}
          <MovementFigure
            movementId={skillFigureId(library, m.pattern, m.tier)}
            size="small"
          />
          <AppText variant="body" style={styles.skillName}>
            {skillLabel(library, m.pattern, m.tier)}
          </AppText>
          {/* The green marks the earned moment and sits on the row it
              marks (mapping). Decorative — the name carries the row. */}
          <AppText
            variant="body"
            color={colors.accent}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {glyph.check}
          </AppText>
        </View>
      ))}
    </Tile>
  );
}

const styles = StyleSheet.create({
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  nextText: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fontFamily.semibold,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  body: {
    marginTop: spacing.xs,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: spacing.xxl + spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  skillName: {
    flex: 1,
  },
});
