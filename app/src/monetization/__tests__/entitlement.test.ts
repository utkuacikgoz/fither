import { entitlementStatus, isEntitled, type EntitlementStatus } from "../entitlement";
import { FREE_SESSIONS_EXPERIMENT } from "../experiment";

// ADR-0009 §2–3 as amended by ADR-0014 §6 and ADR-0025: the free week is
// the store's, the app keeps a count and two facts and no calendar
// arithmetic. `freeSessions` is the experiment variant's allowance.

const CONTROL = FREE_SESSIONS_EXPERIMENT.variants.control;
const THREE = FREE_SESSIONS_EXPERIMENT.variants.three;

/** A record with `n` qualifying sessions behind her (the first stamps the date). */
function trained(n: number) {
  return {
    firstCompletedDate: n > 0 ? "2026-08-31" : null,
    qualifyingSessions: n,
  };
}

describe("entitlement policy (app-layer only)", () => {
  it("no completed session yet: nothing gates — the paywall never blocks the first session", () => {
    for (const freeSessions of [CONTROL, THREE]) {
      const status = entitlementStatus({
        ...trained(0),
        purchase: null,
        trialUsed: false,
        freeSessions,
      });
      expect(status).toBe("beforeTrial");
      expect(isEntitled(status)).toBe(true);
    }
  });

  it("control: one completed session and no entitlement is gated, with the free week still ahead", () => {
    const status = entitlementStatus({
      ...trained(1),
      purchase: null,
      trialUsed: false,
      freeSessions: CONTROL,
    });
    expect(status).toBe("gated");
    expect(isEntitled(status)).toBe(false);
  });

  it("a store trial in progress entitles her exactly like a paid plan", () => {
    const trial = entitlementStatus({
      ...trained(1),
      purchase: { plan: "annual", date: "2026-09-01", trial: true },
      trialUsed: true,
      freeSessions: CONTROL,
    });
    expect(trial).toBe("purchased");
    expect(isEntitled(trial)).toBe(true);
    const lifetime = entitlementStatus({
      ...trained(1),
      purchase: { plan: "lifetime", date: "2026-09-04" },
      trialUsed: true,
      freeSessions: CONTROL,
    });
    expect(isEntitled(lifetime)).toBe(true);
  });

  it("a lapsed trial is expired — the paywall's expired letter, never a second free week", () => {
    const status = entitlementStatus({
      ...trained(1),
      purchase: null,
      trialUsed: true,
      freeSessions: CONTROL,
    });
    expect(status).toBe("trialExpired");
    expect(isEntitled(status)).toBe(false);
  });

  it("reads no clock: the dates are facts, not arithmetic", () => {
    // A first session "in the future" or the distant past changes nothing.
    for (const date of ["1999-01-01", "2999-12-31"]) {
      expect(
        entitlementStatus({
          firstCompletedDate: date,
          qualifyingSessions: 1,
          purchase: null,
          trialUsed: false,
          freeSessions: CONTROL,
        }),
      ).toBe("gated");
    }
  });
});

describe("the free-sessions allowance (ADR-0025)", () => {
  // The policy table: variant × qualifying sessions, no entitlement ever held.
  const table: [keyof typeof FREE_SESSIONS_EXPERIMENT.variants, number, EntitlementStatus][] = [
    ["control", 0, "beforeTrial"],
    ["control", 1, "gated"],
    ["control", 2, "gated"],
    ["control", 3, "gated"],
    ["three", 0, "beforeTrial"],
    ["three", 1, "beforeTrial"],
    ["three", 2, "beforeTrial"],
    ["three", 3, "gated"],
  ];

  it.each(table)(
    "%s with %i qualifying session(s) and nothing held: %s",
    (variant, sessions, expected) => {
      const status = entitlementStatus({
        ...trained(sessions),
        purchase: null,
        trialUsed: false,
        freeSessions: FREE_SESSIONS_EXPERIMENT.variants[variant],
      });
      expect(status).toBe(expected);
      expect(isEntitled(status)).toBe(expected === "beforeTrial");
    },
  );

  it.each(table)(
    "%s with %i qualifying session(s): an active subscriber is purchased regardless",
    (variant, sessions) => {
      for (const purchase of [
        { plan: "annual" as const, date: "2026-09-01", trial: true },
        { plan: "monthly" as const, date: "2026-09-01" },
        { plan: "lifetime" as const, date: "2026-09-01" },
      ]) {
        const status = entitlementStatus({
          ...trained(sessions),
          purchase,
          trialUsed: true,
          freeSessions: FREE_SESSIONS_EXPERIMENT.variants[variant],
        });
        expect(status).toBe("purchased");
        expect(isEntitled(status)).toBe(true);
      }
    },
  );

  it.each(table)(
    "%s with %i qualifying session(s): an expired subscriber stays expired",
    (variant, sessions) => {
      const status = entitlementStatus({
        ...trained(sessions),
        purchase: null,
        trialUsed: true,
        freeSessions: FREE_SESSIONS_EXPERIMENT.variants[variant],
      });
      expect(status).toBe("trialExpired");
      expect(isEntitled(status)).toBe(false);
    },
  );

  it("the allowance is the only thing the variants change", () => {
    expect(FREE_SESSIONS_EXPERIMENT.variants).toEqual({ control: 1, three: 3 });
    expect(FREE_SESSIONS_EXPERIMENT.id).toBe("free_sessions_v1");
  });
});
