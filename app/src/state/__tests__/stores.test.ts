import { totalPoints, useLedgerStore } from "../ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useProfileStore } from "../profile-store";
import { fixtureApplyResult } from "../../test-utils/fixtures";

beforeEach(() => {
  useLedgerStore.setState({ events: [] });
  useProfileStore.setState({ profile: createInitialProfile(), history: { entries: [] } });
});

describe("ledger store", () => {
  it("appends events and never loses earlier ones", () => {
    const { append } = useLedgerStore.getState();
    append([{ type: "session", points: 10, date: "2026-08-30" }]);
    append([
      { type: "session", points: 20, date: "2026-08-31" },
      { type: "newTierBlock", points: 5, date: "2026-08-31", pattern: "push" },
    ]);
    const { events } = useLedgerStore.getState();
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ points: 10, date: "2026-08-30" });
  });

  it("exposes no way to remove or edit events (append-only surface)", () => {
    const state = useLedgerStore.getState() as unknown as Record<string, unknown>;
    const actions = Object.keys(state).filter((k) => typeof state[k] === "function");
    expect(actions).toEqual(["append"]);
  });

  it("appending an empty batch changes nothing", () => {
    const { append } = useLedgerStore.getState();
    append([{ type: "session", points: 10, date: "2026-08-30" }]);
    append([]);
    expect(useLedgerStore.getState().events).toHaveLength(1);
  });

  it("totalPoints sums engine-issued points", () => {
    expect(
      totalPoints([
        { type: "session", points: 10, date: "2026-08-30" },
        { type: "skillUnlock", points: 25, date: "2026-08-31", pattern: "push" },
      ]),
    ).toBe(35);
  });
});

describe("profile store", () => {
  it("starts every pattern at tier 1 with zeroed streaks", () => {
    const { profile } = useProfileStore.getState();
    for (const pattern of ["push", "pull", "squat", "hinge", "core"] as const) {
      expect(profile.patterns[pattern]).toEqual({
        tier: 1,
        cleanStreak: 0,
        struggledStreak: 0,
        volumeReduced: false,
      });
    }
  });

  it("updates profile and history only via the engine's ApplyResult", () => {
    const result = fixtureApplyResult();
    useProfileStore.getState().applyEngineResult(result);
    const { profile, history } = useProfileStore.getState();
    expect(profile).toEqual(result.profile);
    expect(history).toEqual(result.history);
    // No other mutating action exists on the store surface.
    const state = useProfileStore.getState() as unknown as Record<string, unknown>;
    const actions = Object.keys(state).filter((k) => typeof state[k] === "function");
    expect(actions).toEqual(["applyEngineResult"]);
  });

  it("forwards the ApplyResult's ledger events to the append-only ledger", () => {
    useProfileStore.getState().applyEngineResult(fixtureApplyResult());
    const { events } = useLedgerStore.getState();
    expect(events).toHaveLength(2);
    expect(totalPoints(events)).toBe(35);
  });
});
