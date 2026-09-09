// Person properties (events.ts PersonProperties): facts about her, not
// moments, set whole from the stores every time one of them can have
// moved. The stores never call in here — this module watches THEM
// (startPersonSync, started once at the app root), so the dependency
// runs one way only: person.ts imports stores, no store imports
// person.ts. Every value is a closed word or a small number read from
// persisted state; nothing here is derived by a rule of its own —
// entitlement is the monetization policy's word, a completed session is
// the engine's trainedDay. Works offline like everything else:
// setPersonProperties queues and never blocks.
//
// Two guards keep the traffic honest. Nothing is sent before the stores
// backing a property have hydrated — an unhydrated store reads as a
// fresh install and would push a wrong value at her — and nothing is
// sent twice for the same set of values, so a screen's manual
// syncPersonProperties() after a commit and the subscription that saw
// the same commit can never both send.

import { trainedDay } from "@fither/engine";

import { setPersonProperties } from "./analytics";
import type { PersonProperties } from "./events";
import { entitlementStatus } from "../monetization/entitlement";
import { freeSessionsAllowance } from "../monetization/experiment";
import { useEntitlementStore } from "../state/entitlement-store";
import { useIdentityStore } from "../state/identity-store";
import { useIntentionStore } from "../state/intention-store";
import { useProfileStore } from "../state/profile-store";
import { useSettingsStore } from "../state/settings-store";

/** The six person properties as the stores currently hold them. */
export function readPersonProperties(): PersonProperties {
  const entitlement = useEntitlementStore.getState();
  const status = entitlementStatus({
    firstCompletedDate: entitlement.trialStartDate,
    purchase: entitlement.purchase,
    trialUsed: entitlement.trialUsed,
    qualifyingSessions: entitlement.qualifyingSessions,
    freeSessions: freeSessionsAllowance(),
  });
  const entries = useProfileStore.getState().history.entries;
  const last = entries[entries.length - 1];
  const { target } = useIntentionStore.getState();
  return {
    entitlement:
      status === "purchased"
        ? entitlement.purchase?.trial
          ? "trial"
          : "active"
        : status === "trialExpired"
          ? "lapsed"
          : "free",
    sessions_completed: entries.filter((entry) => trainedDay(entry)).length,
    last_minutes: last?.minutes ?? null,
    intention: target === 2 ? "two" : target === 3 ? "three" : "none",
    voice: useSettingsStore.getState().voice,
    signed_in: useIdentityStore.getState().identity?.kind === "apple",
  };
}

/** The last set actually handed to the port, or null if none since the sync started. */
let sent: PersonProperties | null = null;

/**
 * Every store a property is read from has landed from disk. The same
 * per-store `hydrated` flag the route guard and the launch surface wait
 * on — an unhydrated store reads as a fresh install, and a fresh
 * install's values are exactly the wrong thing to send about someone
 * who has trained for months.
 */
function backingStoresHydrated(): boolean {
  return (
    useProfileStore.getState().hydrated &&
    useEntitlementStore.getState().hydrated &&
    useIntentionStore.getState().hydrated &&
    useSettingsStore.getState().hydrated &&
    useIdentityStore.getState().hydrated
  );
}

/** Same six values (all primitives, so a shallow compare is the whole story). */
function samePerson(a: PersonProperties, b: PersonProperties): boolean {
  return (Object.keys(a) as (keyof PersonProperties)[]).every(
    (key) => a[key] === b[key],
  );
}

/**
 * Send the whole set, unless the stores behind it have not hydrated or
 * the values are the ones already sent. Guarded by the port: it can
 * only ever lose the update.
 */
export function syncPersonProperties(): void {
  if (!backingStoresHydrated()) return;
  const next = readPersonProperties();
  if (sent && samePerson(sent, next)) return;
  sent = next;
  setPersonProperties(next);
}

/**
 * Watch every store a person property is read from and send the set
 * whenever it actually changes — including the moment the last of them
 * hydrates, which is what puts her facts in before the first screen.
 * Started once at the app root; the returned function detaches every
 * subscription and forgets what was sent, so a restart sends again.
 */
export function startPersonSync(): () => void {
  const unsubscribes = [
    useProfileStore.subscribe(syncPersonProperties),
    useEntitlementStore.subscribe(syncPersonProperties),
    useIntentionStore.subscribe(syncPersonProperties),
    useSettingsStore.subscribe(syncPersonProperties),
    useIdentityStore.subscribe(syncPersonProperties),
  ];
  // Stores already hydrated when the root mounts (a remount, or a fast
  // disk) would otherwise wait for an unrelated change.
  syncPersonProperties();
  return () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
    sent = null;
  };
}
