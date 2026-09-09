import { clearRecordedEvents, devAnalytics, recordedPerson } from "../dev-analytics";
import { readPersonProperties, startPersonSync, syncPersonProperties } from "../person";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useIdentityStore } from "../../state/identity-store";
import { useIntentionStore } from "../../state/intention-store";
import { useProfileStore } from "../../state/profile-store";
import { useSettingsStore } from "../../state/settings-store";

// The six person facts, read whole from the stores: the entitlement
// policy's word mapped to four closed values, the engine's trainedDay
// counted, the last length, the intention, the voice, signed in.

function entry(minutes: 10 | 20 | 30, outcome: "completed" | "struggled" | "skipped") {
  return {
    date: "2026-08-01",
    minutes,
    blocks: [{ movementId: "plank", pattern: "core" as const, outcome }],
  };
}

let sends: jest.SpyInstance;

beforeEach(() => {
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    trialUsed: false,
    qualifyingSessions: 0,
    lastQualifyingSessionId: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useProfileStore.setState({ history: { entries: [] }, hydrated: true, hydrationFailed: false });
  useIntentionStore.setState({ target: null, asked: false, hydrated: true, hydrationFailed: false });
  useSettingsStore.setState({ voice: false, hydrated: true, hydrationFailed: false });
  useIdentityStore.setState({ identity: null, hydrated: true, hydrationFailed: false });
  // Forget what a previous test sent: the unsubscribe clears the
  // module's last-sent value, so every test starts able to send.
  startPersonSync()();
  clearRecordedEvents();
  sends = jest.spyOn(devAnalytics, "setPersonProperties");
});

afterEach(() => {
  sends.mockRestore();
});

describe("readPersonProperties", () => {
  it("a fresh install: free, nothing completed, no length, no intention, silent, not signed in", () => {
    expect(readPersonProperties()).toEqual({
      entitlement: "free",
      sessions_completed: 0,
      last_minutes: null,
      intention: "none",
      voice: false,
      signed_in: false,
    });
  });

  it("entitlement: the policy's word — gated is still free, a store trial is trial, paid is active, lapsed is lapsed", () => {
    // The free allowance spent and no entitlement held: gated, still "free".
    useEntitlementStore.setState({ trialStartDate: "2026-08-01", qualifyingSessions: 3 });
    expect(readPersonProperties().entitlement).toBe("free");
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-08-01", trial: true }, trialUsed: true });
    expect(readPersonProperties().entitlement).toBe("trial");
    useEntitlementStore.setState({ purchase: { plan: "monthly", date: "2026-08-01" } });
    expect(readPersonProperties().entitlement).toBe("active");
    useEntitlementStore.setState({ purchase: { plan: "lifetime", date: "2026-08-01" } });
    expect(readPersonProperties().entitlement).toBe("active");
    useEntitlementStore.setState({ purchase: null, trialUsed: true });
    expect(readPersonProperties().entitlement).toBe("lapsed");
  });

  it("sessions_completed counts attempted sessions (the engine's trainedDay); last_minutes is the newest entry's", () => {
    useProfileStore.setState({
      history: { entries: [entry(10, "completed"), entry(30, "skipped"), entry(20, "struggled")] },
    });
    const person = readPersonProperties();
    expect(person.sessions_completed).toBe(2);
    expect(person.last_minutes).toBe(20);
  });

  it("intention, voice and signed_in read their stores", () => {
    useIntentionStore.setState({ target: 2 });
    useSettingsStore.setState({ voice: true });
    useIdentityStore.setState({ identity: { kind: "guest", date: "2026-08-01" } });
    expect(readPersonProperties()).toMatchObject({ intention: "two", voice: true, signed_in: false });
    useIntentionStore.setState({ target: 3 });
    useIdentityStore.setState({ identity: { kind: "apple", date: "2026-08-01", providerUserId: "x" } });
    expect(readPersonProperties()).toMatchObject({ intention: "three", signed_in: true });
  });

  it("carries exactly the six closed keys and nothing of hers", () => {
    expect(Object.keys(readPersonProperties()).sort()).toEqual([
      "entitlement",
      "intention",
      "last_minutes",
      "sessions_completed",
      "signed_in",
      "voice",
    ]);
  });
});

