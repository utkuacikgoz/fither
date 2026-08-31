// The session player's state machine. PURE TypeScript: no React, no
// timers, no IO. The screen owns a 1-second interval and feeds "tick"
// events; everything else is deterministic transitions over this module.
//
// Flow per block: intro → work (set) → rest → work … → feedback → next
// block intro → … → done. Feedback maps the one calm question ("How was
// that?") to the engine's BlockOutcome; skip is available anywhere inside
// a block and records "skipped" for that block.

import type { BlockOutcome } from "@fither/engine";

export interface PlayerBlock {
  movementId: string;
  /** Display name resolved from the movement library at session creation. */
  name: string;
  /** One cue line, from the movement's cues. */
  cue: string;
  sets: number;
  /** Reps per set, or hold seconds per set, per timingType. */
  amount: number;
  restSeconds: number;
  timingType: "reps" | "seconds";
}

export type PlayerPhase =
  | { kind: "blockIntro"; blockIndex: number }
  | {
      kind: "work";
      blockIndex: number;
      setIndex: number;
      /** Countdown for hold work; null for rep work (user advances). */
      remainingSeconds: number | null;
    }
  | { kind: "rest"; blockIndex: number; setIndex: number; remainingSeconds: number }
  | { kind: "feedback"; blockIndex: number }
  | { kind: "done" };

export interface PlayerState {
  blocks: PlayerBlock[];
  phase: PlayerPhase;
  /** One outcome per concluded block, in block order. Complete at "done". */
  outcomes: BlockOutcome[];
}

export type PlayerEvent =
  | { type: "begin" }
  | { type: "advance" }
  | { type: "tick" }
  | { type: "feedback"; outcome: Extract<BlockOutcome, "completed" | "struggled"> }
  | { type: "skipBlock" };

export function createPlayer(blocks: PlayerBlock[]): PlayerState {
  return {
    blocks,
    phase: blocks.length === 0 ? { kind: "done" } : { kind: "blockIntro", blockIndex: 0 },
    outcomes: [],
  };
}

function block(state: PlayerState, index: number): PlayerBlock {
  const b = state.blocks[index];
  if (!b) throw new Error(`player-machine: no block at index ${index}`);
  return b;
}

function startWork(state: PlayerState, blockIndex: number, setIndex: number): PlayerPhase {
  const b = block(state, blockIndex);
  return {
    kind: "work",
    blockIndex,
    setIndex,
    remainingSeconds: b.timingType === "seconds" ? b.amount : null,
  };
}

function nextBlockPhase(state: PlayerState, finishedBlockIndex: number): PlayerPhase {
  const next = finishedBlockIndex + 1;
  return next >= state.blocks.length
    ? { kind: "done" }
    : { kind: "blockIntro", blockIndex: next };
}

function afterSet(state: PlayerState, blockIndex: number, setIndex: number): PlayerPhase {
  const b = block(state, blockIndex);
  if (setIndex + 1 < b.sets) {
    return b.restSeconds > 0
      ? { kind: "rest", blockIndex, setIndex, remainingSeconds: b.restSeconds }
      : startWork(state, blockIndex, setIndex + 1);
  }
  // Last set done: the one calm question, no trailing rest.
  return { kind: "feedback", blockIndex };
}

export function reduce(state: PlayerState, event: PlayerEvent): PlayerState {
  const { phase } = state;

  if (phase.kind === "done") return state;

  if (event.type === "skipBlock") {
    if (phase.kind === "feedback") return state; // answer the question instead
    const blockIndex = phase.blockIndex;
    return {
      ...state,
      outcomes: [...state.outcomes, "skipped"],
      phase: nextBlockPhase(state, blockIndex),
    };
  }

  switch (phase.kind) {
    case "blockIntro": {
      if (event.type === "begin") {
        return { ...state, phase: startWork(state, phase.blockIndex, 0) };
      }
      return state;
    }
    case "work": {
      if (event.type === "advance" && phase.remainingSeconds === null) {
        // Rep work: she tells us the set is done.
        return { ...state, phase: afterSet(state, phase.blockIndex, phase.setIndex) };
      }
      if (event.type === "tick" && phase.remainingSeconds !== null) {
        const remaining = phase.remainingSeconds - 1;
        if (remaining <= 0) {
          return { ...state, phase: afterSet(state, phase.blockIndex, phase.setIndex) };
        }
        return { ...state, phase: { ...phase, remainingSeconds: remaining } };
      }
      return state;
    }
    case "rest": {
      if (event.type === "tick") {
        const remaining = phase.remainingSeconds - 1;
        if (remaining <= 0) {
          return { ...state, phase: startWork(state, phase.blockIndex, phase.setIndex + 1) };
        }
        return { ...state, phase: { ...phase, remainingSeconds: remaining } };
      }
      if (event.type === "advance") {
        // Ending rest early is allowed; rest is hers, never enforced.
        return { ...state, phase: startWork(state, phase.blockIndex, phase.setIndex + 1) };
      }
      return state;
    }
    case "feedback": {
      if (event.type === "feedback") {
        return {
          ...state,
          outcomes: [...state.outcomes, event.outcome],
          phase: nextBlockPhase(state, phase.blockIndex),
        };
      }
      return state;
    }
  }
}

// ---------- Selectors (display math only; no rules) ----------

export function totalSets(state: PlayerState): number {
  return state.blocks.reduce((sum, b) => sum + b.sets, 0);
}

/** Sets fully finished so far — drives the thin progress line. */
export function completedSets(state: PlayerState): number {
  const { phase } = state;
  if (phase.kind === "done") return totalSets(state);
  const before = state.blocks
    .slice(0, phase.kind === "blockIntro" ? phase.blockIndex : phase.blockIndex)
    .reduce((sum, b) => sum + b.sets, 0);
  switch (phase.kind) {
    case "blockIntro":
      return before;
    case "work":
      return before + phase.setIndex;
    case "rest":
      return before + phase.setIndex + 1;
    case "feedback":
      return before + block(state, phase.blockIndex).sets;
  }
}

export function progressFraction(state: PlayerState): number {
  const total = totalSets(state);
  return total === 0 ? 1 : completedSets(state) / total;
}

/** True while the phase counts down and the screen should tick each second. */
export function isCountingDown(state: PlayerState): boolean {
  const { phase } = state;
  return (
    phase.kind === "rest" ||
    (phase.kind === "work" && phase.remainingSeconds !== null)
  );
}

export function isFinished(state: PlayerState): boolean {
  return state.phase.kind === "done";
}
