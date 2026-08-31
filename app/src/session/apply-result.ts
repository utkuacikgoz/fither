// The engine boundary for applying a finished session. Profile, history
// and ledger changes come ONLY from the engine's ApplyResult — the app
// never derives progression itself.

import {
  applySessionResult,
  type ApplyResult,
  type History,
  type Profile,
  type SessionResult,
} from "@fither/engine";

import { loadLibrary } from "./load-library";

export type ApplySessionOutcome =
  | { ok: true; value: ApplyResult }
  | { ok: false; reason: "noLibrary" | "engineUnavailable" };

export function applyResult(
  profile: Profile,
  history: History,
  result: SessionResult,
): ApplySessionOutcome {
  const library = loadLibrary();
  if (!library) return { ok: false, reason: "noLibrary" };
  try {
    return { ok: true, value: applySessionResult(library, profile, history, result) };
  } catch {
    return { ok: false, reason: "engineUnavailable" };
  }
}
