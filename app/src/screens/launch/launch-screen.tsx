import { useEffect, useRef, useState } from "react";

import { todayIso } from "../../lib/dates";
import { entitlementStatus, isEntitled } from "../../monetization/entitlement";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { useSessionStore } from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import { DailyPromptScreen } from "../daily-prompt/daily-prompt-screen";
import { OnboardingScreen } from "../onboarding/onboarding-screen";
import { PaywallScreen } from "../paywall/paywall-screen";
import { ResumeOffer } from "./resume-offer";

// The app's entry surface. Once every persisted store has hydrated, the
// session store decides what a crash-persisted session means for this
// launch: a same-day in-progress session earns the one calm resume
// decision, a finished-but-unsaved one goes straight to the finish
// screen's retrying save path. The resume decision wins over EVERYTHING —
// an already-generated session is never interrupted by onboarding or the
// paywall. After it, in order: first-ever open (no history, onboarding
// never completed) gets the three onboarding screens; an expired,
// unpurchased trial gets the paywall instead of generating a new session
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
    entitlementHydrated;

  useEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    const result = restoreActiveSession(todayIso());
    if (result === "completedUnsaved") {
      onResumeFinished();
    } else if (result === "inProgress") {
      setOfferResume(true);
    }
  }, [hydrated, restoreActiveSession, onResumeFinished]);

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

  // Onboarding runs once, ever: never completed AND no profile history
  // (an install that trained before this flag existed is not re-onboarded).
  if (hydrated && !onboardingCompleted && !hasHistory) {
    return <OnboardingScreen onDone={() => setHandoff(true)} />;
  }

  // Entitlement gate (app-layer policy, never engine): only an expired,
  // unpurchased trial blocks generating a NEW session. Evaluated offline
  // from persisted state, with the daily prompt's local-date source.
  if (
    hydrated &&
    !isEntitled(entitlementStatus({ trialStartDate, purchase, today: todayIso() }))
  ) {
    return <PaywallScreen />;
  }

  // The prompt screen renders the hydration wait/failure states itself.
  return (
    <DailyPromptScreen onSessionReady={onSessionReady} showHandoff={handoff} />
  );
}
