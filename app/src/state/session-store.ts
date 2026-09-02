import type {
  ApplyResult,
  DailyPrompt,
  Session,
  SessionMinutes,
} from "@fither/engine";
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
  isWrapBoundary,
  reduce,
  restorePlayerBlocks,
  samePosition,
  sessionCeilingMs,
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

/**
 * How the session closed — set at the point the close happened (the
 * ceiling wrap, the resume offer's "Finish here", or the natural end)
 * and carried into the finish summary. The UI renders it verbatim and
 * never infers a close from player state. "outOfTime" carries the chosen
 * length so the finish headline can say whose minutes were kept.
 */
export type FinishClose =
  | { reason: "completed" }
  | { reason: "endedEarly" }
  | { reason: "outOfTime"; minutes: SessionMinutes }
  | { reason: "nothingDone" };

export interface FinishSummary {
  pointsEarned: number;
  unlockedSkills: ApplyResult["unlockedSkills"];
  /**
   * True when at least one block completed — read from the engine's own
   * output (a "session" ledger event fires only for a session with a
   * completed block), never re-derived. False = the honest nothing-done
   * close: no "complete", no "counts" (ADR-0012 / audit P0 #5).
   */
  completedAnything: boolean;
  /**
   * The close state to render. Precedence: "nothingDone" wins over any
   * early close when zero blocks completed. Optional ONLY because
   * pre-existing summary literals (unlock-screen tests, outside this
   * store) predate it — completeSession always sets it; a reader falls
   * back to the plain completed close.
   */
  close?: FinishClose;
}

/** An early close captured before the apply lands ("completed" = none). */
type PendingClose = "endedEarly" | "outOfTime" | null;

