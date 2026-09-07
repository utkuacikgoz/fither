import { getAnalytics, track } from "../analytics";
import { clearRecordedEvents, devAnalytics, recordedEvents } from "../dev-analytics";
import { postHogAnalytics } from "../posthog-analytics";

beforeEach(() => clearRecordedEvents());

describe("analytics port", () => {
  it("selects the dev adapter when no PostHog key is configured", () => {
    expect(process.env.EXPO_PUBLIC_POSTHOG_KEY).toBeUndefined();
    expect(getAnalytics()).toBe(devAnalytics);
    expect(getAnalytics()).not.toBe(postHogAnalytics);
  });

  it("records events oldest first with their properties", () => {
    track("workout_start", { minutes: 10 });
    track("workout_complete", { minutes: 10, close: "completed", first: true, streak: 1 });
    expect(recordedEvents()).toEqual([
      { name: "workout_start", properties: { minutes: 10 } },
      {
        name: "workout_complete",
        properties: { minutes: 10, close: "completed", first: true, streak: 1 },
      },
    ]);
  });

  it("never throws, whatever the adapter does", () => {
    const spy = jest.spyOn(devAnalytics, "track").mockImplementation(() => {
      throw new Error("vendor exploded");
    });
    expect(() => track("trial_start", { plan: "annual" })).not.toThrow();
    spy.mockRestore();
  });

  it("reset forgets what was recorded", () => {
    track("deep_link_open", { path: "/unlock" });
    getAnalytics().reset();
    expect(recordedEvents()).toEqual([]);
  });

  it("keeps only the most recent events", () => {
    for (let i = 0; i < 60; i += 1) track("workout_start", { minutes: 20 });
    expect(recordedEvents()).toHaveLength(50);
  });
});
