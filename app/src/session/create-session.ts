// THE engine boundary for session generation. Every call into
// generateSession goes through here — the rest of the app deals only in
// the Session/PlayerBlock shapes, so it stays testable with fixtures
// while the engine implementation lands.

import {
  generateSession,
  type DailyPrompt,
  type History,
  type MovementLibrary,
  type Profile,
  type Session,
} from "@fither/engine";

import { findMovement, loadLibrary } from "./load-library";
import type { PlayerBlock } from "./player-machine";
import { deriveSeed } from "./seed";

export interface CreatedSession {
  session: Session;
  /** Session blocks joined with display info from the movement library. */
  playerBlocks: PlayerBlock[];
}

export type CreateSessionResult =
  | { ok: true; value: CreatedSession }
  | {
      ok: false;
      reason: "notReady" | "noLibrary" | "noSession" | "engineUnavailable";
    };

/** Join generated blocks with movement display data. Display only — no rules. */
export function toPlayerBlocks(
  session: Session,
  library: MovementLibrary,
): PlayerBlock[] {
  return session.blocks.map((b) => {
    const movement = findMovement(library, b.movementId);
    return {
      movementId: b.movementId,
      name: movement?.name ?? b.movementId,
      cues: movement?.cues ?? [],
      unilateral: movement?.unilateral ?? false,
      sets: b.sets,
      amount: b.amount,
      restSeconds: b.restSeconds,
      timingType: movement?.timing.type ?? "reps",
    };
  });
}

export function createSession(
  prompt: DailyPrompt,
  profile: Profile,
  history: History,
  salt: number,
): CreateSessionResult {
  const library = loadLibrary();
  if (!library) return { ok: false, reason: "noLibrary" };
  const seed = deriveSeed(prompt.date, salt);
  try {
    const session = generateSession(library, profile, history, prompt, seed);
    if (session.blocks.length === 0) {
      return { ok: false, reason: "noSession" };
    }
    return {
      ok: true,
      value: { session, playerBlocks: toPlayerBlocks(session, library) },
    };
  } catch {
    // Engine still a contract stub, or an unexpected failure — either way
    // the app degrades calmly instead of crashing (airplane-grade path).
    return { ok: false, reason: "engineUnavailable" };
  }
}