describe("syncPersonProperties", () => {
  it("hands the whole set to the port, replacing the previous values", () => {
    expect(recordedPerson()).toEqual({});
    syncPersonProperties();
    expect(recordedPerson()).toEqual(readPersonProperties());
    useSettingsStore.setState({ voice: true });
    useProfileStore.setState({ history: { entries: [entry(30, "completed")] } });
    syncPersonProperties();
    expect(recordedPerson()).toMatchObject({ voice: true, sessions_completed: 1, last_minutes: 30 });
  });

  it("sends nothing a second time for values that have not moved", () => {
    syncPersonProperties();
    syncPersonProperties();
    syncPersonProperties();
    expect(sends).toHaveBeenCalledTimes(1);
  });

  it("says nothing about a person whose stores have not hydrated", () => {
    useProfileStore.setState({ hydrated: false });
    syncPersonProperties();
    expect(sends).not.toHaveBeenCalled();
    expect(recordedPerson()).toEqual({});
  });
});

describe("startPersonSync", () => {
  it("sends nothing while a backing store is still loading, then once when it lands", () => {
    // A real cold start: the disk has not spoken for the profile yet, so
    // reading now would push a fresh install's zero at someone who has
    // trained for months.
    useProfileStore.setState({
      history: { entries: [entry(20, "completed")] },
      hydrated: false,
    });
    const stop = startPersonSync();
    expect(sends).not.toHaveBeenCalled();
    expect(recordedPerson()).toEqual({});

    useProfileStore.setState({ hydrated: true });
    expect(sends).toHaveBeenCalledTimes(1);
    expect(recordedPerson()).toMatchObject({ sessions_completed: 1, last_minutes: 20 });
    stop();
  });

  it("sends when a watched fact actually changes, and stays quiet when one does not", () => {
    const stop = startPersonSync();
    // Everything is hydrated already: the set goes out at once.
    expect(sends).toHaveBeenCalledTimes(1);

    // A store write that moves no person property (the intention ask
    // being marked as asked) says nothing.
    useIntentionStore.setState({ asked: true });
    expect(sends).toHaveBeenCalledTimes(1);

    // Each of the five backing stores, in turn.
    useIntentionStore.setState({ target: 3 });
    useSettingsStore.setState({ voice: true });
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-08-01", trial: true } });
    useIdentityStore.setState({
      identity: { kind: "apple", date: "2026-08-01", providerUserId: "x" },
    });
    useProfileStore.setState({ history: { entries: [entry(10, "completed")] } });
    expect(sends).toHaveBeenCalledTimes(6);
    expect(recordedPerson()).toEqual({
      entitlement: "trial",
      sessions_completed: 1,
      last_minutes: 10,
      intention: "three",
      voice: true,
      signed_in: true,
    });
    stop();
  });

  it("a manual sync after a commit and the subscription never both send", () => {
    const stop = startPersonSync();
    sends.mockClear();
    useSettingsStore.setState({ voice: true });
    syncPersonProperties();
    expect(sends).toHaveBeenCalledTimes(1);
    stop();
  });

  it("the unsubscribe detaches every store and forgets what was sent", () => {
    const stop = startPersonSync();
    stop();
    sends.mockClear();
    useSettingsStore.setState({ voice: true });
    useProfileStore.setState({ history: { entries: [entry(30, "completed")] } });
    useIntentionStore.setState({ target: 2 });
    useEntitlementStore.setState({ trialUsed: true });
    useIdentityStore.setState({ identity: { kind: "guest", date: "2026-08-01" } });
    expect(sends).not.toHaveBeenCalled();

    // Forgotten, not remembered: a restart sends the current set again
    // even though nothing moved since the last send.
    const restarted = startPersonSync();
    expect(sends).toHaveBeenCalledTimes(1);
    restarted();
  });
});
