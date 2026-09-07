import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { computeStreak, nextMilestone, tiersToMilestone } from "@fither/engine";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { Card } from "../../design/primitives/card";
import { FadeIn } from "../../design/primitives/fade-in";
import { Screen } from "../../design/primitives/screen";
import { motion, spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useTodayIso } from "../../lib/use-today";
import { loadLibrary } from "../../session/load-library";
import { MovementFigure } from "../../design/primitives/movement-figure";
import { skillFigureId, skillLabel } from "../../session/skill-name";
import { useProfileStore } from "../../state/profile-store";
import { useSessionStore } from "../../state/session-store";
import { todaySessionState } from "../../state/today-session";
import { useLifetimeOffer } from "../../state/use-lifetime-offer";
import { todayTraining } from "../../state/today-training";
import { useWeekView } from "../../state/week-view";
import { StreakLine } from "./streak-line";
import { WeekTile } from "./week-tile";

// The home hub (ADR-0013 §4, rehung in ADR-0017; the week added by the
// owner brief of 2026-09-07, wave 2): the app's face between sessions.
// One hierarchy — an eyebrow, one display headline and the one green
// action set straight on the page, then two quieter tiles (this week,
// the skill she is climbing toward), each a read of what the stores and
// the engine already carry. The five ladders live on Progress. The hero
// is not a card: the day is the page, the tiles are on it.
//
// Nothing here decides a rule: "done for today" comes from
// state/today-training.ts (one definition, shared), the week from
// state/week-view.ts over the engine's participation, tiers come from
// the engine-written profile, skill names from the engine's
// milestoneMovement via session/skill-name.ts. The four questions live
// one push away at /prompt, exactly as decided (ADR-0003/0006) — this
// screen never asks one of them itself.

export function HomeScreen() {
  const reduceMotion = useReducedMotion();
  // The one lifetime ask (ADR-0014), if it is due — decided by the offer
  // store and the billing port, never here.
  useLifetimeOffer();
  // Reactive across midnight: the hub left open overnight refreshes its
  // date on the next foreground, so yesterday's done state can't linger.
  const today = useTodayIso();

  const profile = useProfileStore((s) => s.profile);
  const historyEntries = useProfileStore((s) => s.history.entries);
  const session = useSessionStore((s) => s.session);
  const player = useSessionStore((s) => s.player);

  const training = todayTraining(historyEntries, today);
  // The run she is on (ADR-0018): the engine's own count, read from the
  // same history the done-state reads. Rendered under every headline but
  // the in-flight one, where the only thing on the page is the way back.
  const streak = computeStreak(historyEntries, today);
  // Begun / built / nothing — one definition (state/today-session.ts),
  // shared with the launch surface's resume boundary. A built-but-
  // unstarted session goes to the preview, never straight to the player.
  const todaySession = todaySessionState(session, player, today);
  const inFlight = todaySession === "inFlight";
  // The week she is in, against the intention she set (or none).
  const week = useWeekView();

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
        <FadeIn
          reduceMotion={reduceMotion}
          rise={motion.riseDistance}
          style={styles.hero}
        >
          <View testID="home-today">
            <AppText variant="caption">{strings.prompt.dayLabel}</AppText>

            {inFlight ? (
              <>
                <AppText
                  variant="display"
                  accessibilityRole="header"
                  style={styles.headline}
                >
                  {strings.resume.headline}
                </AppText>
                <View style={styles.action}>
                  <PrimaryButton
                    testID="home-keep-going"
                    label={strings.resume.continueLabel}
                    onPress={() => router.push("/session")}
                  />
                </View>
              </>
            ) : training.trained ? (
              <>
                <AppText
                  variant="display"
                  accessibilityRole="header"
                  style={styles.headline}
                >
                  {strings.prompt.completedToday.headline}
                </AppText>
                <AppText
                  variant="bodySoft"
                  style={styles.line}
                  testID="home-completed-line"
                >
                  {training.everyBlockCompleted
                    ? strings.prompt.completedToday.line(training.minutes)
                    : strings.prompt.completedToday.lineSome}
                </AppText>
                <StreakLine streak={streak} trainedToday testID="home-streak" />
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
                  variant="display"
                  accessibilityRole="header"
                  style={styles.headline}
                >
                  {strings.home.today.line}
                </AppText>
                <StreakLine
                  streak={streak}
                  trainedToday={false}
                  testID="home-streak"
                />
                <View style={styles.action}>
                  <PrimaryButton
                    testID="home-start"
                    label={strings.home.today.start}
                    // Built today but never started: the session exists, so
                    // the door is the preview (its plan and adaptation line),
                    // not the four questions again and not the player.
                    onPress={() =>
                      router.push(
                        todaySession === "built" ? "/preview" : "/prompt",
                      )
                    }
                  />
                </View>
              </>
            )}
          </View>
        </FadeIn>

        <View style={styles.week}>
          <WeekTile view={week} today={today} order={1} reduceMotion={reduceMotion} />
        </View>

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
                movementId={skillFigureId(
                  library,
                  upcoming.pattern,
                  upcoming.tier,
                )}
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
    // A tab, not a pushed route (ADR-0013 §4): no header to clear, so
    // the eyebrow starts just below the safe area.
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    // The day, set on the page: room above the tiles so the headline and
    // its one action read as the screen, not as a first card.
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  headline: {
    marginTop: spacing.sm,
  },
  line: {
    marginTop: spacing.md,
  },
  action: {
    marginTop: spacing.lg,
  },
  quietAction: {
    marginTop: spacing.lg,
    alignItems: "flex-start",
  },
  week: {
    marginBottom: spacing.xl,
  },
  cardHeading: {
    marginBottom: spacing.md,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  skillName: {
    flex: 1,
    gap: spacing.xs,
  },
});
