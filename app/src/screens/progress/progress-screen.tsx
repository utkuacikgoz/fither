import { router } from "expo-router";
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
import { useProfileStore } from "../../state/profile-store";
import { NextSkillTile } from "./next-skill-tile";
import { PatternRow } from "./pattern-row";

// Her capability, made visible (owner round 6, ADR-0017; retention wave
// 2): the skill she is climbing toward comes first and names the movement
// she starts from. Her streak is a secondary consistency record, then the
// five patterns form the detailed ledger. Points still exist in session
// receipts and history, but no longer lead this surface while they have
// no understandable use. Section captions sit outside the tile they name.
//
// Everything here is a read of what the stores and the engine already
// carry: the streak from computeStreak over the history the engine
// wrote, tiers from the profile, the next skill from nextMilestone and
// tiersToMilestone, names and figures from the library through
// session/skill-name.ts. No rule, threshold or derived value is computed
// here.

/** Tile entrance order → the delay its contents wait before drawing. */
function tileDelay(order: number): number {
  return order * motion.staggerMs;
}

const ORDER = { skills: 0, streak: 1, patterns: 2 } as const;

/**
 * The soft lines under the streak numeral, each an existing string: the
 * run and her best while a run is alive, or how one begins when none is.
 *
 * The spent rest day used to be a third line here. The owner cut it
 * (2026-09-12, device pass: "rest-day taken is unnecessary"): it told
 * her nothing she could act on, and a third line beside the points
 * tile's one made the pair lopsided. `streak.restDayUsed` is retired,
 * not deleted; nothing renders it.
 */
function streakLines(streak: StreakState): string[] {
  if (streak.current === 0) return [strings.streak.none];
  return [strings.streak.tileCaption(streak.current, streak.best)];
}

/**
 * What VoiceOver says for the streak tile. NOT the visible caption: the
 * tile shows one line beside the numeral, and StatTile speaks only this
 * label and never the numeral itself, so reading the caption aloud would
 * lose the count entirely ("Streak. day streak, best 9"). The spoken
 * reading keeps the full sentences.
 */
function streakSpoken(streak: StreakState): string {
  if (streak.current === 0) return [strings.streak.title, strings.streak.none].join(". ");
  const parts = [strings.streak.title, strings.streak.label(streak.current)];
  if (streak.best > streak.current) parts.push(strings.streak.best(streak.best));
  return parts.join(". ");
}

export function ProgressScreen() {
  const reduceMotion = useReducedMotion();
  // Reactive across midnight, like the hub: a tab left open overnight
  // re-reads the date on the next foreground or focus.
  const today = useTodayIso();
  const profile = useProfileStore((s) => s.profile);
  const historyEntries = useProfileStore((s) => s.history.entries);
  const library = loadLibrary();

  const streak = computeStreak(historyEntries, today);
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

        <View style={styles.section}>
          <SectionCaption label={strings.profile.skills.nextTitle} />
          <NextSkillTile
            library={library}
            upcoming={upcoming}
            tiersAway={tiersAway}
            currentMovement={
              upcoming
                ? skillLabel(
                    library,
                    upcoming.pattern,
                    profile.patterns[upcoming.pattern].tier,
                  )
                : ""
            }
            milestones={milestones}
            order={ORDER.skills}
            reduceMotion={reduceMotion}
            onOpen={(pattern) => router.push(`/ladder?pattern=${pattern}`)}
          />
        </View>

        <View style={styles.section}>
          <SectionCaption label={strings.streak.title} />
          <View style={styles.stats}>
            <StatTile
              value={String(streak.current)}
              lines={streakText}
              tone="accent"
              order={ORDER.streak}
              reduceMotion={reduceMotion}
              accessibilityLabel={streakSpoken(streak)}
              testID="progress-streak"
            />
          </View>
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
                  onPress={() => router.push(`/ladder?pattern=${pattern}`)}
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
