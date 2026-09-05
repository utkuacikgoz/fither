import { entitlementStatus, isEntitled } from "../entitlement";

// ADR-0009 §2–3 as amended by ADR-0014 §6: the free week is the store's,
// the app keeps two facts and no calendar arithmetic.

describe("entitlement policy (app-layer only)", () => {
  it("no completed session yet: nothing gates — the paywall never blocks the first session", () => {
    const status = entitlementStatus({ firstCompletedDate: null, purchase: null, trialUsed: false });
    expect(status).toBe("beforeTrial");
    expect(isEntitled(status)).toBe(true);
  });

  it("one completed session and no entitlement: gated, with the free week still ahead", () => {
    const status = entitlementStatus({ firstCompletedDate: "2026-08-31", purchase: null, trialUsed: false });
    expect(status).toBe("gated");
    expect(isEntitled(status)).toBe(false);
  });

  it("a store trial in progress entitles her exactly like a paid plan", () => {
    const trial = entitlementStatus({
      firstCompletedDate: "2026-08-31",
      purchase: { plan: "annual", date: "2026-09-01", trial: true },
      trialUsed: true,
    });
    expect(trial).toBe("purchased");
    expect(isEntitled(trial)).toBe(true);
    const lifetime = entitlementStatus({
      firstCompletedDate: "2026-08-31",
      purchase: { plan: "lifetime", date: "2026-09-04" },
      trialUsed: true,
    });
    expect(isEntitled(lifetime)).toBe(true);
  });

  it("a lapsed trial is expired — the paywall's expired letter, never a second free week", () => {
    const status = entitlementStatus({ firstCompletedDate: "2026-08-31", purchase: null, trialUsed: true });
    expect(status).toBe("trialExpired");
    expect(isEntitled(status)).toBe(false);
  });

  it("reads no clock: the dates are facts, not arithmetic", () => {
    // A first session "in the future" or the distant past changes nothing.
    for (const date of ["1999-01-01", "2999-12-31"]) {
      expect(entitlementStatus({ firstCompletedDate: date, purchase: null, trialUsed: false })).toBe("gated");
    }
  });
});
