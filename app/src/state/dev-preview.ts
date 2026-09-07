// DEV-ONLY flow previewer seeds (settings "Developer tools"). The owner
// walks the whole flow on a dev build without waiting seven real days for
// trial expiry or training to a real unlock: each function below seeds
// REAL store state through the stores' public APIs, and the settings
// screen then navigates to the real route — never a faked screen. The
// route guards and the launch surface's gating stay untouched and must
// pass over what's seeded here. Nothing in this module is reachable from
// a release build (every call site is __DEV__-gated).

import type { ApplyResult, BlockOutcome } from "@fither/engine";

import { todayIso } from "../lib/dates";
import { useDevReceiptStore } from "../monetization/dev-billing";
import type { FreeSessionsVariant } from "../monetization/experiment";
import { useEntitlementStore } from "./entitlement-store";
import { useExperimentStore } from "./experiment-store";
import {
  createPlayer,
  finishEarly,
  type PlayerBlock,
  type PlayerState,
} from "../session/player-machine";
import { useSessionStore, type FinishClose } from "./session-store";

/** Local calendar date `days` ago (setDate handles months and DST). */
function isoDaysAgo(days: number, now: Date = new Date()): string {
  const then = new Date(now);
  then.setDate(then.getDate() - days);
  return todayIso(then);
}

/**
 * An expired, unpurchased trial: trial started 8 days ago (one past the
 * 7-day window), no purchase, and no dev-billing receipt either — so the
 * gated day renders on the launch surface and restore honestly finds
 * nothing.
 */
export function seedTrialExpiredForDev(now: Date = new Date()): void {
  // ADR-0014 §6: "expired" is a store trial that was held and lapsed —
  // a completed session behind her, nothing active, the week used.
  useEntitlementStore.setState({
    trialStartDate: isoDaysAgo(8, now),
    purchase: null,
    trialUsed: true,
    qualifyingSessions: 1,
    lastQualifyingSessionId: "dev-preview:1",
  });
  useDevReceiptStore.setState({ receipt: null });
}

/** A store trial in progress: the yearly plan's free week, started today. */
export function seedTrialActiveForDev(now: Date = new Date()): void {
  useEntitlementStore.setState({
    trialStartDate: isoDaysAgo(1, now),
    purchase: { plan: "annual", date: todayIso(now), trial: true },
    trialUsed: true,
    qualifyingSessions: 1,
    lastQualifyingSessionId: "dev-preview:1",
  });
}

/**
 * A truly fresh install, entitlement-wise: no trial started, no purchase,
 * and (unlike the plain entitlement reset, which deliberately keeps the
 * fake receipt so restore stays exercisable) no dev-billing receipt. The
 * experiment's dev override is cleared too, so the launch surface reads
 * the build's real activation again.
 */
export function seedFreshEntitlementForDev(): void {
  useEntitlementStore.getState().resetForDev();
  useDevReceiptStore.setState({ receipt: null });
  useExperimentStore.getState().setForceVariantForDev(null);
}

/**
 * The free-sessions experiment (ADR-0025) seen from either side: force
 * the variant through the store's dev override (the build's activation
 * and any recorded assignment are untouched) and seed ONE qualifying
 * session behind her with no entitlement. The launch surface then shows
 * the honest result — control gates on the paywall, three keeps her
 * training with two free sessions still in hand.
 */
export function seedFreeSessionsPreviewForDev(
  variant: FreeSessionsVariant,
  now: Date = new Date(),
): void {
  useExperimentStore.getState().setForceVariantForDev(variant);
  useEntitlementStore.setState({
    trialStartDate: isoDaysAgo(1, now),
    purchase: null,
    trialUsed: false,
    qualifyingSessions: 1,
    lastQualifyingSessionId: "dev-preview:1",
  });
  useDevReceiptStore.setState({ receipt: null });
}

