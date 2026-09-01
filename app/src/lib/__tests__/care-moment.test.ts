import { CARE_AREA_THRESHOLD, needsCareMoment } from "../care-moment";

// The care-moment threshold (item 4, 2026-09-01 live-testing pass):
// "most or all" body areas (>= 6 of 8), or any body-area selection the
// engine could not build around. Display affect only — the build result
// itself always comes from the engine.

describe("needsCareMoment", () => {
  it("never fires when nothing is selected, whatever the build result", () => {
    expect(needsCareMoment(0, true)).toBe(false);
    expect(needsCareMoment(0, false)).toBe(false);
  });

  it("stays quiet below the threshold when the engine built a session", () => {
    expect(needsCareMoment(1, true)).toBe(false);
    expect(needsCareMoment(CARE_AREA_THRESHOLD - 1, true)).toBe(false);
  });

  it("fires at 6 or more of the 8 areas even when a session was built", () => {
    expect(CARE_AREA_THRESHOLD).toBe(6);
    expect(needsCareMoment(6, true)).toBe(true);
    expect(needsCareMoment(7, true)).toBe(true);
    expect(needsCareMoment(8, true)).toBe(true);
  });

  it("fires whenever her selection left the engine unable to build", () => {
    expect(needsCareMoment(1, false)).toBe(true);
    expect(needsCareMoment(8, false)).toBe(true);
  });
});
