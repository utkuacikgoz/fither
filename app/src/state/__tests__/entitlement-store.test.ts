import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearRecordedEvents, recordedEvents, recordedPerson } from "../../analytics/dev-analytics";
import { useDevReceiptStore } from "../../monetization/dev-billing";
import { entitlementStatus } from "../../monetization/entitlement";
import { FREE_SESSIONS_EXPERIMENT } from "../../monetization/experiment";
import { migrateEntitlement, useEntitlementStore } from "../entitlement-store";

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  clearRecordedEvents();
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    trialUsed: false,
    qualifyingSessions: 0,
    lastQualifyingSessionId: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useDevReceiptStore.setState({
    receipt: null,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("entitlement store", () => {
  it("stamps the trial start once — later completions count but never move it", () => {
    const { recordQualifyingSession } = useEntitlementStore.getState();
    recordQualifyingSession("s1", "2026-08-31");
    recordQualifyingSession("s2", "2026-09-02");
    expect(useEntitlementStore.getState().trialStartDate).toBe("2026-08-31");
    expect(useEntitlementStore.getState().qualifyingSessions).toBe(2);
  });

  it("purchasePlan grants instantly through dev billing and persists", async () => {
    const granted = await useEntitlementStore.getState().purchasePlan("annual");
    expect(granted).toBe("purchased");
    expect(useEntitlementStore.getState().purchase).toMatchObject({
      plan: "annual",
    });

    // Simulated relaunch: capture what storage holds, wipe the in-memory
    // state (which also rewrites storage), put the captured value back,
    // and rehydrate — the grant must come back from disk alone.
    await flushPersistence();
    const persisted = await AsyncStorage.getItem("fither/entitlement-v1");
    expect(persisted).toContain("annual");
    useEntitlementStore.setState({
      trialStartDate: null,
      purchase: null,
      hydrated: false,
      hydrationFailed: false,
    });
    await flushPersistence();
    await AsyncStorage.setItem("fither/entitlement-v1", persisted ?? "");
    await useEntitlementStore.persist.rehydrate();
    await flushPersistence();
    const state = useEntitlementStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.purchase).toMatchObject({ plan: "annual" });
  });

  it("dev reset clears the app-side entitlement but not the dev receipt", async () => {
    await useEntitlementStore.getState().purchasePlan("monthly");
    useEntitlementStore.getState().recordQualifyingSession("s1", "2026-08-31");

    useEntitlementStore.getState().resetForDev();
    const state = useEntitlementStore.getState();
    expect(state.purchase).toBeNull();
    expect(state.trialStartDate).toBeNull();
    expect(state.qualifyingSessions).toBe(0);
    expect(state.lastQualifyingSessionId).toBeNull();
    // The fake store account still remembers — that's what restore is for.
    expect(useDevReceiptStore.getState().receipt).toMatchObject({
      plan: "monthly",
    });
  });

  it("restore re-grants from the dev receipt after a reset", async () => {
    await useEntitlementStore.getState().purchasePlan("annual");
    useEntitlementStore.getState().resetForDev();

    const restored = await useEntitlementStore.getState().restorePurchases();
    expect(restored).toBe("restored");
    expect(useEntitlementStore.getState().purchase).toMatchObject({
      plan: "annual",
    });
  });

  it("restore with nothing to restore says 'empty', not 'failed', and grants nothing", async () => {
    const restored = await useEntitlementStore.getState().restorePurchases();
    expect(restored).toBe("empty");
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("restore reports an actual failure as 'failed'", async () => {
    // The dev port's failure path: the receipt store's hydration failed.
    useDevReceiptStore.setState({ hydrated: false, hydrationFailed: true });
    const restored = await useEntitlementStore.getState().restorePurchases();
    expect(restored).toBe("failed");
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("restore waits for the receipt store to hydrate before answering", async () => {
    useDevReceiptStore.setState({ hydrated: false, receipt: null });
    const pending = useEntitlementStore.getState().restorePurchases();

    useDevReceiptStore.setState({
      hydrated: true,
      receipt: { plan: "annual", date: "2026-08-30" },
    });
    await expect(pending).resolves.toBe("restored");
    expect(useEntitlementStore.getState().purchase).toMatchObject({
      plan: "annual",
    });
  });

  it("hydration gating: starts unhydrated and flips only after rehydrate", async () => {
    useEntitlementStore.setState({ hydrated: false, hydrationFailed: false });
    expect(useEntitlementStore.getState().hydrated).toBe(false);
    await useEntitlementStore.persist.rehydrate();
    await flushPersistence();
    expect(useEntitlementStore.getState().hydrated).toBe(true);
    expect(useEntitlementStore.getState().hydrationFailed).toBe(false);
  });
});

describe("the store's word (ADR-0014 §6)", () => {
  it("trial_start fires for a subscription's store trial, never for lifetime or a restore", async () => {
    const trialStarts = () => recordedEvents().filter((e) => e.name === "trial_start");
    await useEntitlementStore.getState().purchasePlan("annual");
    expect(trialStarts()).toEqual([
      { name: "trial_start", properties: { plan: "annual" } },
    ]);
    useEntitlementStore.getState().resetForDev();
    await useEntitlementStore.getState().restorePurchases();
    expect(trialStarts()).toHaveLength(1);

    clearRecordedEvents();
    useEntitlementStore.getState().resetForDev();
    await useEntitlementStore.getState().purchasePlan("lifetime");
    expect(trialStarts()).toEqual([]);
  });

  it("purchase_result reports the sheet's word for any plan, before the trial fact", async () => {
    await useEntitlementStore.getState().purchasePlan("annual");
    expect(recordedEvents().map((e) => e.name)).toEqual(["purchase_result", "trial_start"]);
    expect(recordedEvents()[0]).toEqual({
      name: "purchase_result",
      properties: { plan: "annual", outcome: "purchased" },
    });

    clearRecordedEvents();
    useEntitlementStore.getState().resetForDev();
    await useEntitlementStore.getState().purchasePlan("lifetime");
    expect(recordedEvents()).toEqual([
      { name: "purchase_result", properties: { plan: "lifetime", outcome: "purchased" } },
    ]);
  });

  it("purchase_result names a closed sheet and a failure, and grants nothing", async () => {
    const { getBilling } = jest.requireActual<typeof import("../../monetization/billing")>(
      "../../monetization/billing",
    );
    const spy = jest
      .spyOn(getBilling(), "purchase")
      .mockResolvedValueOnce({ ok: false, reason: "cancelled" })
      .mockResolvedValueOnce({ ok: false, reason: "failed" });
    expect(await useEntitlementStore.getState().purchasePlan("monthly")).toBe("cancelled");
    expect(await useEntitlementStore.getState().purchasePlan("annual")).toBe("failed");
    expect(recordedEvents()).toEqual([
      { name: "purchase_result", properties: { plan: "monthly", outcome: "cancelled" } },
      { name: "purchase_result", properties: { plan: "annual", outcome: "failed" } },
    ]);
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(recordedPerson()).toEqual({});
    spy.mockRestore();
  });

  it("restore_result: restored, empty, failed", async () => {
    // Nothing on the fake store account yet: empty.
    expect(await useEntitlementStore.getState().restorePurchases()).toBe("empty");
    await useEntitlementStore.getState().purchasePlan("annual");
    useEntitlementStore.getState().resetForDev();
    clearRecordedEvents();
    expect(await useEntitlementStore.getState().restorePurchases()).toBe("restored");
    const { getBilling } = jest.requireActual<typeof import("../../monetization/billing")>(
      "../../monetization/billing",
    );
    const spy = jest
      .spyOn(getBilling(), "restore")
      .mockResolvedValueOnce({ ok: false, reason: "failed" });
    expect(await useEntitlementStore.getState().restorePurchases()).toBe("failed");
    expect(recordedEvents()).toEqual([
      { name: "restore_result", properties: { outcome: "restored" } },
      { name: "restore_result", properties: { outcome: "failed" } },
    ]);
    spy.mockRestore();
  });

  it("a grant syncs the person's entitlement: a store trial reads as trial, a restore as active", async () => {
    await useEntitlementStore.getState().purchasePlan("annual");
    expect(recordedPerson()).toMatchObject({ entitlement: "trial" });
    useEntitlementStore.getState().resetForDev();
    useDevReceiptStore.setState({ receipt: { plan: "annual", date: "2026-08-01" } });
    await useEntitlementStore.getState().restorePurchases();
    expect(recordedPerson()).toMatchObject({ entitlement: "active" });
  });

  it("a purchase marks the free week as used, and stays used after a lapse", async () => {
    await useEntitlementStore.getState().purchasePlan("annual");
    expect(useEntitlementStore.getState().trialUsed).toBe(true);
    expect(useEntitlementStore.getState().purchase?.trial).toBe(true);
  });

  it("refresh adopts the store's word — grant, revoke — and 'no opinion' changes nothing", async () => {
    const { getBilling } = jest.requireActual<typeof import("../../monetization/billing")>(
      "../../monetization/billing",
    );
    const billing = getBilling();
    const spy = jest.spyOn(billing, "refreshEntitlement");
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-09-01", trial: true }, trialUsed: true });

    spy.mockResolvedValueOnce(undefined); // offline, or the dev adapter
    await useEntitlementStore.getState().refreshFromStore();
    expect(useEntitlementStore.getState().purchase?.plan).toBe("annual");

    spy.mockResolvedValueOnce(null); // the store says the trial lapsed
    await useEntitlementStore.getState().refreshFromStore();
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(useEntitlementStore.getState().trialUsed).toBe(true);

    spy.mockResolvedValueOnce({ plan: "lifetime", date: "2026-09-05" });
    await useEntitlementStore.getState().refreshFromStore();
    expect(useEntitlementStore.getState().purchase?.plan).toBe("lifetime");
    spy.mockRestore();
  });
});

describe("qualifying sessions (ADR-0025)", () => {
  const ENTITLEMENT_KEY = "fither/entitlement-v1";

  /** The store's facts through the policy, for a given allowance. */
  function statusFor(freeSessions: number) {
    const { trialStartDate, purchase, trialUsed, qualifyingSessions } =
      useEntitlementStore.getState();
    return entitlementStatus({
      firstCompletedDate: trialStartDate,
      purchase,
      trialUsed,
      qualifyingSessions,
      freeSessions,
    });
  }

  it("counts one per committed session id — a journal replay of the same record never counts twice", () => {
    const { recordQualifyingSession } = useEntitlementStore.getState();
    recordQualifyingSession("2026-08-31:seed-1", "2026-08-31");
    // The crash-replay: the identical committed record, applied again.
    recordQualifyingSession("2026-08-31:seed-1", "2026-08-31");
    recordQualifyingSession("2026-08-31:seed-1", "2026-08-31");
    expect(useEntitlementStore.getState().qualifyingSessions).toBe(1);
    expect(useEntitlementStore.getState().lastQualifyingSessionId).toBe("2026-08-31:seed-1");
    recordQualifyingSession("2026-09-02:seed-2", "2026-09-02");
    expect(useEntitlementStore.getState().qualifyingSessions).toBe(2);
  });

  it("walks the gate under both variants as sessions are committed", () => {
    const control = FREE_SESSIONS_EXPERIMENT.variants.control;
    const three = FREE_SESSIONS_EXPERIMENT.variants.three;
    expect(statusFor(control)).toBe("beforeTrial");
    expect(statusFor(three)).toBe("beforeTrial");
    useEntitlementStore.getState().recordQualifyingSession("s1", "2026-08-31");
    expect(statusFor(control)).toBe("gated");
    expect(statusFor(three)).toBe("beforeTrial");
    useEntitlementStore.getState().recordQualifyingSession("s2", "2026-09-01");
    expect(statusFor(three)).toBe("beforeTrial");
    useEntitlementStore.getState().recordQualifyingSession("s3", "2026-09-02");
    expect(statusFor(three)).toBe("gated");
    expect(statusFor(control)).toBe("gated");
  });

  it("an active subscriber is unaffected by the count; a lapsed one stays expired", async () => {
    await useEntitlementStore.getState().purchasePlan("annual");
    for (let i = 1; i <= 4; i += 1) {
      useEntitlementStore.getState().recordQualifyingSession(`s${i}`, "2026-09-0" + i);
      expect(statusFor(1)).toBe("purchased");
      expect(statusFor(3)).toBe("purchased");
    }
    // The store says the trial lapsed.
    useEntitlementStore.setState({ purchase: null });
    expect(statusFor(1)).toBe("trialExpired");
    expect(statusFor(3)).toBe("trialExpired");
  });

  it("persists the count and comes back after a relaunch", async () => {
    useEntitlementStore.getState().recordQualifyingSession("s1", "2026-08-31");
    useEntitlementStore.getState().recordQualifyingSession("s2", "2026-09-01");
    await flushPersistence();
    const persisted = await AsyncStorage.getItem(ENTITLEMENT_KEY);
    expect(persisted).toContain('"qualifyingSessions":2');

    useEntitlementStore.setState({
      trialStartDate: null,
      qualifyingSessions: 0,
      lastQualifyingSessionId: null,
      hydrated: false,
    });
    await flushPersistence();
    await AsyncStorage.setItem(ENTITLEMENT_KEY, persisted ?? "");
    await useEntitlementStore.persist.rehydrate();
    await flushPersistence();
    const state = useEntitlementStore.getState();
    expect(state.qualifyingSessions).toBe(2);
    expect(state.lastQualifyingSessionId).toBe("s2");
    expect(state.trialStartDate).toBe("2026-08-31");
    // The replay of s2 after the relaunch still counts nothing.
    state.recordQualifyingSession("s2", "2026-09-01");
    expect(useEntitlementStore.getState().qualifyingSessions).toBe(2);
  });

  it("migrates a pre-experiment record: a stamped first session is one spent qualifying session", async () => {
    // The process dies first (the reset rewrites disk), then disk holds
    // exactly what it held before ADR-0025 (and what the completion
    // journal's canonical write still holds): no count at all.
    useEntitlementStore.setState({ hydrated: false });
    await flushPersistence();
    await AsyncStorage.setItem(
      ENTITLEMENT_KEY,
      JSON.stringify({
        state: { trialStartDate: "2026-08-20", purchase: null, trialUsed: false },
        version: 0,
      }),
    );
    await useEntitlementStore.persist.rehydrate();
    await flushPersistence();
    const state = useEntitlementStore.getState();
    expect(state.qualifyingSessions).toBe(1);
    expect(state.trialStartDate).toBe("2026-08-20");
    expect(state.purchase).toBeNull();
    expect(state.trialUsed).toBe(false);
    // She keeps today's policy under control and gains two under three.
    expect(statusFor(1)).toBe("gated");
    expect(statusFor(3)).toBe("beforeTrial");
  });

  it("migration never touches purchase or trialUsed, and a fresh record stays at zero", () => {
    expect(
      migrateEntitlement({
        trialStartDate: "2026-08-20",
        purchase: { plan: "annual", date: "2026-08-21", trial: true },
        trialUsed: true,
      }),
    ).toEqual({
      trialStartDate: "2026-08-20",
      purchase: { plan: "annual", date: "2026-08-21", trial: true },
      trialUsed: true,
      qualifyingSessions: 1,
    });
    expect(migrateEntitlement({ trialStartDate: null, purchase: null, trialUsed: false })).toEqual({
      trialStartDate: null,
      purchase: null,
      trialUsed: false,
      qualifyingSessions: 0,
    });
    // A record that already counts is read back verbatim: a consumed
    // allowance is never reset.
    const counted = {
      trialStartDate: "2026-08-20",
      purchase: null,
      trialUsed: false,
      qualifyingSessions: 3,
      lastQualifyingSessionId: "s3",
    };
    expect(migrateEntitlement(counted)).toEqual(counted);
    expect(migrateEntitlement(undefined)).toEqual({});
  });

  it("offline changes nothing: the count and the policy read disk alone", () => {
    const fetchSpy = jest.fn(() => {
      throw new Error("network reached");
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      useEntitlementStore.getState().recordQualifyingSession("s1", "2026-08-31");
      expect(statusFor(3)).toBe("beforeTrial");
      expect(statusFor(1)).toBe("gated");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