// A fixture-shaped skill for the unlock preview (mirrors the test
// fixtures' conventions, but lives here so no test file loads at
// runtime). The movement name is real library content.
const DEV_PREVIEW_SKILL: ApplyResult["unlockedSkills"][number] = {
  pattern: "push",
  tier: 4,
  movementName: "Full Push-Up",
};

/**
 * Seed the session flow's finish summary and nothing else in-memory:
 * completeSession on arrival is a guaranteed no-op (no session, no
 * player), so the routes render exactly this summary. Points mirror the
 * fixture ledger (10 session + 25 unlock).
 */
/**
 * A finished player for the previews, so the finish screen draws what
 * production draws — the figures of the completed blocks (reviewer
 * should-fix: the owner was approving a screen that differed from the
 * one users see). Two real library movements with figures; `session`
 * stays null, so completeSession on arrival is still a no-op.
 */
function previewPlayer(outcomes: BlockOutcome[]): PlayerState {
  const blocks: PlayerBlock[] = [
    {
      movementId: "wall-push-up",
      name: "Wall Push-Up",
      cues: [],
      unilateral: false,
      sets: 2,
      amount: 8,
      restSeconds: 30,
      timingType: "reps",
    },
    {
      movementId: "knee-plank",
      name: "Knee Plank",
      cues: [],
      unilateral: false,
      sets: 1,
      amount: 20,
      restSeconds: 30,
      timingType: "seconds",
    },
  ];
  return { ...finishEarly(createPlayer(blocks)), outcomes };
}

function seedFinishSummary(
  finish: {
    pointsEarned: number;
    unlockedSkills: ApplyResult["unlockedSkills"];
    completedAnything: boolean;
    close: FinishClose;
  },
  outcomes: BlockOutcome[],
): void {
  useSessionStore.setState({
    prompt: null,
    sessionId: null,
    session: null,
    player: previewPlayer(outcomes),
    countdownEndsAt: null,
    activeMs: 0,
    workResumedAt: null,
    pendingClose: null,
    finish,
    saveFailed: false,
    saving: false,
  });
}

/** A finish summary with one unlocked skill — /unlock's guard passes.
 * Points follow ADR-0008 for a 10-minute session with a skill unlock:
 * 20 (session) + 25 (unlock) — the owner previews real numbers. */
export function seedUnlockPreviewForDev(): void {
  seedFinishSummary({
    pointsEarned: 45,
    unlockedSkills: [DEV_PREVIEW_SKILL],
    completedAnything: true,
    close: { reason: "completed" },
  }, ["completed", "completed"]);
}

/**
 * Every close state FinishSummary distinguishes today (ADR-0012 §2 and
 * the audit's wave 2): the natural completed close, "Finished here",
 * the kept time promise, and the honest zero-completion close. When the
 * finish screen learns a new close reason, add its seed here so the
 * previewer stays a complete walk of the real states.
 */
export type DevFinishPreview =
  | "completed"
  | "endedEarly"
  | "outOfTime"
  | "nothingDone";

export function seedFinishPreviewForDev(preview: DevFinishPreview): void {
  const completedAnything = preview !== "nothingDone";
  const close: FinishClose =
    preview === "outOfTime"
      ? // A real chosen length — outOfTime's headline names her minutes.
        { reason: "outOfTime", minutes: 20 }
      : { reason: preview };
  // What the figures show per close: everything done, one block done
  // before an early or timed close, nothing done at all.
  const outcomes: BlockOutcome[] =
    preview === "completed"
      ? ["completed", "completed"]
      : preview === "nothingDone"
        ? ["skipped", "skipped"]
        : ["completed", "skipped"];
  seedFinishSummary(
    {
      // ADR-0008: a completed 10/20/30-minute session earns 20/25/30. The
      // outOfTime preview names 20 minutes, so its points read 25; the
      // other completed closes preview the 10-minute base.
      pointsEarned: !completedAnything ? 0 : preview === "outOfTime" ? 25 : 20,
      unlockedSkills: [],
      completedAnything,
      close,
    },
    outcomes,
  );
}
