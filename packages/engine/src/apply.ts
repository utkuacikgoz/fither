import type {
  ApplyResult,
  History,
  MovementLibrary,
  Profile,
  SessionResult,
} from "./types.js";

// Contract stub (ADR-0004): engine-engineer replaces the body per
// engine-spec.md (advance at 3 clean, volume drop at 2 struggled,
// regress at 3, absence never regresses, append-only ledger).
export function applySessionResult(
  library: MovementLibrary,
  profile: Profile,
  history: History,
  result: SessionResult,
): ApplyResult {
  void library;
  void profile;
  void history;
  void result;
  throw new Error("applySessionResult: not implemented yet");
}
