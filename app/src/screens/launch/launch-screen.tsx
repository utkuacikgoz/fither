import { useEffect, useRef, useState } from "react";

import { todayIso } from "../../lib/dates";
import { firstMovementTracker } from "../../lib/first-movement-timer";
import { entitlementStatus, isEntitled } from "../../monetization/entitlement";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { useIdentityStore } from "../../state/identity-store";
import { useSessionStore } from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import { DailyPromptScreen } from "../daily-prompt/daily-prompt-screen";
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
// everyone else lands on the daily prompt with no comment.

interface LaunchScreenProps {
  /** The prompt generated today's session — go to the preview. */
  onSessionReady: () => void;
  /** She chose to keep going — back into the player where she stopped. */
  onResumeSession: () => void;
  /** The session is done (or she called it done) — apply it on finish. */
  onResumeFinished: () => void;
}

export function LaunchScreen({
  onSessionReady,
  onResumeSession,
  onResumeFinished,
}: LaunchScreenProps) {
  const profileHydrated = useProfileStore((s) => s.hydrated);
  const ledgerHydrated = useLedgerStore((s) => s.hydrated);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const activeHydrated = useActiveSessionStore((s) => s.hydrated);
  const entitlementHydrated = useEntitlementStore((s) => s.hydrated);
  const identityHydrated = useIdentityStore((s) => s.hydrated);
  const identity = useIdentityStore((s) => s.identity);
  const restoreActiveSession = useSessionStore((s) => s.restoreActiveSession);
  const finishSessionEarly = useSessionStore((s) => s.finishSessionEarly);

  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const hasHistory = useProfileStore((s) => s.history.entries.length > 0);
  const trialStartDate = useEntitlementStore((s) => s.trialStartDate);
  const purchase = useEntitlementStore((s) => s.purchase);

  const [offerResume, setOfferResume] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const decided = useRef(false);

  const hydrated =
    profileHydrated &&
    ledgerHydrated &&
    settingsHydrated &&
    activeHydrated &&
    entitlementHydrated &&
    identityHydrated;

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
    if (result === "completedUnsaved") {
      onResumeFinished();
    } else if (result === "inProgress") {
      setOfferResume(true);
    }
  }, [
    hydrated,
    restoreActiveSession,
    onResumeFinished,
    onboardingCompleted,
    hasHistory,
  ]);

  if (offerResume) {
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
  if (hydrated && !identity) {
    return <SignInScreen />;
  }

  // Onboarding runs once, ever: never completed AND no profile history
  // (an install that trained before this flag existed is not re-onboarded).
  if (hydrated && !onboardingCompleted && !hasHistory) {
    return <OnboardingScreen onDone={() => setHandoff(true)} />;
  }

  // Entitlement gate (app-layer policy, never engine): only an expired,
  // unpurchased trial blocks generating a NEW session. Evaluated offline
  // from persisted state, with the daily prompt's local-date source.
  // The gate renders the day's surface in its gated state — the paywall
  // letter where the questions would be, with the Progress and Settings
  // doors intact (ADR-0009 §3: her record stays hers).
  if (
    hydrated &&
    !isEntitled(entitlementStatus({ trialStartDate, purchase, today: todayIso() }))
  ) {
    return <GatedDailySurface />;
  }

  // The prompt screen renders the hydration wait/failure states itself.
  return (
    <DailyPromptScreen onSessionReady={onSessionReady} showHandoff={handoff} />
  );
}
