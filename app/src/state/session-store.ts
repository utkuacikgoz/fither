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
  advanceCountdownBy,
  finishEarly,
  isFinished,
  isCountingDown,
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
import {
  clearPersistedActiveSession,
  persistCanonicalCompletion,
  readCompletionRecord,
  writeCompletionRecord,
  type CompletionRecord,
} from "./completion-journal";

let sessionSequence = 0;
function createSessionId(session: Session): string {
  sessionSequence += 1;
  return `${session.date}:${session.seed}:${Date.now().toString(36)}:${sessionSequence.toString(36)}`;
}

function countdownSeconds(player: PlayerState): number | null {
  const { phase } = player;
  if (phase.kind === "rest") return phase.remainingSeconds;
  if (phase.kind === "work") return phase.remainingSeconds;
  return null;
}

function deadlineFor(player: PlayerState, now: number): number | null {
  const seconds = countdownSeconds(player);
  return seconds === null ? null : now + seconds * 1000;
}

function reconcileCountdown(
  player: PlayerState,
  countdownEndsAt: number | null,
  now: number,
): { player: PlayerState; countdownEndsAt: number | null } {
  const seconds = countdownSeconds(player);
  if (seconds === null || countdownEndsAt === null) {
    return { player, countdownEndsAt: deadlineFor(player, now) };
  }
  const startedAt = countdownEndsAt - seconds * 1000;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const next = advanceCountdownBy(player, elapsed);
  return {
    player: next,
    countdownEndsAt: isCountingDown(next) ? deadlineFor(next, now) : null,
  };
}

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
  /**
   * True when at least one block completed — read from the engine's own
   * output (a "session" ledger event fires only for a session with a
   * completed block), never re-derived. False = the honest nothing-done
   * close: no "complete", no "counts" (ADR-0012 / audit P0 #5).
   */
  completedAnything: boolean;
}

/** What a persisted in-flight session means for this launch. */
export type RestoreActiveSessionResult =
  | "none"
  | "inProgress"
  | "completedUnsaved";

interface SessionFlowState {
  prompt: DailyPrompt | null;
  sessionId: string | null;
  session: Session | null;
  player: PlayerState | null;
  countdownEndsAt: number | null;
  finish: FinishSummary | null;
  saveFailed: boolean;
  saving: boolean;
  /** Generate today's session from the prompt. Everything runs on device. */
  startSession: (prompt: DailyPrompt) => CreateSessionResult;
  dispatchPlayer: (event: PlayerEvent) => void;
  /** Catch a suspended countdown up to wall-clock time. */
  reconcileTimer: (now?: number) => void;
  /** Apply the finished session through the engine boundary. Idempotent. */
  completeSession: () => Promise<void>;
  /**
   * "Finish here" on the resume offer: keep every outcome she captured,
   * mark the rest skipped, and hand the player to the finish screen's
   * apply path. Completed blocks earn what the engine grants — this is
   * never a discard.
   */
  finishSessionEarly: () => void;
  /** Return to today's questions without carrying an unplayed plan forward. */
  prepareSessionEdit: () => void;
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
  sessionId: null,
  session: null,
  player: null,
  countdownEndsAt: null,
  finish: null,
  saveFailed: false,
  saving: false,

  startSession: (prompt) => {
    if (!persistentStoresReady()) {
      return { ok: false, reason: "notReady" };
    }
    const { profile, history } = useProfileStore.getState();
    const { sessionSalt } = useSettingsStore.getState();
    const result = createSession(prompt, profile, history, sessionSalt);
    if (result.ok) {
      const player = createPlayer(result.value.playerBlocks);
      const sessionId = createSessionId(result.value.session);
      set({
        prompt,
        sessionId,
        session: result.value.session,
        player,
        countdownEndsAt: null,
        finish: null,
        saveFailed: false,
        saving: false,
      });
      useActiveSessionStore
        .getState()
        .save({
          sessionId,
          prompt,
          session: result.value.session,
          player,
          countdownEndsAt: null,
        });
    }
    return result;
  },

  dispatchPlayer: (event) => {
    const { prompt, sessionId, session, player, finish, countdownEndsAt } = get();
    if (!player) return;
    const next = reduce(player, event);
    const nextDeadline = isCountingDown(next)
      ? samePosition(player, next) && countdownEndsAt !== null
        ? countdownEndsAt
        : deadlineFor(next, Date.now())
      : null;
    set({ player: next, countdownEndsAt: nextDeadline });
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
    if (prompt && sessionId && session && !finish && !samePosition(player, next)) {
      useActiveSessionStore.getState().save({
        sessionId,
        prompt,
        session,
        player: next,
        countdownEndsAt: nextDeadline,
      });
    }
  },

