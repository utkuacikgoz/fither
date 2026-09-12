import {
  computeStreak,
  type ApplyResult,
  type BlockOutcome,
  type DailyPrompt,
  type Session,
  type SessionMinutes,
} from "@fither/engine";
import { create } from "zustand";

import { track } from "../analytics/analytics";
import { firstMovementTracker } from "../lib/first-movement-timer";
import { applyResult } from "../session/apply-result";
import {
  createSession,
  toPlayerBlocks,
  type CreateSessionResult,
} from "../session/create-session";
import { loadLibrary } from "../session/load-library";
import { captureError } from "../monitoring/monitoring";
import {
  createPlayer,
  advanceCountdownBy,
  finishEarly,
  hasBegun,
  isFinished,
  isCountingDown,
  isWrapBoundary,
  reduce,
  remainingSecondsOf,
  restorePlayerBlocks,
  samePosition,
  sessionCeilingMs,
  type PlayerEvent,
  type PlayerState,
} from "../session/player-machine";
import {
  useActiveSessionStore,
  type ActiveSessionSnapshot,
} from "./active-session-store";
import { useEntitlementStore } from "./entitlement-store";
import { useFirstMovementStore } from "./first-movement-store";
import { useProfileStore } from "./profile-store";
import { useLedgerStore } from "./ledger-store";
import { rescheduleInvitation } from "./reminder-store";
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

// The machine owns which phases count (player-machine.remainingSecondsOf):
// the wall-clock deadline that survives backgrounding must cover every
// one of them, so a phase added there can never be forgotten here.
const countdownSeconds = remainingSecondsOf;

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
  /** At least one block attempted (completed or struggled); false = nothing done. */
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

/**
 * ACTIVE session time so far: the banked milliseconds plus the live
 * stretch since the anchor. This — never wall-clock-since-start — is what
 * the time-budget ceiling spends, so an interruption can't eat her budget:
 * pause at minute three, come back hours later, and she still has every
 * remaining minute of actual training ahead of her.
 */
function elapsedActiveMs(
  activeMs: number,
  workResumedAt: number | null,
  now: number,
): number {
  return activeMs + (workResumedAt === null ? 0 : Math.max(0, now - workResumedAt));
}

/** ADR-0012 §2: past minutes×60×1.1 of ACTIVE work time, wrap up. */
function ceilingWrapDue(
  session: Session,
  activeMs: number,
  workResumedAt: number | null,
  now: number,
): boolean {
  return (
    elapsedActiveMs(activeMs, workResumedAt, now) >
    sessionCeilingMs(session.minutes)
  );
}

/**
 * Audit S7: apply a previous day's snapshot that holds completed work as
 * a finished-early session under the SNAPSHOT's own date. Mirrors
 * completeSession's journaled transaction exactly — same idempotency,
 * same trial-evidence rule (ADR-0009 §2, dated per the record), same
 * canonical persistence — but touches no UI state: silent by design.
 */
