import type { ApplyResult, DailyPrompt, Session } from "@fither/engine";
import { create } from "zustand";

import { firstMovementTracker } from "../lib/first-movement-timer";
import { applyResult } from "../session/apply-result";
import {
  createSession,
  toPlayerBlocks,
  type CreateSessionResult,
} from "../session/create-session";
import { loadLibrary } from "../session/load-library";
import {
  createPlayer,
  finishEarly,
  isFinished,
  reduce,
  restorePlayerBlocks,
  samePosition,
  type PlayerEvent,
  type PlayerState,
} from "../session/player-machine";
import { useActiveSessionStore } from "./active-session-store";
import { useEntitlementStore } from "./entitlement-store";
import { useFirstMovementStore } from "./first-movement-store";
import { useProfileStore } from "./profile-store";
import { useLedgerStore } from "./ledger-store";
import { useSettingsStore } from "./settings-store";

function persistentStoresReady(): boolean {
  return (
    useProfileStore.getState().hydrated &&
    useLedgerStore.getState().hydrated &&
    useSettingsStore.getState().hydrated &&
    useActiveSessionStore.getState().hydrated &&
    useEntitlementStore.getState().hydrated
  );
}

interface FinishSummary {
  pointsEarned: number;
  unlockedSkills: ApplyResult["unlockedSkills"];
}

/** What a persisted in-flight session means for this launch. */
export type RestoreActiveSessionResult =
  | "none"
  | "inProgress"
  | "completedUnsaved";

interface SessionFlowState {
  prompt: DailyPrompt | null;
  session: Session | null;
  player: PlayerState | null;
  finish: FinishSummary | null;
  saveFailed: boolean;
  /** Generate today's session from the prompt. Everything runs on device. */
  startSession: (prompt: DailyPrompt) => CreateSessionResult;
  dispatchPlayer: (event: PlayerEvent) => void;
  /** Apply the finished session through the engine boundary. Idempotent. */
  completeSession: () => void;
  /**
   * "Finish here" on the resume offer: keep every outcome she captured,
   * mark the rest skipped, and hand the player to the finish screen's
   * apply path. Completed blocks earn what the engine grants — this is
   * never a discard.
   */
  finishSessionEarly: () => void;
  /**
   * Restore a crash-persisted session on launch. A snapshot from today is
   * loaded back into the store: "inProgress" means the launch surface
   * should offer to resume, "completedUnsaved" means the workout finished
   * but was never applied — route straight to the finish screen's
   * retrying save path. A snapshot from a previous day is cleared without
   * comment: the forbidden list bans absence framing, so we never bring
   * up yesterday.
   */
  restoreActiveSession: (todayDate: string) => RestoreActiveSessionResult;
  resetSession: () => void;
}

