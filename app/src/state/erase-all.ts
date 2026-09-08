// "Erase everything on this phone" — the account-deletion path App
// Review requires once Sign in with Apple exists (guideline 5.1.1(v)),
// and the honest end of the local-only account (ADR-0011: identity keeps
// her place here, nothing more). There is no server, so erasing the
// phone IS the deletion.
//
// Unlike the dev first-run reset (dev-reset.ts), which wipes disk and
// relies on a relaunch, this runs in a live app: every persisted store
// is returned to the initial state it declared at creation — zustand's
// own getInitialState, so no store's initial shape is duplicated here —
// and marked hydrated, because there is nothing left to load. The
// session store is cleared through its own reset. Each outside call
// (provider, notifications, analytics) is best-effort: none of them may
// stop the wipe.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getAnalytics, track } from "../analytics/analytics";
import { getAuth } from "../auth/auth";
import { getBilling } from "../monetization/billing";
import { getNotifications } from "../notifications/notifications";
import { hydratedStores, persistedKeys } from "./persisted-stores";
import { useSessionStore } from "./session-store";

async function quietly(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch {
    // Best-effort by design: the erase itself never depends on it.
  }
}

export async function eraseEverything(): Promise<void> {
  await quietly(() => getAuth().signOut());
  await quietly(() => getNotifications().cancelAll());
  useSessionStore.getState().resetSession();
  for (const store of hydratedStores) {
    store.setState({
      ...store.getInitialState(),
      hydrated: true,
      hydrationFailed: false,
    });
  }
  await quietly(() => AsyncStorage.multiRemove(persistedKeys()));
  // The churn signal goes out under her id, then the id itself goes.
  track("account_action", { action: "erase" });
  getAnalytics().reset();
  await quietly(() => getBilling().clearUser());
}