async function applyStaleSnapshot(
  snapshot: ActiveSessionSnapshot,
): Promise<void> {
  try {
    const finished = finishEarly(snapshot.player);
    const stableId =
      snapshot.sessionId ??
      `legacy:${snapshot.session.date}:${snapshot.session.seed}`;
    const previous = await readCompletionRecord();
    let record: CompletionRecord;
    if (previous?.sessionId === stableId) {
      record = previous;
    } else {
      const { profile, history } = useProfileStore.getState();
      const outcome = applyResult(profile, history, {
        session: snapshot.session,
        outcomes: finished.outcomes,
      });
      if (!outcome.ok) return;
      const entitlement = useEntitlementStore.getState();
      const sessionCompleted = outcome.value.ledgerEvents.some(
        (e) => e.type === "session",
      );
      record = {
        version: 1,
        status: "pending",
        sessionId: stableId,
        result: outcome.value,
        ledgerEvents: [
          ...useLedgerStore.getState().events,
          ...outcome.value.ledgerEvents,
        ],
        trialStartDate:
          entitlement.trialStartDate ??
          (sessionCompleted ? snapshot.session.date : null),
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
    // The silent commit changes the same facts the visible one does; the
    // person sync watches the profile and entitlement stores written above.
    // The free-session allowance (ADR-0025): a committed session with a
    // completed block counts once per session id, from the journaled
    // result, so a replay never counts twice.
    if (record.result.ledgerEvents.some((e) => e.type === "session")) {
      useEntitlementStore.getState().recordQualifyingSession(record.sessionId, snapshot.session.date);
    }
    await writeCompletionRecord({ ...record, status: "committed" });
    await clearPersistedActiveSession();
    useActiveSessionStore.setState({ snapshot: null });
  } catch {
    // Snapshot and journal retained: the next launch retries and the
    // journal replays the identical result. Nothing is said either way.
  }
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
   * ACTIVE training milliseconds banked so far (ADR-0012 §2). Folded
   * forward from the live anchor at every dispatch/reconcile, and it is
   * the only part of elapsed time that survives a restore — away time
   * between a snapshot and a resume never spends her budget.
   */
  activeMs: number;
  /**
   * Wall-clock anchor of the CURRENT live stretch. Null before her first
   * work phase and again after a restore (the anchor restarts at her next
   * work dispatch, so the resume offer's "Keep going" is always
   * meaningful). While the process lives, backgrounding does NOT null it:
   * a brief background mid-hold keeps spending both clocks honestly,
   * matching the countdown reconciliation.
   */
  workResumedAt: number | null;
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
  activeMs: 0,
  workResumedAt: null,
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
        activeMs: 0,
        workResumedAt: null,
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
          activeMs: 0,
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
      activeMs,
      workResumedAt,
      pendingClose,
    } = get();
    if (!player) return;
    const now = Date.now();
    const reduced = reduce(player, event);
    let next = reduced;
    // Anchor the live stretch whenever a dispatch touches a work phase
    // with no anchor running — the session's first work entry, and again
    // after a restore (which may land directly INSIDE a work phase, so
    // the current phase counts too). Intros don't count: her time promise
    // spends from the moment she starts moving. The stretch before a
    // post-restore anchor arms is deliberately uncounted — generous,
    // because it is indistinguishable from time reading the resume offer.
    const anchoredResumedAt =
      workResumedAt === null &&
      (player.phase.kind === "work" || next.phase.kind === "work")
        ? now
        : workResumedAt;
    // Time-budget ceiling (ADR-0012 §2): past the promise +10% of ACTIVE
    // time the session wraps at the NEXT phase boundary. Only on a real
    // transition (a tick mid-count keeps its position), never at feedback
    // (a finished block gets its answer so completed work counts) — see
    // isWrapBoundary. Remaining blocks record "skipped": neutral (§1).
    let nextPendingClose = pendingClose;
    if (
      session !== null &&
      !samePosition(player, next) &&
      isWrapBoundary(next) &&
      ceilingWrapDue(session, activeMs, anchoredResumedAt, now)
    ) {
      next = finishEarly(next);
      nextPendingClose = "outOfTime";
    }
    const nextDeadline = isCountingDown(next)
      ? samePosition(player, next) && countdownEndsAt !== null
        ? countdownEndsAt
        : deadlineFor(next, now)
      : null;
    // Fold the live stretch into the bank and restart the anchor at now:
    // elapsed time is unchanged by the fold, but the persisted snapshot
    // below always carries banked-active-time only — the number a restore
    // resumes from without counting the away time.
    const foldedActiveMs = elapsedActiveMs(activeMs, anchoredResumedAt, now);
    const foldedResumedAt = anchoredResumedAt === null ? null : now;
    set({
      player: next,
      countdownEndsAt: nextDeadline,
      activeMs: foldedActiveMs,
      workResumedAt: foldedResumedAt,
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
    // workout_start: the machine's first real transition, the same
    // boundary the crash snapshot is born on. A restored session has
    // already begun, so a relaunch mid-session never counts twice.
    if (session !== null && !hasBegun(player) && hasBegun(next)) {
      track("workout_start", { minutes: session.minutes });
    }
    // block_outcome: the machine recorded HER answer for one block —
    // completed/struggled from the feedback question, skipped from the
    // skip. Read from the transition (a rejected event records nothing)
    // and from the reduce BEFORE the ceiling wrap, whose skips are the
    // clock's, not hers.
    const answered = reduced.outcomes[player.outcomes.length];
    if (
      (event.type === "feedback" || event.type === "skipBlock") &&
      answered !== undefined &&
      reduced.outcomes.length === player.outcomes.length + 1
    ) {
      track("block_outcome", {
        index: player.outcomes.length,
        total: reduced.blocks.length,
        outcome: answered,
      });
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
        activeMs: foldedActiveMs,
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
      activeMs,
      workResumedAt,
      pendingClose,
    } = get();
    if (!prompt || !sessionId || !session || !player || finish) return;
    const reconciled = reconcileCountdown(player, countdownEndsAt, now);
    let nextPlayer = reconciled.player;
    let nextDeadline = reconciled.countdownEndsAt;
    let nextPendingClose = pendingClose;
    // Within-process backgrounding continues both clocks: the live anchor
    // keeps running (this is the same continuing session, only the screen
    // went dark), so a countdown that ran out while she was briefly away
    // wraps here, at the same boundary rule the live dispatch path uses
    // (ADR-0012 §2). Only a RESTORE — process death, resume offer — resets
    // the anchor and refuses to count away time.
    if (
      !samePosition(player, nextPlayer) &&
      isWrapBoundary(nextPlayer) &&
      ceilingWrapDue(session, activeMs, workResumedAt, now)
    ) {
      nextPlayer = finishEarly(nextPlayer);
      nextDeadline = null;
      nextPendingClose = "outOfTime";
    }
    if (nextPlayer === player && nextDeadline === countdownEndsAt) return;
    // Fold at the persist boundary, exactly like dispatchPlayer.
    const foldedActiveMs = elapsedActiveMs(activeMs, workResumedAt, now);
    const foldedResumedAt = workResumedAt === null ? null : now;
    set({
      player: nextPlayer,
      countdownEndsAt: nextDeadline,
      activeMs: foldedActiveMs,
      workResumedAt: foldedResumedAt,
      pendingClose: nextPendingClose,
    });
    useActiveSessionStore.getState().save({
      sessionId,
      prompt,
      session,
      player: nextPlayer,
      countdownEndsAt: nextDeadline,
      activeMs: foldedActiveMs,
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
    // Read before the commit below moves it: "first" in workout_complete
    // means no earlier session had stamped the trial start.
    const entitlementBefore = useEntitlementStore.getState();
    try {
      const stableId = sessionId ?? `legacy:${session.date}:${session.seed}`;
      const previous = await readCompletionRecord();
      let record: CompletionRecord;
      // workout_complete is sent below only after the commit lands, so a
      // journal already marked committed has reported; a pending one
      // (crash or failed save mid-commit) has not, and reports once now.
      const alreadyReported =
        previous?.sessionId === stableId && previous.status === "committed";
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
        // ADR-0009 §2 (as amended by ADR-0014 §6): the first COMPLETED
        // session is stamped once; the paywall never blocks it, and the
        // day after it is gated until the store entitles her.
        // The evidence is the engine's own "session" ledger event — it
        // fires only when a block actually completed (the same fact
        // completedAnything reads below) — taken from the result being
        // journaled, so a crash-replay of this record lands on the
        // identical decision. An all-skipped session stamps nothing.
        const sessionCompleted = outcome.value.ledgerEvents.some(
          (e) => e.type === "session",
        );
        record = {
          version: 1,
          status: "pending",
          sessionId: stableId,
          result: outcome.value,
          ledgerEvents: [...useLedgerStore.getState().events, ...outcome.value.ledgerEvents],
          trialStartDate:
            entitlement.trialStartDate ?? (sessionCompleted ? session.date : null),
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
      // ADR-0025: count the qualifying session once per session id.
      if (record.result.ledgerEvents.some((e) => e.type === "session")) {
        useEntitlementStore.getState().recordQualifyingSession(stableId, session.date);
      }
      await writeCompletionRecord({ ...record, status: "committed" });
      await clearPersistedActiveSession();
      useActiveSessionStore.setState({ snapshot: null });
      // Attempted = completed or struggled (ADR-0023): "Hard today" is
      // still showing up and doing the work, so it closes as a session,
      // draws its figures and counts the day. Points and progression are
      // the engine's and unchanged. Read from the journaled result (the
      // history entry the engine just wrote), never from ambient state,
      // so a crash replay lands on the identical close.
      const written = record.result.history.entries[record.result.history.entries.length - 1];
      const completedAnything =
        written?.blocks.some((block) => block.outcome !== "skipped") ?? false;
      // The close reason was captured where the close happened (ceiling
      // wrap / "Finish here" / natural end). Precedence: zero attempted
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
      // Tomorrow's invitation now speaks from today's training (the week view):
      // the profile store above holds the committed history, so the
      // reminder store reads the week from it. Fire-and-forget and
      // never-throwing by contract — the finish is already on screen and
      // a scheduling failure is not her problem.
      void rescheduleInvitation();
      if (!alreadyReported) {
        track("workout_complete", {
          minutes: session.minutes,
          close: close.reason,
          first: completedAnything && entitlementBefore.trialStartDate === null,
          // The engine's count over the history the commit just wrote,
          // relative to the session's own day (ADR-0018 §5).
          streak: computeStreak(
            useProfileStore.getState().history.entries,
            session.date,
          ).current,
        });
        // skill_unlocked: one per milestone the engine granted in this
        // result — the pattern and the tier, never the movement name.
        for (const skill of record.result.unlockedSkills) {
          track("skill_unlocked", { pattern: skill.pattern, tier: skill.tier });
        }
      }
      // The commit moved her facts (sessions, last length, entitlement);
      // the person sync sees the profile and entitlement writes above.
    } catch (error) {
      // The active snapshot and journal are deliberately retained. A retry
      // replays the exact result instead of asking the engine to award it again.
      // A failed save is the one error the owner must hear about before
      // she does (ADR-0016): her session is safe, but only if the retry works.
      captureError(error, "completeSession");
      set({ saveFailed: true, saving: false });
    }
  },

  finishSessionEarly: () => {
    const { prompt, sessionId, session, player, finish, activeMs, workResumedAt } =
      get();
    if (!prompt || !sessionId || !session || !player || finish) return;
    const now = Date.now();
    const next = finishEarly(player);
    // Bank the live stretch; the session is done, so no anchor remains.
    const foldedActiveMs = elapsedActiveMs(activeMs, workResumedAt, now);
    set({
      player: next,
      countdownEndsAt: null,
      activeMs: foldedActiveMs,
      workResumedAt: null,
      pendingClose: "endedEarly",
    });
    // Snapshot the done-state too — close reason included: a crash before
    // the apply lands must still resolve to the completedUnsaved path AND
    // the same honest "Finished here" close on the next launch.
    useActiveSessionStore.getState().save({
      sessionId,
      prompt,
      session,
      player: next,
      countdownEndsAt: null,
      activeMs: foldedActiveMs,
      pendingClose: "endedEarly",
    });
  },

  prepareSessionEdit: () => {
    const { finish } = get();
    if (finish) return;
    useActiveSessionStore.getState().clear();
    set({ sessionId: null, session: null, player: null, countdownEndsAt: null, activeMs: 0, workResumedAt: null, pendingClose: null, saveFailed: false, saving: false });
  },

  restoreActiveSession: (todayDate) => {
    if (!persistentStoresReady()) return "none";
    const { snapshot, clear } = useActiveSessionStore.getState();
    if (!snapshot) return "none";
    if (snapshot.session.date !== todayDate) {
      // Audit S7: a previous day's interruption must not discard her
      // COMPLETED work — "Completed exercises are saved" has to be true
      // across midnight too. If any block completed, the snapshot is
      // silently applied as a finished-early session under ITS OWN date
      // (points, history, progression through the normal journaled
      // path); nothing is said to her — absence is never mentioned, her
      // Progress simply shows the work. With zero completed blocks
      // there is nothing saved to keep: struggled-only work would move
      // her counters against her and skipped work is neutral by rule,
      // so the kinder, honest reading of an abandoned day is absence —
      // the snapshot clears exactly as before (nothing is fabricated,
      // nothing regresses).
      const staleOutcomes = finishEarly(snapshot.player).outcomes;
      const hasCompletedWork = staleOutcomes.some(
        (o: BlockOutcome) => o === "completed",
      );
      if (hasCompletedWork) {
        // Fire-and-forget: the launch decision stays synchronous and
        // today's flow renders as normal. Crash-safety comes from the
        // journal — the snapshot clears only after commit, so a crash
        // mid-apply re-runs this on the next launch and the journal
        // replays the identical result (no double award).
        void applyStaleSnapshot(snapshot);
      } else {
        clear();
      }
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
    // Only BANKED active time survives a restore — the away time between
    // the last snapshot and this launch never spends her budget, so
    // "Keep going" always means every remaining minute of actual
    // training. The live anchor restarts at her next work dispatch, not
    // here: time spent reading the resume offer isn't training either.
    // Legacy tolerance: a pre-active-time snapshot (workStartedAt only,
    // no activeMs) banks NOTHING — the full budget again. That single
    // anchor can't tell training from hours away, and the generous
    // reading is the one that preserves her session; the punitive one
    // would wrap it the moment she resumed.
    const restoredActiveMs = snapshot.activeMs ?? 0;
    set({
      prompt: snapshot.prompt,
      sessionId: snapshot.sessionId ?? `legacy:${snapshot.session.date}:${snapshot.session.seed}`,
      session: snapshot.session,
      player: reconciled.player,
      countdownEndsAt: reconciled.countdownEndsAt,
      activeMs: restoredActiveMs,
      workResumedAt: null,
      // Any decided close survives process death — restored from the
      // persisted snapshot, never re-derived.
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
      // Converge legacy snapshots on the new shape: banked time written,
      // the deprecated wall-clock anchor dropped.
      activeMs: restoredActiveMs,
      workStartedAt: null,
    });
    return isFinished(reconciled.player) ? "completedUnsaved" : "inProgress";
  },

  resetSession: () => {
    useActiveSessionStore.getState().clear();
    set({ prompt: null, sessionId: null, session: null, player: null, countdownEndsAt: null, activeMs: 0, workResumedAt: null, pendingClose: null, finish: null, saveFailed: false, saving: false });
  },
}));
