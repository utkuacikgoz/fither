import { clearRecordedEvents, recordedPerson } from "../dev-analytics";
import { readPersonProperties, syncPersonProperties } from "../person";
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

beforeEach(() => {
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
  useProfileStore.setState({ history: { entries: [] }, hydrated: true, hydrationFailed: false });
  useIntentionStore.setState({ target: null, asked: false, hydrated: true, hydrationFailed: false });
  useSettingsStore.setState({ voice: false, hydrated: true, hydrationFailed: false });
  useIdentityStore.setState({ identity: null, hydrated: true, hydrationFailed: false });
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
});
