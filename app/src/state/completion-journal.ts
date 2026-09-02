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
  trialStartDate: string;
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
    AsyncStorage.setItem(
      ENTITLEMENT_STORAGE_KEY,
      persisted({ trialStartDate: record.trialStartDate, purchase: record.purchase }),
    ),
  ]);
}

export function clearPersistedActiveSession(): Promise<void> {
  return AsyncStorage.setItem(
    ACTIVE_SESSION_STORAGE_KEY,
    persisted({ snapshot: null }),
  );
}
