// Person properties (events.ts PersonProperties): facts about her, not
// moments, set whole from the stores every time one of them can have
// moved — after a session commits, after the store answers a purchase
// or restore, after the voice and intention asks, and once at launch
// when the stores have hydrated. Every value is a closed word or a
// small number read from persisted state; nothing here is derived by
// a rule of its own — entitlement is the monetization policy's word,
// a completed session is the engine's trainedDay. Works offline like
// everything else: setPersonProperties queues and never blocks.

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

/** Send the whole set. Guarded by the port: it can only ever lose the update. */
export function syncPersonProperties(): void {
  setPersonProperties(readPersonProperties());
}
