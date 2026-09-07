import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ApplyResult, LedgerEvent } from "@fither/engine";

import type { PurchaseRecord } from "../monetization/billing";

export const COMPLETION_STORAGE_KEY = "fither/completion-v1";
const PROFILE_STORAGE_KEY = "fither/profile-v1";
const LEDGER_STORAGE_KEY = "fither/ledger-v1";
const ENTITLEMENT_STORAGE_KEY = "fither/entitlement-v1";
const ACTIVE_SESSION_STORAGE_KEY = "fither/active-session-v1";

export interface CompletionRecord {
  version: 1;
  status: "pending" | "committed";
  sessionId: string;
  result: ApplyResult;
  ledgerEvents: LedgerEvent[];
  /**
   * The trial decision AS JOURNALED (ADR-0009 §2): null when no trial had
   * started and this session completed nothing — an all-skipped first
   * session spends no trial. Replaying the record replays this stored
   * decision verbatim, never re-deriving it from ambient state.
   */
  trialStartDate: string | null;
  purchase: PurchaseRecord | null;
}

function persisted(state: object): string {
  return JSON.stringify({ state, version: 0 });
}

export async function readCompletionRecord(): Promise<CompletionRecord | null> {
  const raw = await AsyncStorage.getItem(COMPLETION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CompletionRecord;
    return value.version === 1 ? value : null;
  } catch {
    return null;
  }
}

export function writeCompletionRecord(record: CompletionRecord): Promise<void> {
  return AsyncStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(record));
}

/** Converge every canonical store on the exact journaled result. */
export async function persistCanonicalCompletion(
  record: CompletionRecord,
): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(
      PROFILE_STORAGE_KEY,
      persisted({ profile: record.result.profile, history: record.result.history }),
    ),
    AsyncStorage.setItem(LEDGER_STORAGE_KEY, persisted({ events: record.ledgerEvents })),
    // The canonical write keeps every other persisted entitlement field
    // (trialUsed, the free-session count, ADR-0025) exactly as it was on
    // disk: a crash between this write and the store's own must not
    // reset a consumed allowance.
    persistedEntitlement().then((existing) =>
      AsyncStorage.setItem(
        ENTITLEMENT_STORAGE_KEY,
        persisted({ ...existing, trialStartDate: record.trialStartDate, purchase: record.purchase }),
      ),
    ),
  ]);
}

/** The entitlement key's current persisted state, or {} when absent or unreadable. */
async function persistedEntitlement(): Promise<Record<string, unknown>> {
  try {
    const raw = await AsyncStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    const state = (parsed as { state?: unknown } | null)?.state;
    return state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function clearPersistedActiveSession(): Promise<void> {
  return AsyncStorage.setItem(
    ACTIVE_SESSION_STORAGE_KEY,
    persisted({ snapshot: null }),
  );
}
