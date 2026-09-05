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

import { getAnalytics } from "../analytics/analytics";
import { persistedKeys } from "./persisted-stores";

// The store list lives in persisted-stores.ts, shared with her own
// "erase everything" (state/erase-all.ts) so the two can never disagree.

/** The persisted keys, read from the stores' own persist configs. */
export function devPersistedKeys(): string[] {
  return persistedKeys();
}

/**
 * Wipe every persisted key. Disk only — in-memory store state is
 * intentionally untouched (see the header comment); the tester must kill
 * and relaunch the app immediately, before anything writes again.
 */
export async function wipeAllPersistedStateForDev(): Promise<void> {
  await AsyncStorage.multiRemove(devPersistedKeys());
  // The next tester is a new anonymous id in analytics too.
  getAnalytics().reset();
}
