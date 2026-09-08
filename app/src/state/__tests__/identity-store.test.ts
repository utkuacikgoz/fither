import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearRecordedEvents,
  devAnalytics,
  identifiedAs,
  recordedEvents,
} from "../../analytics/dev-analytics";
import { analyticsDistinctId } from "../../analytics/identity";
import { getAuth } from "../../auth/auth";
import { useDevAuthSessionStore } from "../../auth/dev-auth";
import { getBilling } from "../../monetization/billing";
import { useIdentityStore } from "../identity-store";

// The identity store's analytics (drop-off pass, 2026-09-08): how the
// sign-in frame ended, the one-way-hashed person for an Apple identity
// — at sign-in and again at every launch — and the sign-out signal sent
// under her id before the id goes.

const PROVIDER_ID = "001234.abcdef0123456789.0987";
const APPLE = { kind: "apple" as const, date: "2026-09-01", providerUserId: PROVIDER_ID };

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  clearRecordedEvents();
  useIdentityStore.setState({ identity: null, hydrated: true, hydrationFailed: false });
  useDevAuthSessionStore.setState({ session: null, hydrated: true, hydrationFailed: false });
});

describe("sign_in_result", () => {
  it("the guest path reports guest/done", async () => {
    await useIdentityStore.getState().continueAsGuest();
    expect(recordedEvents()).toEqual([
      { name: "sign_in_result", properties: { method: "guest", outcome: "done" } },
    ]);
    // A guest carries no provider id: nobody is identified.
    expect(identifiedAs()).toBeNull();
  });

  it("the provider's sheet: done, cancelled, failed — in its own words", async () => {
    const spy = jest
      .spyOn(getAuth(), "signInWithApple")
      .mockResolvedValueOnce({ ok: true, identity: APPLE })
      .mockResolvedValueOnce({ ok: false, reason: "cancelled" })
      .mockResolvedValueOnce({ ok: false, reason: "failed" });
    expect(await useIdentityStore.getState().signInWithApple()).toBe("done");
    expect(await useIdentityStore.getState().signInWithApple()).toBe("cancelled");
    expect(await useIdentityStore.getState().signInWithApple()).toBe("failed");
    expect(recordedEvents()).toEqual([
      { name: "sign_in_result", properties: { method: "apple", outcome: "done" } },
      { name: "sign_in_result", properties: { method: "apple", outcome: "cancelled" } },
      { name: "sign_in_result", properties: { method: "apple", outcome: "failed" } },
    ]);
    spy.mockRestore();
  });
});

describe("identify", () => {
  it("a landed Apple identity identifies the salted hash of the provider id, never the id", async () => {
    const spy = jest.spyOn(getAuth(), "signInWithApple").mockResolvedValueOnce({ ok: true, identity: APPLE });
    const store = jest.spyOn(getBilling(), "setUser");
    await useIdentityStore.getState().signInWithApple();
    expect(identifiedAs()).toBe(analyticsDistinctId(PROVIDER_ID));
    expect(identifiedAs()).not.toContain(PROVIDER_ID);
    // The store customer is the same person (ADR-0027 §3).
    expect(store).toHaveBeenCalledWith(analyticsDistinctId(PROVIDER_ID));
    spy.mockRestore();
    store.mockRestore();
  });

  it("an Apple identity without a provider id (legacy record) identifies nothing", async () => {
    const spy = jest
      .spyOn(getAuth(), "signInWithApple")
      .mockResolvedValueOnce({ ok: true, identity: { kind: "apple", date: "2026-09-01" } });
    await useIdentityStore.getState().signInWithApple();
    expect(useIdentityStore.getState().identity?.kind).toBe("apple");
    expect(identifiedAs()).toBeNull();
    spy.mockRestore();
  });

  it("a remembered Apple identity identifies again when the store hydrates at launch", async () => {
    // Simulated relaunch: the in-memory store is emptied (which also
    // rewrites storage), then the remembered record is put on disk and
    // the store reads it back.
    useIdentityStore.setState({ identity: null, hydrated: false });
    await flush();
    await AsyncStorage.setItem(
      "fither/identity-v1",
      JSON.stringify({ state: { identity: APPLE }, version: 0 }),
    );
    await useIdentityStore.persist.rehydrate();
    await flush();
    expect(useIdentityStore.getState().hydrated).toBe(true);
    expect(useIdentityStore.getState().identity).toEqual(APPLE);
    expect(identifiedAs()).toBe(analyticsDistinctId(PROVIDER_ID));
    expect(recordedEvents()).toEqual([]);
  });

  it("a remembered guest identifies nothing at launch", async () => {
    useIdentityStore.setState({ identity: null, hydrated: false });
    await flush();
    await AsyncStorage.setItem(
      "fither/identity-v1",
      JSON.stringify({ state: { identity: { kind: "guest", date: "2026-09-01" } }, version: 0 }),
    );
    await useIdentityStore.persist.rehydrate();
    await flush();
    expect(useIdentityStore.getState().identity?.kind).toBe("guest");
    expect(identifiedAs()).toBeNull();
  });
});

describe("signOut", () => {
  it("sends account_action under her id, then resets the analytics identity", async () => {
    const spy = jest.spyOn(getAuth(), "signInWithApple").mockResolvedValueOnce({ ok: true, identity: APPLE });
    await useIdentityStore.getState().signInWithApple();
    expect(identifiedAs()).not.toBeNull();
    const sent = jest.spyOn(devAnalytics, "track");
    const reset = jest.spyOn(devAnalytics, "reset");
    const storeOut = jest.spyOn(getBilling(), "clearUser");

    await useIdentityStore.getState().signOut();

    expect(sent).toHaveBeenCalledWith("account_action", { action: "signOut" });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(storeOut).toHaveBeenCalledTimes(1);
    storeOut.mockRestore();
    // The event went out before the reset: track's call precedes reset's.
    expect(sent.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0] ?? 0);
    expect(useIdentityStore.getState().identity).toBeNull();
    expect(identifiedAs()).toBeNull();
    expect(recordedEvents()).toEqual([]);
    sent.mockRestore();
    reset.mockRestore();
    spy.mockRestore();
  });
});
