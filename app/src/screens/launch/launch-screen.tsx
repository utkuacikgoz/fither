import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { Screen } from "../../design/primitives/screen";
import { todayIso } from "../../lib/dates";
import { firstMovementTracker } from "../../lib/first-movement-timer";
import { useStoreHydration } from "../../lib/route-guard";
import { entitlementStatus, isEntitled } from "../../monetization/entitlement";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useProfileStore } from "../../state/profile-store";
import { useIdentityStore } from "../../state/identity-store";
import {
  useSessionStore,
  type RestoreActiveSessionResult,
} from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import { OnboardingScreen } from "../onboarding/onboarding-screen";
import { SignInScreen } from "../sign-in/sign-in-screen";
import { GatedDailySurface } from "./gated-daily-surface";
import { ResumeOffer } from "./resume-offer";

// The app's entry surface. Once every persisted store has hydrated, the
// session store decides what a crash-persisted session means for this
// launch: a same-day in-progress session earns the one calm resume
// decision, a finished-but-unsaved one goes straight to the finish
// screen's retrying save path. The resume decision wins over EVERYTHING —
// an already-generated session is never interrupted by sign-in,
// onboarding or the paywall. After it, in order: no identity yet gets
// the one sign-in screen (ADR-0011 — guest is one tap, Gate 3's only
// extra cost); first-ever open (no history, onboarding
// never completed) gets the three onboarding screens; an expired,
// unpurchased trial gets the gated day — the paywall letter where the
// prompt's questions would be, Progress and Settings doors intact
// (ADR-0009 §3 — her history, points and skills stay hers regardless);
// everyone else lands on the home hub with no comment (ADR-0013 §4 —
// the destination changed, the order did not).
//
// This surface renders the gates and hands off; it never renders the
// hub or the four questions itself. That keeps "/" free of the tab bar
// (sign-in and onboarding are full-screen moments) while the hub lives
// inside the tab group at /home.

/** The gating order as one value; "home"/"promptHandoff" are handoffs. */
type LaunchStage =
  | "waiting"
  | "resume"
  | "signIn"
  | "onboarding"
  | "gated"
  | "promptHandoff"
  | "home";

interface LaunchScreenProps {
  /** Every gate passed — the hub owns the day from here. */
  onHome: () => void;
  /**
   * Onboarding just finished: go straight to the four questions with the
   * handoff eyebrow (ADR-0009 §1), skipping the hub's extra tap on the
   * one run where Gate 3 is measured.
   */
  onPromptHandoff: () => void;
  /** She chose to keep going — back into the player where she stopped. */
  onResumeSession: () => void;
  /** The session is done (or she called it done) — apply it on finish. */
  onResumeFinished: () => void;
}

