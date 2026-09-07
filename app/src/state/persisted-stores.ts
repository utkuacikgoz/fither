// Every persisted store in the app, in one place, so the two things that
// must know all of them — the dev first-run reset (Gate 3) and her own
// "erase everything" in Settings — cannot drift apart. KEEP IN SYNC: when
// a new persisted store lands, add it here; the dev-reset test pins the
// resulting key list, so a missed store fails loudly. Today:
//   fither/profile-v1         profile-store.ts        profile + history
//   fither/ledger-v1          ledger-store.ts         points events
//   fither/settings-v1        settings-store.ts       onboarding flag, equipment, avoid list, salt, voice
//   fither/entitlement-v1     entitlement-store.ts    first completion + purchase + trialUsed
//   fither/dev-billing-v1     dev-billing.ts          the dev fake receipt
//   fither/active-session-v1  active-session-store.ts crash-safe session snapshot
//   fither/first-movement-v1  first-movement-store.ts Gate 3 timing recordings
//   fither/care-notes-v1      care-note-store.ts      local-only heavy-day notes
//   fither/identity-v1        identity-store.ts       how she continues (ADR-0011)
//   fither/dev-auth-v1        auth/dev-auth.ts        the dev fake provider session
//   fither/reminders-v1       reminder-store.ts       the daily invitation's slot + asked flag
//   fither/lifetime-offer-v1  lifetime-offer-store.ts the one lifetime ask (ADR-0014)
//   fither/rating-v1          rating-store.ts         the rating prompt's bookkeeping
//   fither/experiments-v1     experiment-store.ts     the experiment seed + assignments (ADR-0025)

import type { StoreApi } from "zustand";

import { useDevAuthSessionStore } from "../auth/dev-auth";
import { useDevReceiptStore } from "../monetization/dev-billing";
import { useActiveSessionStore } from "./active-session-store";
import { useCareNoteStore } from "./care-note-store";
import { useEntitlementStore } from "./entitlement-store";
import { useExperimentStore } from "./experiment-store";
import { useFeedbackStore } from "./feedback-store";
import { useFirstMovementStore } from "./first-movement-store";
import { useIdentityStore } from "./identity-store";
import { useLedgerStore } from "./ledger-store";
import { useLifetimeOfferStore } from "./lifetime-offer-store";
import { useProfileStore } from "./profile-store";
import { useRatingStore } from "./rating-store";
import { useReminderStore } from "./reminder-store";
import { useSettingsStore } from "./settings-store";

export const persistedStores = [
  useProfileStore,
  useLedgerStore,
  useSettingsStore,
  useEntitlementStore,
  useDevReceiptStore,
  useActiveSessionStore,
  useFirstMovementStore,
  useCareNoteStore,
  useIdentityStore,
  useDevAuthSessionStore,
  useReminderStore,
  useLifetimeOfferStore,
  useRatingStore,
  useFeedbackStore,
  useExperimentStore,
] as const;

/** The persisted keys, read from the stores' own persist configs. */
export function persistedKeys(): string[] {
  return persistedStores
    .map((store) => store.persist.getOptions().name)
    .filter((name): name is string => typeof name === "string");
}

/** The two flags every persisted store carries. */
export interface HydratedState {
  hydrated: boolean;
  hydrationFailed: boolean;
}

/**
 * The same stores seen through the one shape shared by all of them. Each
 * store's setState is typed to its own state, so over the union the
 * signatures are not callable together; the erase and the tests only
 * ever touch these two flags plus getInitialState.
 */
export const hydratedStores = persistedStores as unknown as readonly StoreApi<HydratedState>[];
