import type {
  DailyPrompt,
  History,
  MovementLibrary,
  Profile,
  Session,
} from "./types.js";

// Contract stub (ADR-0004): engine-engineer replaces the body per
// engine-spec.md. Pure: no IO, no clock, no Math.random.
export function generateSession(
  library: MovementLibrary,
  profile: Profile,
  history: History,
  prompt: DailyPrompt,
  seed: number,
): Session {
  void library;
  void profile;
  void history;
  void prompt;
  void seed;
  throw new Error("generateSession: not implemented yet");
}
