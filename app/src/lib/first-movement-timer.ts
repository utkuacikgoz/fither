// Gate 3 measurement (docs/build-system.md §7): from opening the app to
// the first moment she is actually moving, in real numbers instead of a
// hand stopwatch. Pure logic with injected timestamps; the app wires real
// clocks at exactly two points:
//
//   t0 — the launch surface's first mount this JS lifetime
//        (screens/launch/launch-screen.tsx, mount effect)
//   t1 — the first entry into a "work" player phase this launch, observed
//        at the state-machine dispatch boundary
//        (state/session-store.ts, dispatchPlayer)
//
// What the measured window covers: store hydration, sign-in and
// onboarding (on a true first run), the daily prompt, on-device session
// generation, the session
// preview, and the first block intro up to "Begin". What it cannot cover:
// native pre-JS launch time and JS bundle execution before the launch
// surface's first commit — t0 starts at that mount, so the recorded delta
// slightly UNDERSTATES her real open-to-movement time. Intro and rest
// phases never count as moving; only "work" does.

import type { PlayerPhase } from "../session/player-machine";

/** One recorded launch: open (t0) to first work-phase entry (t1). */
export interface FirstMovementRun {
  /** Epoch ms at the launch surface's first mount. */
  t0: number;
  /** Epoch ms at the first work-phase entry this launch. */
  t1: number;
  /** t1 - t0, clamped at zero. THE Gate 3 number when firstRun is true. */
  deltaMs: number;
  /**
   * True when this launch was a true first run — onboarding had never
   * completed (and no history existed) when the launch surface mounted.
   * Later launches are recorded too, labelled, because prompt-speed
   * regressions matter forever.
   */
  firstRun: boolean;
}

export function computeDeltaMs(t0: number, t1: number): number {
  return Math.max(0, t1 - t0);
}

/** Dev-readout formatting: milliseconds as "42.3s". */
export function formatDeltaSeconds(deltaMs: number): string {
  return `${(deltaMs / 1000).toFixed(1)}s`;
}

/** Runs kept per device. Trimming never evicts a first-run record. */
export const MAX_RECORDED_RUNS = 50;

/**
 * Append a run, trimming the oldest non-first-run records over the cap.
 * First-run records (the Gate 3 numbers) are only evicted if the whole
 * list somehow consists of them.
 */
export function appendRun(
  runs: readonly FirstMovementRun[],
  run: FirstMovementRun,
  cap: number = MAX_RECORDED_RUNS,
): FirstMovementRun[] {
  const next = [...runs, run];
  while (next.length > cap) {
    const oldestLater = next.findIndex((r) => !r.firstRun);
    next.splice(oldestLater === -1 ? 0 : oldestLater, 1);
  }
  return next;
}

/** The most recent first-run record, if any — the readout's headline. */
export function latestFirstRun(
  runs: readonly FirstMovementRun[],
): FirstMovementRun | null {
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const run = runs[i];
    if (run && run.firstRun) return run;
  }
  return null;
}

/**
 * Per-launch capture state. One tracker lives for one JS lifetime: t0 is
 * marked once (first call wins), the first-run flag is stamped once when
 * hydration reveals it, and the capture fires at most once — every later
 * work entry, tick or dispatch is a pure no-op returning null, so nothing
 * downstream can write more than once per launch.
 */
export interface LaunchTracker {
  /** Record t0. Idempotent: only the first call this launch sticks. */
  markLaunch: (nowMs: number) => void;
  /** Stamp whether this launch is a true first run. First call wins. */
  markFirstRun: (isFirstRun: boolean) => void;
  /**
   * Observe a post-dispatch phase kind. Returns the completed run exactly
   * once — on the first "work" phase after t0 was marked — and null
   * forever after. `now` is lazy so ticks never even read a clock.
   */
  captureWorkEntry: (
    phaseKind: PlayerPhase["kind"],
    now: () => number,
  ) => FirstMovementRun | null;
  /** Tests only: back to the never-launched state. */
  reset: () => void;
}

export function createLaunchTracker(): LaunchTracker {
  let t0: number | null = null;
  let firstRun = false;
  let firstRunMarked = false;
  let captured = false;
  return {
    markLaunch: (nowMs) => {
      if (t0 === null) t0 = nowMs;
    },
    markFirstRun: (isFirstRun) => {
      if (firstRunMarked) return;
      firstRunMarked = true;
      firstRun = isFirstRun;
    },
    captureWorkEntry: (phaseKind, now) => {
      if (captured || t0 === null || phaseKind !== "work") return null;
      captured = true;
      const t1 = now();
      return { t0, t1, deltaMs: computeDeltaMs(t0, t1), firstRun };
    },
    reset: () => {
      t0 = null;
      firstRun = false;
      firstRunMarked = false;
      captured = false;
    },
  };
}

/** The app's tracker: one JS lifetime, one t0, at most one capture. */
export const firstMovementTracker = createLaunchTracker();
