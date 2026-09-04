import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { milestoneMovement, nextMilestone, tiersToMilestone } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Card } from "../../design/primitives/card";
import { Screen } from "../../design/primitives/screen";
import { useTheme } from "../../design/theme";
import { glyph, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useTodayIso } from "../../lib/use-today";
import { isFinished } from "../../session/player-machine";
import { loadLibrary } from "../../session/load-library";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { skillLabel } from "../../session/skill-name";
import { useProfileStore } from "../../state/profile-store";
import { useSessionStore } from "../../state/session-store";
import { todayTraining } from "../../state/today-training";
import { PatternGlance, patternGlanceLabel } from "./pattern-glance";

// The home hub (ADR-0013 §4): the app's face between sessions. Three
// cards, in priority order — today, the five ladders, the skills she has
// named — each a read of what the stores and the engine already carry.
// The day's card is the only primary action on the screen.
//
// Nothing here decides a rule: "done for today" comes from
// state/today-training.ts (one definition, shared), tiers come from the
// engine-written profile, skill names from the engine's milestoneMovement
// via session/skill-name.ts. The four questions live one push away at
// /prompt, exactly as decided (ADR-0003/0006) — this screen never asks
// one of them itself.

export function HomeScreen() {
  const colors = useTheme();
  const reduceMotion = useReducedMotion();
  // Reactive across midnight: the hub left open overnight refreshes its
  // date on the next foreground, so yesterday's done state can't linger.
  const today = useTodayIso();

  const profile = useProfileStore((s) => s.profile);
  const historyEntries = useProfileStore((s) => s.history.entries);
  const session = useSessionStore((s) => s.session);
  const player = useSessionStore((s) => s.player);

  const training = todayTraining(historyEntries, today);
  // A session is in flight when one exists and its player has not
  // finished — read from the player machine's own predicate, never
  // re-derived from phases here.
  const inFlight = session !== null && player !== null && !isFinished(player);

  const library = loadLibrary();
  // What she is working toward — the engine decides which milestone is
  // nearest and how a legacy profile is treated (nextMilestone); this
  // screen only renders the answer. Forward-looking on purpose: the last
  // skill earned is already celebrated on the unlock screen and listed
  // in Progress; home points at what is coming.
  const upcoming = nextMilestone(profile);
  const tiersAway = upcoming ? tiersToMilestone(profile, upcoming) : 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card
          tone="hero"
          order={0}
          reduceMotion={reduceMotion}
          testID="home-today"
        >
          <AppText variant="caption">{strings.prompt.dayLabel}</AppText>

          {inFlight ? (
            <>
              <AppText
                variant="title"
                accessibilityRole="header"
                style={styles.cardTitle}
              >
                {strings.resume.headline}
              </AppText>
              <PrimaryButton
                testID="home-keep-going"
                label={strings.resume.continueLabel}
                onPress={() => router.push("/session")}
              />
            </>
          ) : training.trained ? (
            <>
              <AppText
                variant="title"
                accessibilityRole="header"
                style={styles.cardTitleTight}
              >
                {strings.prompt.completedToday.headline}
              </AppText>
              <AppText
                variant="bodySoft"
                style={styles.cardLine}
                testID="home-completed-line"
              >
                {training.everyBlockCompleted
                  ? strings.prompt.completedToday.line(training.minutes)
                  : strings.prompt.completedToday.lineSome}
              </AppText>
              {/* Training again is HER choice — quiet, no urgency, no
                  reward framing. Nothing pushes her. */}
              <View style={styles.quietAction}>
                <QuietButton
                  testID="home-another-session"
                  outlined
                  label={strings.prompt.completedToday.action}
                  onPress={() => router.push("/prompt")}
                />
              </View>
            </>
          ) : (
            <>
              <AppText
                variant="title"
                accessibilityRole="header"
                style={styles.cardTitle}
              >
                {strings.home.today.line}
              </AppText>
              <PrimaryButton
                testID="home-start"
                label={strings.home.today.start}
                onPress={() => router.push("/prompt")}
              />
            </>
          )}
        </Card>

        <Card
          order={1}
          reduceMotion={reduceMotion}
          testID="home-patterns"
          accessibilityLabel={patternGlanceLabel(profile)}
          onPress={() => router.push("/progress")}
        >
          <AppText variant="caption" style={styles.cardHeading}>
            {strings.profile.patterns.title}
          </AppText>
          <PatternGlance profile={profile} />
        </Card>

        <Card
          order={2}
          reduceMotion={reduceMotion}
          testID="home-skills"
          onPress={() => router.push("/progress")}
        >
          <AppText variant="caption" style={styles.cardHeading}>
            {strings.profile.skills.title}
          </AppText>
          {upcoming ? (
            <View style={styles.skillRow} testID="home-next-skill">
              {/* The movement she is climbing toward, drawn — the same
                  figure she will meet in the session (ADR-0013). */}
              <MovementFigure
                movementId={
                  (library &&
                    milestoneMovement(library, upcoming.pattern, upcoming.tier)
                      ?.id) ||
                  ""
                }
              />
              <View style={styles.skillName}>
                <AppText variant="body">
                  {skillLabel(library, upcoming.pattern, upcoming.tier)}
                </AppText>
                <AppText variant="caption">
                  {strings.home.skills.away(tiersAway)}
                </AppText>
              </View>
            </View>
          ) : (
            <AppText variant="bodySoft" testID="home-skills-empty">
              {/* The glance's own one-liner (strings.home.skills.empty),
                  not the progress screen's fuller explanation. */}
              {strings.home.skills.empty}
            </AppText>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  cardTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  cardTitleTight: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardLine: {
    marginBottom: spacing.lg,
  },
  cardHeading: {
    marginBottom: spacing.md,
  },
  quietAction: {
    alignItems: "flex-start",
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  skillName: {
    flexShrink: 1,
  },
});
