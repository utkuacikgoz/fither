import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useFirstMovementStore } from "../../../state/first-movement-store";
import { useIdentityStore } from "../../../state/identity-store";
import { useIntentionStore } from "../../../state/intention-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { usePlaceStore } from "../../../state/place-store";
import { useProfileStore } from "../../../state/profile-store";
import { useReminderStore } from "../../../state/reminder-store";
import { useSessionStore } from "../../../state/session-store";
import { useSettingsStore } from "../../../state/settings-store";

// Shared reset for the Settings suite: every store the list and its
// subpages read, hydrated and empty, plus the OS notification mocks
// restated so an override in one test can't leak into the next.

export async function flushPersistence(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** A minimal OS permission response in the shape the adapter reads. */
export function permissionResponse(
  status: "undetermined" | "granted" | "denied",
): Notifications.NotificationPermissionsStatus {
  return {
    status,
    granted: status === "granted",
    canAskAgain: status !== "denied",
    expires: "never",
  } as unknown as Notifications.NotificationPermissionsStatus;
}

export async function resetSettingsStores(): Promise<void> {
  await AsyncStorage.clear();
  useSettingsStore.setState({
    alwaysAvoid: [],
    equipment: ["none", "chair", "wall"],
    voice: false,
    hydrated: true,
    hydrationFailed: false,
  });
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    trialUsed: false,
    hydrated: true,
    hydrationFailed: false,
  });
  useDevReceiptStore.setState({ receipt: null, hydrated: true, hydrationFailed: false });
  useFirstMovementStore.setState({ runs: [], hydrated: true, hydrationFailed: false });
  useCareNoteStore.setState({ entries: [], hydrated: true, hydrationFailed: false });
  useIdentityStore.setState({ identity: null, hydrated: true, hydrationFailed: false });
  useProfileStore.setState({ history: { entries: [] }, hydrated: true, hydrationFailed: false });
  useLedgerStore.setState({ events: [], hydrated: true, hydrationFailed: false });
  useIntentionStore.setState({ target: null, asked: false, hydrated: true, hydrationFailed: false });
  usePlaceStore.setState({
    place: "home",
    presets: {
      home: { equipment: ["none", "chair", "wall"], quiet: "ask" },
      hotel: { equipment: ["none", "wall"], quiet: "ask" },
    },
    hydrated: true,
    hydrationFailed: false,
  });
  useReminderStore.setState({
    asked: false,
    slot: null,
    permissionDenied: false,
    hydrated: true,
    hydrationFailed: false,
  });
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue(permissionResponse("undetermined"));
  jest
    .mocked(Notifications.requestPermissionsAsync)
    .mockResolvedValue(permissionResponse("granted"));
  useSessionStore.setState({
    prompt: null,
    sessionId: null,
    session: null,
    player: null,
    countdownEndsAt: null,
    activeMs: 0,
    workResumedAt: null,
    pendingClose: null,
    finish: null,
    saveFailed: false,
    saving: false,
  });
}