/** ADR-0012 §2: past minutes×60×1.1 of elapsed work time, wrap up. */
function ceilingWrapDue(
  session: Session,
  workStartedAt: number | null,
  now: number,
): boolean {
  return (
    workStartedAt !== null &&
    now - workStartedAt > sessionCeilingMs(session.minutes)
  );
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
  /**
   * Wall-clock anchor of the session's first work phase (ADR-0012 §2).
   * Elapsed session time is always `now - workStartedAt` — recomputed
   * from this persisted stamp, never accumulated by a JS timer — so
   * backgrounding and process death cannot lose or reset it.
   */
  workStartedAt: number | null;
  /** Early close already decided (ceiling wrap / "Finish here"). */
  pendingClose: PendingClose;
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
  workStartedAt: null,
  pendingClose: null,
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
        workStartedAt: null,
        pendingClose: null,
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
          workStartedAt: null,
          pendingClose: null,
        });
    }
    return result;
  },

  dispatchPlayer: (event) => {
    const {
      prompt,
      sessionId,
      session,
      player,
      finish,
      countdownEndsAt,
      workStartedAt,
      pendingClose,
    } = get();
    if (!player) return;
    const now = Date.now();
    let next = reduce(player, event);
    // Anchor the session's elapsed clock at its first work entry — one
    // wall-clock stamp, persisted with the snapshot below. Intros don't
    // count: her time promise spends from the moment she starts moving.
    const anchoredWorkStart =
      workStartedAt === null && next.phase.kind === "work" ? now : workStartedAt;
    // Time-budget ceiling (ADR-0012 §2): past the promise +10% the session
    // wraps at the NEXT phase boundary. Only on a real transition (a tick
    // mid-count keeps its position), never at feedback (a finished block
    // gets its answer so completed work counts) — see isWrapBoundary.
    // Remaining blocks record "skipped": progression-neutral (§1).
    let nextPendingClose = pendingClose;
    if (
      session !== null &&
      !samePosition(player, next) &&
      isWrapBoundary(next) &&
      ceilingWrapDue(session, anchoredWorkStart, now)
    ) {
      next = finishEarly(next);
      nextPendingClose = "outOfTime";
    }
    const nextDeadline = isCountingDown(next)
      ? samePosition(player, next) && countdownEndsAt !== null
        ? countdownEndsAt
        : deadlineFor(next, now)
      : null;
    set({
      player: next,
      countdownEndsAt: nextDeadline,
      workStartedAt: anchoredWorkStart,
      pendingClose: nextPendingClose,
    });
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
        workStartedAt: anchoredWorkStart,
        pendingClose: nextPendingClose,
      });
    }
  },

  reconcileTimer: (now = Date.now()) => {
    const {
      prompt,
      sessionId,
      session,
      player,
      finish,
      countdownEndsAt,
      workStartedAt,
      pendingClose,
    } = get();
    if (!prompt || !sessionId || !session || !player || finish) return;
    const reconciled = reconcileCountdown(player, countdownEndsAt, now);
    let nextPlayer = reconciled.player;
    let nextDeadline = reconciled.countdownEndsAt;
    let nextPendingClose = pendingClose;
    // The ceiling holds across backgrounding: elapsed time is re-derived
    // from the persisted wall-clock anchor, so a countdown that ran out
    // while she was away wraps here, at the same boundary rule the live
    // dispatch path uses (ADR-0012 §2).
    if (
      !samePosition(player, nextPlayer) &&
      isWrapBoundary(nextPlayer) &&
      ceilingWrapDue(session, workStartedAt, now)
    ) {
      nextPlayer = finishEarly(nextPlayer);
      nextDeadline = null;
      nextPendingClose = "outOfTime";
    }
    if (nextPlayer === player && nextDeadline === countdownEndsAt) return;
    set({
      player: nextPlayer,
      countdownEndsAt: nextDeadline,
      pendingClose: nextPendingClose,
    });
    useActiveSessionStore.getState().save({
      sessionId,
      prompt,
      session,
      player: nextPlayer,
      countdownEndsAt: nextDeadline,
      workStartedAt,
      pendingClose: nextPendingClose,
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
      const completedAnything = record.result.ledgerEvents.some(
        (e) => e.type === "session",
      );
      // The close reason was captured where the close happened (ceiling
      // wrap / "Finish here" / natural end). Precedence: zero completed
      // blocks is the honest nothing-done close no matter how it ended.
      const pending = get().pendingClose;
      const close: FinishClose = !completedAnything
        ? { reason: "nothingDone" }
        : pending === "outOfTime"
          ? { reason: "outOfTime", minutes: session.minutes }
          : pending === "endedEarly"
            ? { reason: "endedEarly" }
            : { reason: "completed" };
      set({
        finish: {
          pointsEarned: record.result.ledgerEvents.reduce((s, e) => s + e.points, 0),
          unlockedSkills: record.result.unlockedSkills,
          completedAnything,
          close,
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
    const { prompt, sessionId, session, player, finish, workStartedAt } = get();
    if (!prompt || !sessionId || !session || !player || finish) return;
    const next = finishEarly(player);
    set({ player: next, countdownEndsAt: null, pendingClose: "endedEarly" });
    // Snapshot the done-state too — close reason included: a crash before
    // the apply lands must still resolve to the completedUnsaved path AND
    // the same honest "Finished here" close on the next launch.
    useActiveSessionStore.getState().save({
      sessionId,
      prompt,
      session,
      player: next,
      countdownEndsAt: null,
      workStartedAt,
      pendingClose: "endedEarly",
    });
  },

  prepareSessionEdit: () => {
    const { finish } = get();
    if (finish) return;
    useActiveSessionStore.getState().clear();
    set({ sessionId: null, session: null, player: null, countdownEndsAt: null, workStartedAt: null, pendingClose: null, saveFailed: false, saving: false });
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
      // The elapsed anchor and any decided close survive process death —
      // both restore from the persisted snapshot, never re-derived. A
      // legacy snapshot without an anchor re-anchors at her next work
      // dispatch (full budget again — lenient, never punitive).
      workStartedAt: snapshot.workStartedAt ?? null,
      pendingClose: snapshot.pendingClose ?? null,
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
    set({ prompt: null, sessionId: null, session: null, player: null, countdownEndsAt: null, workStartedAt: null, pendingClose: null, finish: null, saveFailed: false, saving: false });
  },
}));
