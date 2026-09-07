import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { createInitialProfile } from "@fither/engine";

import { recordedEvents, clearRecordedEvents } from "../../analytics/dev-analytics";
import { useDevAuthSessionStore } from "../../auth/dev-auth";
import { useDevReceiptStore } from "../../monetization/dev-billing";
import { fixturePrompt } from "../../test-utils/fixtures";
import { eraseEverything } from "../erase-all";
import { useEntitlementStore } from "../entitlement-store";
import { useIdentityStore } from "../identity-store";
import { useIntentionStore } from "../intention-store";
import { useLedgerStore } from "../ledger-store";
import { hydratedStores } from "../persisted-stores";
import { useProfileStore } from "../profile-store";
import { useReminderStore } from "../reminder-store";
import { useSessionStore } from "../session-store";
import { useSettingsStore } from "../settings-store";

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Her whole life on the phone: identity, onboarding, history, points, a purchase, a schedule. */
async function seedHer() {
  await useIdentityStore.getState().continueAsGuest();
  useSettingsStore.getState().completeOnboarding(["none", "chair"], ["wrists"]);
  useProfileStore.setState({
    profile: { ...createInitialProfile(), patterns: { ...createInitialProfile().patterns } },
    history: {
      entries: [
        {
          date: "2026-08-01",
          minutes: 10,
          blocks: [{ movementId: "plank", pattern: "core", outcome: "completed" }],
        },
      ],
    },
  });
  useLedgerStore.setState({
    events: [{ type: "session", points: 20, date: "2026-08-01" }],
  });
  await useEntitlementStore.getState().purchasePlan("annual");
  useEntitlementStore.getState().recordQualifyingSession("her:1", "2026-08-01");
  useReminderStore.setState({ slot: "morning", asked: true });
  useIntentionStore.getState().setTarget(3);
  await flushPersistence();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  clearRecordedEvents();
  for (const store of hydratedStores) {
    store.setState({ hydrated: true, hydrationFailed: false });
  }
});

describe("eraseEverything", () => {
  it("returns every persisted store to its initial state, hydrated, and empties the disk", async () => {
    await seedHer();
    expect(useIdentityStore.getState().identity).not.toBeNull();
    expect((await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("fither/")).length)
      .toBeGreaterThan(0);

    await eraseEverything();

    expect(useIdentityStore.getState().identity).toBeNull();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    expect(useProfileStore.getState().history.entries).toEqual([]);
    expect(useLedgerStore.getState().events).toEqual([]);
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
    expect(useEntitlementStore.getState().trialUsed).toBe(false);
    expect(useReminderStore.getState().slot).toBeNull();
    expect(useReminderStore.getState().asked).toBe(false);
    expect(useIntentionStore.getState().target).toBeNull();
    expect(useIntentionStore.getState().asked).toBe(false);
    // Live app, not a relaunch: every store must still read as hydrated,
    // or the route guards would wait forever on an empty disk.
    for (const store of hydratedStores) {
      expect(store.getState().hydrated).toBe(true);
      expect(store.getState().hydrationFailed).toBe(false);
    }
    // Any write the reset itself triggered has settled; nothing of hers
    // survives on disk. (The stores may re-persist their initial shape,
    // which is exactly what a first install would hold.)
    await flushPersistence();
    const survivors = await AsyncStorage.multiGet(
      (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("fither/")),
    );
    for (const [, value] of survivors) {
      expect(value ?? "").not.toContain("2026-08-01");
      expect(value ?? "").not.toContain("annual");
      expect(value ?? "").not.toContain("guest");
    }
  });

  it("signs out at the provider, cancels the invitation, clears the session, resets analytics", async () => {
    await seedHer();
    // The dev provider remembers a session of its own; the erase reaches it.
    expect(useDevAuthSessionStore.getState().session).not.toBeNull();
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().dispatchPlayer({ type: "begin" });
    // The seed's trial_start and this workout_start are on the record.
    expect(recordedEvents()).toHaveLength(2);

    await eraseEverything();

    expect(useDevAuthSessionStore.getState().session).toBeNull();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(useSessionStore.getState().session).toBeNull();
    expect(recordedEvents()).toEqual([]);
  });

  it("finishes the wipe even when the provider or the OS refuse", async () => {
    await seedHer();
    jest
      .mocked(Notifications.cancelAllScheduledNotificationsAsync)
      .mockRejectedValueOnce(new Error("os"));
    await expect(eraseEverything()).resolves.toBeUndefined();
    expect(useIdentityStore.getState().identity).toBeNull();
    expect(useProfileStore.getState().history.entries).toEqual([]);
  });
});