export function LaunchScreen({
  onHome,
  onPromptHandoff,
  onResumeSession,
  onResumeFinished,
}: LaunchScreenProps) {
  // The persisted-store hydration set — the six stores every gate here
  // reads, and the same set the route guard waits on. One definition,
  // shared, so a store added to the set can never be forgotten here.
  const { hydrated, failed: hydrationFailed } = useStoreHydration();
  const identity = useIdentityStore((s) => s.identity);
  const restoreActiveSession = useSessionStore((s) => s.restoreActiveSession);
  const finishSessionEarly = useSessionStore((s) => s.finishSessionEarly);

  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const hasHistory = useProfileStore((s) => s.history.entries.length > 0);
  const trialStartDate = useEntitlementStore((s) => s.trialStartDate);
  const trialUsed = useEntitlementStore((s) => s.trialUsed);
  const refreshFromStore = useEntitlementStore((s) => s.refreshFromStore);
  // The store's current word, fetched once per launch and adopted if it
  // has one (ADR-0014 §6) — fire-and-forget, so the launch decision below
  // stays synchronous on the persisted record and never waits on a
  // network. A lapsed trial learned here re-renders into the gated day.
  useEffect(() => {
    void refreshFromStore();
  }, [refreshFromStore]);
  const purchase = useEntitlementStore((s) => s.purchase);

  // What the crash snapshot meant for THIS launch. "pending" until the
  // decision has run: nothing downstream (least of all a handoff to the
  // hub) may be decided while a session might still be in flight.
  const [restore, setRestore] = useState<
    "pending" | RestoreActiveSessionResult
  >("pending");
  const [handoff, setHandoff] = useState(false);
  const decided = useRef(false);
  const handedOff = useRef(false);

  // Gate 3 t0: the launch surface's first mount this JS lifetime. Marked
  // in a mount effect (first commit; native pre-JS launch time is not
  // observable from here) and idempotent, so remounts within one launch
  // never move it. Reading the clock once is the entire cost.
  useEffect(() => {
    firstMovementTracker.markLaunch(Date.now());
  }, []);

  useEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    // Gate 3 first-run flag, stamped the moment hydration reveals it:
    // same first-ever-open predicate as the onboarding branch below. The
    // flag describes the state at launch — completing onboarding later in
    // this same launch keeps it a first run.
    firstMovementTracker.markFirstRun(!onboardingCompleted && !hasHistory);
    const result = restoreActiveSession(todayIso());
    setRestore(result);
    if (result === "completedUnsaved") {
      onResumeFinished();
    }
  }, [
    hydrated,
    restoreActiveSession,
    onResumeFinished,
    onboardingCompleted,
    hasHistory,
  ]);

  // The gating order, as one value. Entitlement is app-layer policy
  // (never engine), evaluated offline from persisted state with the
  // daily prompt's local-date source.
  const stage: LaunchStage = ((): LaunchStage => {
    if (!hydrated || restore === "pending") return "waiting";
    // A finished-but-unsaved session is already on its way to the finish
    // screen's retrying save path; nothing else is decided this launch.
    if (restore === "completedUnsaved") return "waiting";
    if (restore === "inProgress") return "resume";
    if (!identity) return "signIn";
    if (!onboardingCompleted && !hasHistory) return "onboarding";
    if (
      !isEntitled(
        entitlementStatus({ firstCompletedDate: trialStartDate, purchase, trialUsed }),
      )
    ) {
      return "gated";
    }
    return handoff ? "promptHandoff" : "home";
  })();

  // The two stages that are handoffs rather than screens. Latched: the
  // callbacks are inline props, so without the ref a re-render would
  // navigate twice.
  useEffect(() => {
    if (stage !== "home" && stage !== "promptHandoff") return;
    if (handedOff.current) return;
    handedOff.current = true;
    if (stage === "promptHandoff") {
      onPromptHandoff();
    } else {
      onHome();
    }
  }, [stage, onHome, onPromptHandoff]);

  if (stage === "resume") {
    return (
      <ResumeOffer
        onContinue={onResumeSession}
        onFinishHere={() => {
          finishSessionEarly();
          onResumeFinished();
        }}
      />
    );
  }

  // Sign-in runs while no identity exists (ADR-0011): one screen, three
  // options with equal dignity, guest is one tap. Continuing is
  // store-driven — the identity landing re-renders this surface onward.
  if (stage === "signIn") {
    return <SignInScreen />;
  }

  // Onboarding runs once, ever: never completed AND no profile history
  // (an install that trained before this flag existed is not re-onboarded).
  if (stage === "onboarding") {
    return <OnboardingScreen onDone={() => setHandoff(true)} />;
  }

  // The gated day: the paywall letter where the questions would be, with
  // the Progress and Settings doors intact (ADR-0009 §3: her record
  // stays hers). It stays on "/" — the hub and the questions are what a
  // subscription gates, nothing else.
  if (stage === "gated") {
    return <GatedDailySurface />;
  }

  if (stage === "waiting") {
    return (
      <Screen>
        <View style={styles.holding}>
          <AppText variant="bodySoft">
            {hydrationFailed
              ? strings.errors.storageUnavailable
              : strings.errors.preparing}
          </AppText>
        </View>
      </Screen>
    );
  }

  // Handing off to the hub (or, once ever, straight to the questions):
  // the app's own frame, silent. Nothing is claimed here — the
  // destination is already replacing this surface.
  return (
    <Screen>
      <View style={styles.holding} testID="launch-handoff" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  holding: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
