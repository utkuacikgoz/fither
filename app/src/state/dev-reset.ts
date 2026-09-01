// DEV-ONLY full first-run reset (Gate 3 protocol): successive testers on
// one phone, each measured as a true first run. The profile and ledger
// store APIs are append-only / engine-mutated by design — reviewed
// invariants — so this reset deliberately does NOT go through store
// actions. It wipes at the persistence layer (AsyncStorage) and relies on
// the tester killing and relaunching the app: the fresh process hydrates
// every store from now-empty storage straight into its initial state.
//
// Why kill-and-relaunch instead of in-place rehydration: zustand-persist's
// rehydrate() on a missing key performs no merge and leaves the current
// in-memory state untouched, so a live process would keep showing the
// previous tester's profile/ledger until it dies — and rebuilding initial
// state here would both duplicate the stores' initial-state definitions
// and amount to exactly the reset actions the store invariants forbid. A
// fresh process is also required by the measurement itself:
// firstMovementTracker marks t0 once per JS lifetime, so only a cold open
// yields an honest open-to-first-movement number.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useDevReceiptStore } from "../monetization/dev-billing";
import { useActiveSessionStore } from "./active-session-store";
import { useCareNoteStore } from "./care-note-store";
import { useEntitlementStore } from "./entitlement-store";
import { useFirstMovementStore } from "./first-movement-store";
import { useLedgerStore } from "./ledger-store";
import { useProfileStore } from "./profile-store";
import { useSettingsStore } from "./settings-store";

// Every persisted store in the app. KEEP IN SYNC: when a new persisted
// store lands, add it here (the dev-reset test pins the resulting key
// list, so a stale entry or a missed key fails loudly). Today that is:
//   fither/profile-v1         profile-store.ts        profile + history
//   fither/ledger-v1          ledger-store.ts         points events
//   fither/settings-v1        settings-store.ts       onboarding flag, equipment, avoid list, salt
//   fither/entitlement-v1     entitlement-store.ts    trial start + purchase
//   fither/dev-billing-v1     dev-billing.ts          the dev fake receipt
//   fither/active-session-v1  active-session-store.ts crash-safe session snapshot
//   fither/first-movement-v1  first-movement-store.ts Gate 3 timing recordings
//   fither/care-notes-v1      care-note-store.ts      local-only heavy-day notes
const persistedStores = [
  useProfileStore,
  useLedgerStore,
  useSettingsStore,
  useEntitlementStore,
  useDevReceiptStore,
  useActiveSessionStore,
  useFirstMovementStore,
  useCareNoteStore,
] as const;

/** The persisted keys, read from the stores' own persist configs. */
export function devPersistedKeys(): string[] {
  return persistedStores
    .map((store) => store.persist.getOptions().name)
    .filter((name): name is string => typeof name === "string");
}

/**
 * Wipe every persisted key. Disk only — in-memory store state is
 * intentionally untouched (see the header comment); the tester must kill
 * and relaunch the app immediately, before anything writes again.
 */
export async function wipeAllPersistedStateForDev(): Promise<void> {
  await AsyncStorage.multiRemove(devPersistedKeys());
}
