// The person sync as the app root runs it (app/_layout.tsx), for suites
// that assert her facts reached analytics. Nothing calls
// syncPersonProperties from a store or a screen any more — person.ts
// watches the stores instead, one way only — so a test that wants the
// person record has to run the subscription the app runs.
//
// Every store a property is read from is marked hydrated first: the sync
// deliberately says nothing until they are, so that an unhydrated store
// can never push a fresh install's values at someone.

import { startPersonSync } from "../analytics/person";
import { useEntitlementStore } from "../state/entitlement-store";
import { useIdentityStore } from "../state/identity-store";
import { useIntentionStore } from "../state/intention-store";
import { useProfileStore } from "../state/profile-store";
import { useSettingsStore } from "../state/settings-store";

/** Start the sync over hydrated stores; the returned function stops it. */
export function startPersonSyncForTest(): () => void {
  const landed = { hydrated: true, hydrationFailed: false };
  useProfileStore.setState(landed);
  useEntitlementStore.setState(landed);
  useIntentionStore.setState(landed);
  useSettingsStore.setState(landed);
  useIdentityStore.setState(landed);
  return startPersonSync();
}
