import { useEffect, useRef, useState } from "react";

import { todayIso } from "../../lib/dates";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { useSessionStore } from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import { DailyPromptScreen } from "../daily-prompt/daily-prompt-screen";
import { ResumeOffer } from "./resume-offer";

// The app's entry surface. Once every persisted store has hydrated, the
// session store decides what a crash-persisted session means for this
// launch: a same-day in-progress session earns the one calm resume
// decision, a finished-but-unsaved one goes straight to the finish
// screen's retrying save path, and anything older — or nothing — lands on
// the daily prompt with no comment.

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
  const restoreActiveSession = useSessionStore((s) => s.restoreActiveSession);
  const finishSessionEarly = useSessionStore((s) => s.finishSessionEarly);

  const [offerResume, setOfferResume] = useState(false);
  const decided = useRef(false);

  const hydrated =
    profileHydrated && ledgerHydrated && settingsHydrated && activeHydrated;

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

  // The prompt screen renders the hydration wait/failure states itself.
  return <DailyPromptScreen onSessionReady={onSessionReady} />;
}
