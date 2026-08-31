import {
  daysBetweenIso,
  entitlementStatus,
  isEntitled,
  TRIAL_DAYS,
} from "../entitlement";

describe("entitlement policy (ADR-0009 §2–3, app-layer only)", () => {
  it("counts whole local days between ISO dates", () => {
    expect(daysBetweenIso("2026-08-31", "2026-08-31")).toBe(0);
    expect(daysBetweenIso("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetweenIso("2026-08-31", "2026-09-07")).toBe(7);
    expect(daysBetweenIso("2026-12-28", "2027-01-04")).toBe(7);
  });

  it("no completed session yet: nothing gates — the paywall never blocks the first session", () => {
    const status = entitlementStatus({
      trialStartDate: null,
      purchase: null,
      today: "2026-08-31",
    });
    expect(status).toBe("beforeTrial");
    expect(isEntitled(status)).toBe(true);
  });

  it("trial runs 7 full days from the first completed session (day 0–6)", () => {
    const start = "2026-08-31";
    expect(TRIAL_DAYS).toBe(7);
    expect(
      entitlementStatus({ trialStartDate: start, purchase: null, today: "2026-08-31" }),
    ).toBe("trialActive");
    expect(
      entitlementStatus({ trialStartDate: start, purchase: null, today: "2026-09-06" }),
    ).toBe("trialActive");
    expect(
      entitlementStatus({ trialStartDate: start, purchase: null, today: "2026-09-07" }),
    ).toBe("trialExpired");
    expect(
      isEntitled(
        entitlementStatus({ trialStartDate: start, purchase: null, today: "2026-09-07" }),
      ),
    ).toBe(false);
  });

  it("a purchase entitles regardless of trial state", () => {
    const status = entitlementStatus({
      trialStartDate: "2026-01-01",
      purchase: { plan: "annual", date: "2026-08-31" },
      today: "2026-08-31",
    });
    expect(status).toBe("purchased");
    expect(isEntitled(status)).toBe(true);
  });

  it("a clock moved backwards never locks her out", () => {
    expect(
      entitlementStatus({
        trialStartDate: "2026-08-31",
        purchase: null,
        today: "2026-08-01",
      }),
    ).toBe("trialActive");
  });
});
