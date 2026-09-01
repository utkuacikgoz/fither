import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, waitFor } from "@testing-library/react-native";
import React from "react";

import { createInitialProfile } from "@fither/engine";

import { strings } from "../../copy/strings";
import { firstMovementTracker } from "../../lib/first-movement-timer";
import { useDevReceiptStore } from "../../monetization/dev-billing";
import { LaunchScreen } from "../../screens/launch/launch-screen";
import { useActiveSessionStore } from "../active-session-store";
import { devPersistedKeys, wipeAllPersistedStateForDev } from "../dev-reset";
import { useEntitlementStore } from "../entitlement-store";
import { useFirstMovementStore } from "../first-movement-store";
import { useLedgerStore } from "../ledger-store";
import { useProfileStore } from "../profile-store";
import { useSessionStore } from "../session-store";
import { useSettingsStore } from "../settings-store";

// The Gate 3 tester-handover reset (state/dev-reset.ts): wipes at the
// persistence layer, never through store actions — profile and ledger
// APIs stay append-only/engine-mutated. A relaunch after the wipe must be
// indistinguishable from a first-ever install.

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** A previous tester's session: history, points, trial, receipt, the lot. */
function seedPreviousTester() {
  useSettingsStore.getState().completeOnboarding(["none", "chair"], ["wrists"]);
  useProfileStore.setState({
    history: {
      entries: [
        {
          date: "2026-08-01",
          minutes: 10,
          blocks: [
            { movementId: "plank", pattern: "core", outcome: "completed" },
          ],
        },
      ],
    },
  });
  useLedgerStore
    .getState()
    .append([{ type: "session", points: 20, date: "2026-08-01" }]);
  useEntitlementStore.getState().markSessionCompleted("2026-08-01");
  useDevReceiptStore.getState().setReceipt({ plan: "annual", date: "2026-08-01" });
  useFirstMovementStore.getState().record({
    t0: 1_756_700_000_000,
    t1: 1_756_700_042_500,
    deltaMs: 42_500,
    firstRun: true,
  });
}

/**
 * A relaunch, as tests simulate it everywhere in this repo: the JS process
 * dies (in-memory state resets to each store's initial shape), then every
 * store rehydrates from whatever disk holds.
 */
async function simulateRelaunch() {
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: false,
    hydrationFailed: false,
  });
  useLedgerStore.setState({ events: [], hydrated: false, hydrationFailed: false });
  useSettingsStore.setState({
    equipment: ["none", "chair", "wall"],
    onboardingCompleted: false,
    alwaysAvoid: [],
    hydrated: false,
    hydrationFailed: false,
  });
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    hydrated: false,
    hydrationFailed: false,
  });
  useDevReceiptStore.setState({
    receipt: null,
    hydrated: false,
    hydrationFailed: false,
  });
  useActiveSessionStore.setState({
    snapshot: null,
    hydrated: false,
    hydrationFailed: false,
  });
  useFirstMovementStore.setState({
    runs: [],
    hydrated: false,
    hydrationFailed: false,
  });
  await Promise.all([
    useProfileStore.persist.rehydrate(),
    useLedgerStore.persist.rehydrate(),
    useSettingsStore.persist.rehydrate(),
    useEntitlementStore.persist.rehydrate(),
    useDevReceiptStore.persist.rehydrate(),
    useActiveSessionStore.persist.rehydrate(),
    useFirstMovementStore.persist.rehydrate(),
  ]);
  await flushPersistence();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await simulateRelaunch();
  useSessionStore.setState({
    prompt: null,
    session: null,
    player: null,
    finish: null,
    saveFailed: false,
  });
});

describe("dev first-run reset (persistence-layer wipe)", () => {
  it("enumerates every persisted key, straight from the persist configs", () => {
    expect(devPersistedKeys().sort()).toEqual(
      [
        "fither/profile-v1",
        "fither/ledger-v1",
        "fither/settings-v1",
        "fither/entitlement-v1",
        "fither/dev-billing-v1",
        "fither/active-session-v1",
        "fither/first-movement-v1",
        "fither/care-notes-v1",
      ].sort(),
    );
  });

  it("wipes every fither/* key from storage — nothing persisted survives", async () => {
    seedPreviousTester();
    await flushPersistence();
    const seededKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith("fither/"),
    );
    expect(seededKeys.length).toBeGreaterThan(0);

    await wipeAllPersistedStateForDev();

    // Drift guard: if a store ever persists under a key dev-reset does not
    // know, this catches it the day the store first writes in a test.
    const survivors = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith("fither/"),
    );
    expect(survivors).toEqual([]);
  });

  it("after reset + relaunch the app is a first-ever install again", async () => {
    seedPreviousTester();
    await flushPersistence();

    await wipeAllPersistedStateForDev();
    await simulateRelaunch();

    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
    expect(useProfileStore.getState().history.entries).toEqual([]);
    expect(useLedgerStore.getState().events).toEqual([]);
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(useDevReceiptStore.getState().receipt).toBeNull();
    expect(useFirstMovementStore.getState().runs).toEqual([]);
  });

  it("the next launch is onboarded and records as a first run", async () => {
    seedPreviousTester();
    await flushPersistence();
    await wipeAllPersistedStateForDev();
    await simulateRelaunch();

    const screen = render(
      <LaunchScreen
        onSessionReady={jest.fn()}
        onResumeSession={jest.fn()}
        onResumeFinished={jest.fn()}
      />,
    );
    // First-ever-open branch: onboarding, not the prompt or the paywall.
    await waitFor(() =>
      expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy(),
    );
    // The launch stamped this lifetime's tracker as a true first run — a
    // first work-phase entry would be recorded as THE Gate 3 number.
    const run = firstMovementTracker.captureWorkEntry("work", () => Date.now());
    expect(run).not.toBeNull();
    expect(run?.firstRun).toBe(true);
  });
});