  reconcileTimer: (now = Date.now()) => {
    const { prompt, sessionId, session, player, finish, countdownEndsAt } = get();
    if (!prompt || !sessionId || !session || !player || finish) return;
    const reconciled = reconcileCountdown(player, countdownEndsAt, now);
    if (
      reconciled.player === player &&
      reconciled.countdownEndsAt === countdownEndsAt
    ) return;
    set(reconciled);
    useActiveSessionStore.getState().save({
      sessionId,
      prompt,
      session,
      player: reconciled.player,
      countdownEndsAt: reconciled.countdownEndsAt,
    });
  },

  completeSession: async () => {
    const { sessionId, session, player, finish, saving } = get();
    if (!session || !player || !isFinished(player)) return;
    if (finish || saving) return;
    if (!persistentStoresReady()) {
      set({ saveFailed: true, saving: false });
      return;
    }
    set({ saveFailed: false, saving: true });
    try {
      const stableId = sessionId ?? `legacy:${session.date}:${session.seed}`;
      const previous = await readCompletionRecord();
      let record: CompletionRecord;
      if (previous?.sessionId === stableId) {
        record = previous;
      } else {
        const { profile, history } = useProfileStore.getState();
        const outcome = applyResult(profile, history, {
          session,
          outcomes: player.outcomes,
        });
        if (!outcome.ok) {
          set({ saveFailed: true, saving: false });
          return;
        }
        const entitlement = useEntitlementStore.getState();
        record = {
          version: 1,
          status: "pending",
          sessionId: stableId,
          result: outcome.value,
          ledgerEvents: [...useLedgerStore.getState().events, ...outcome.value.ledgerEvents],
          trialStartDate: entitlement.trialStartDate ?? session.date,
          purchase: entitlement.purchase,
        };
        await writeCompletionRecord(record);
      }

      await persistCanonicalCompletion(record);
      useProfileStore.setState({
        profile: record.result.profile,
        history: record.result.history,
      });
      useLedgerStore.setState({ events: record.ledgerEvents });
      useEntitlementStore.setState({
        trialStartDate: record.trialStartDate,
        purchase: record.purchase,
      });
      await writeCompletionRecord({ ...record, status: "committed" });
      await clearPersistedActiveSession();
      useActiveSessionStore.setState({ snapshot: null });
      set({
        finish: {
          pointsEarned: record.result.ledgerEvents.reduce((s, e) => s + e.points, 0),
          unlockedSkills: record.result.unlockedSkills,
          completedAnything: record.result.ledgerEvents.some(
            (e) => e.type === "session",
          ),
        },
        saveFailed: false,
        saving: false,
      });
    } catch {
      // The active snapshot and journal are deliberately retained. A retry
      // replays the exact result instead of asking the engine to award it again.
      set({ saveFailed: true, saving: false });
    }
  },

  finishSessionEarly: () => {
    const { prompt, sessionId, session, player, finish } = get();
    if (!prompt || !sessionId || !session || !player || finish) return;
    const next = finishEarly(player);
    set({ player: next });
    // Snapshot the done-state too: a crash before the apply lands must
    // still resolve to the completedUnsaved path on the next launch.
    useActiveSessionStore.getState().save({ sessionId, prompt, session, player: next });
  },

  prepareSessionEdit: () => {
    const { finish } = get();
    if (finish) return;
    useActiveSessionStore.getState().clear();
    set({ sessionId: null, session: null, player: null, countdownEndsAt: null, saveFailed: false, saving: false });
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
    const restoredPlayer = library
      ? restorePlayerBlocks(
          snapshot.player,
          toPlayerBlocks(snapshot.session, library),
        )
      : snapshot.player;
    const reconciled = reconcileCountdown(
      restoredPlayer,
      snapshot.countdownEndsAt ?? null,
      Date.now(),
    );
    set({
      prompt: snapshot.prompt,
      sessionId: snapshot.sessionId ?? `legacy:${snapshot.session.date}:${snapshot.session.seed}`,
      session: snapshot.session,
      player: reconciled.player,
      countdownEndsAt: reconciled.countdownEndsAt,
      finish: null,
      saveFailed: false,
      saving: false,
    });
    useActiveSessionStore.getState().save({
      ...snapshot,
      sessionId: snapshot.sessionId ?? `legacy:${snapshot.session.date}:${snapshot.session.seed}`,
      player: reconciled.player,
      countdownEndsAt: reconciled.countdownEndsAt,
    });
    return isFinished(reconciled.player) ? "completedUnsaved" : "inProgress";
  },

  resetSession: () => {
    useActiveSessionStore.getState().clear();
    set({ prompt: null, sessionId: null, session: null, player: null, countdownEndsAt: null, finish: null, saveFailed: false, saving: false });
  },
}));