export const useSessionStore = create<SessionFlowState>()((set, get) => ({
  prompt: null,
  session: null,
  player: null,
  finish: null,
  saveFailed: false,

  startSession: (prompt) => {
    if (!persistentStoresReady()) {
      return { ok: false, reason: "notReady" };
    }
    const { profile, history } = useProfileStore.getState();
    const { sessionSalt } = useSettingsStore.getState();
    const result = createSession(prompt, profile, history, sessionSalt);
    if (result.ok) {
      const player = createPlayer(result.value.playerBlocks);
      set({
        prompt,
        session: result.value.session,
        player,
        finish: null,
        saveFailed: false,
      });
      useActiveSessionStore
        .getState()
        .save({ prompt, session: result.value.session, player });
    }
    return result;
  },

  dispatchPlayer: (event) => {
    const { prompt, session, player, finish } = get();
    if (!player) return;
    const next = reduce(player, event);
    set({ player: next });
    // Gate 3 t1, captured at the dispatch boundary (never in the player's
    // render path): the first time this launch lands in a "work" phase —
    // intro and rest don't count as moving. The tracker fires at most
    // once per launch, so the one storage write below happens on that
    // capture only; every later dispatch, ticks included, is a no-op that
    // never even reads the clock.
    const firstWorkRun = firstMovementTracker.captureWorkEntry(
      next.phase.kind,
      () => Date.now(),
    );
    if (firstWorkRun) {
      useFirstMovementStore.getState().record(firstWorkRun);
    }
    // Persist the crash-recovery snapshot only when the machine actually
    // moved — phase transitions and captured outcomes. Countdown ticks
    // arrive once per second; writing AsyncStorage on every tick would
    // make storage churn race the timer for nothing, because a countdown
    // position isn't restored anyway (a resumed set restarts its
    // countdown from the top — samePosition ignores remaining seconds).
    if (prompt && session && !finish && !samePosition(player, next)) {
      useActiveSessionStore.getState().save({ prompt, session, player: next });
    }
  },

  completeSession: () => {
    const { session, player, finish } = get();
    if (!session || !player || !isFinished(player)) return;
    if (finish) return; // already applied
    if (!persistentStoresReady()) {
      set({ saveFailed: true });
      return;
    }
    set({ saveFailed: false });
    const { profile, history, applyEngineResult } = useProfileStore.getState();
    const outcome = applyResult(profile, history, {
      session,
      outcomes: player.outcomes,
    });
    if (outcome.ok) {
      // DUAL-WRITE GAP (S3, accepted for now): applying a result touches
      // three AsyncStorage keys in separate writes — profile/history,
      // then the ledger append, then clearing the active-session
      // snapshot. There is no transaction, so a crash inside this window
      // can drop one side (history saved but points not yet appended) or
      // leave a done-snapshot behind that re-applies on relaunch. This is
      // accepted because: single device (no concurrent writer), the
      // ledger is append-only (nothing here can shrink it), the profile
      // is engine-derived from the same apply (never partially edited),
      // and all three writes are issued in one JS turn, so the window is
      // a hard kill mid-flush. Revisit before any sync/backup story.
      applyEngineResult(outcome.value);
      // Trial policy stamp (ADR-0009 §2): the 7-day trial starts at the
      // first COMPLETED session. Stamped from the session's own date —
      // the same local-date source the daily prompt used — and only when
      // the apply actually landed (a failed save spends no trial).
      // Idempotent inside the entitlement store; joins the accepted S3
      // dual-write window above.
      useEntitlementStore.getState().markSessionCompleted(session.date);
      useActiveSessionStore.getState().clear();
      set({
        finish: {
          pointsEarned: outcome.value.ledgerEvents.reduce((s, e) => s + e.points, 0),
          unlockedSkills: outcome.value.unlockedSkills,
        },
        saveFailed: false,
      });
    } else {
      // Snapshot intentionally kept: a failed save must survive a
      // relaunch so the finish screen can retry — her workout counts.
      set({ saveFailed: true });
    }
  },

  finishSessionEarly: () => {
    const { prompt, session, player, finish } = get();
    if (!prompt || !session || !player || finish) return;
    const next = finishEarly(player);
    set({ player: next });
    // Snapshot the done-state too: a crash before the apply lands must
    // still resolve to the completedUnsaved path on the next launch.
    useActiveSessionStore.getState().save({ prompt, session, player: next });
  },

  restoreActiveSession: (todayDate) => {
    if (!persistentStoresReady()) return "none";
    const { snapshot, clear } = useActiveSessionStore.getState();
    if (!snapshot) return "none";
    if (snapshot.session.date !== todayDate) {
      // Silently drop leftovers from a previous day — never mention it.
      clear();
      return "none";
    }
    const library = loadLibrary();
    const player = library
      ? restorePlayerBlocks(
          snapshot.player,
          toPlayerBlocks(snapshot.session, library),
        )
      : snapshot.player;
    set({
      prompt: snapshot.prompt,
      session: snapshot.session,
      player,
      finish: null,
      saveFailed: false,
    });
    return isFinished(player) ? "completedUnsaved" : "inProgress";
  },

  resetSession: () => {
    useActiveSessionStore.getState().clear();
    set({ prompt: null, session: null, player: null, finish: null, saveFailed: false });
  },
}));
