import AsyncStorage from "@react-native-async-storage/async-storage";

import { useDevReceiptStore } from "../../monetization/dev-billing";
import { useEntitlementStore } from "../entitlement-store";

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
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
  it("stamps the trial start once — later completions never move it", () => {
    const { markSessionCompleted } = useEntitlementStore.getState();
    markSessionCompleted("2026-08-31");
    markSessionCompleted("2026-09-02");
    expect(useEntitlementStore.getState().trialStartDate).toBe("2026-08-31");
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
    useEntitlementStore.getState().markSessionCompleted("2026-08-31");

    useEntitlementStore.getState().resetForDev();
    const state = useEntitlementStore.getState();
    expect(state.purchase).toBeNull();
    expect(state.trialStartDate).toBeNull();
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
