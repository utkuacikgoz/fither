import { ScrollView, StyleSheet, View } from "react-native";
import {
  computeStreak,
  nextMilestone,
  PATTERNS,
  tiersToMilestone,
  type StreakState,
} from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Screen } from "../../design/primitives/screen";
import { SectionCaption } from "../../design/primitives/section-caption";
import { StatTile } from "../../design/primitives/stat-tile";
import { Tile } from "../../design/primitives/tile";
import { motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useTodayIso } from "../../lib/use-today";
import { loadLibrary } from "../../session/load-library";
import { skillFigureId, skillLabel } from "../../session/skill-name";
import { totalPoints, useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { NextSkillTile } from "./next-skill-tile";
import { PatternRow } from "./pattern-row";

// Her capability, made visible (owner round 6, ADR-0017): one hero of two
// numerals — the day streak in the green, the points total in ink — then
// the skill she is climbing toward, then the five patterns as a grouped
// list, each with the figure of the movement she is on now. Section
// captions sit OUTSIDE the tile they name (ledger, round 5).
//
// Everything here is a read of what the stores and the engine already
// carry: the streak from computeStreak over the history the engine
// wrote, tiers from the profile, the next skill from nextMilestone and
// tiersToMilestone, names and figures from the library through
// session/skill-name.ts, points summed by the ledger module's own
// totalPoints. No rule, threshold or derived value is computed here.

/** Tile entrance order → the delay its contents wait before drawing. */
function tileDelay(order: number): number {
  return order * motion.staggerMs;
}

const ORDER = { streak: 0, points: 1, skills: 2, patterns: 3 } as const;

/**
 * The soft lines under the streak numeral, each an existing string: the
 * run and her best while a run is alive (plus the spent rest day when
 * it is), or how one begins when none is.
 */
function streakLines(streak: StreakState): string[] {
  if (streak.current === 0) return [strings.streak.none];
  const lines = [strings.streak.label(streak.current), strings.streak.best(streak.best)];
  if (streak.graceUsed) lines.push(strings.streak.restDayUsed);
  return lines;
}

export function ProgressScreen() {
  const reduceMotion = useReducedMotion();
  // Reactive across midnight, like the hub: a tab left open overnight
  // re-reads the date on the next foreground or focus.
  const today = useTodayIso();
  const profile = useProfileStore((s) => s.profile);
  const historyEntries = useProfileStore((s) => s.history.entries);
  const events = useLedgerStore((s) => s.events);
  const library = loadLibrary();

  const streak = computeStreak(historyEntries, today);
  const points = totalPoints(events);
  // Absence tolerated per the engine contract (types.ts): treated as an
  // empty list. Skills are never lost — this list only ever grows.
  const milestones = profile.unlockedMilestones ?? [];
  const upcoming = nextMilestone(profile);
  const tiersAway = upcoming ? tiersToMilestone(profile, upcoming) : 0;
  const streakText = streakLines(streak);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        // Signifiers: the owner could not tell a tab scrolled. Shown on
        // every hub surface; only the session player stays clean.
        showsVerticalScrollIndicator
      >
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {strings.profile.title}
        </AppText>

        <View style={styles.stats}>
          <StatTile
            value={String(streak.current)}
            lines={streakText}
            tone="accent"
            order={ORDER.streak}
            reduceMotion={reduceMotion}
            accessibilityLabel={[strings.streak.title, ...streakText].join(". ")}
            testID="progress-streak"
          />
          {/* Points are a record of work done, never a balance
              (gamification.md): the bare unit beneath the numeral, the
              full sentence as the spoken reading. */}
          <StatTile
            value={String(points)}
            lines={[strings.finish.pointsUnit(points)]}
            order={ORDER.points}
            reduceMotion={reduceMotion}
            accessibilityLabel={strings.profile.points.total(points)}
            testID="progress-points"
          />
        </View>

        <View style={styles.section}>
          <SectionCaption label={strings.profile.skills.nextTitle} />
          <NextSkillTile
            library={library}
            upcoming={upcoming}
            tiersAway={tiersAway}
            milestones={milestones}
            order={ORDER.skills}
            reduceMotion={reduceMotion}
          />
        </View>

        <View style={styles.section}>
          <SectionCaption label={strings.profile.patterns.title} />
          <Tile
            inset="list"
            order={ORDER.patterns}
            reduceMotion={reduceMotion}
            testID="progress-patterns"
          >
            {PATTERNS.map((pattern, index) => {
              const tier = profile.patterns[pattern].tier;
              return (
                <PatternRow
                  key={pattern}
                  pattern={pattern}
                  tier={tier}
                  movementId={skillFigureId(library, pattern, tier)}
                  movementName={skillLabel(library, pattern, tier)}
                  first={index === 0}
                  reduceMotion={reduceMotion}
                  baseDelayMs={tileDelay(ORDER.patterns)}
                />
              );
            })}
          </Tile>
        </View>
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
    marginTop: spacing.sm + spacing.xs,
    marginBottom: spacing.md + spacing.xs,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.sm + spacing.xs,
  },
  section: {
    marginTop: spacing.xl,
  },
});
