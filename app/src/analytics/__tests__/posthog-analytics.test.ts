import PostHog from "posthog-react-native";

import { postHogAnalytics, postHogConfigured, resetPostHogForTests } from "../posthog-analytics";

const Ctor = jest.mocked(PostHog);

beforeEach(() => resetPostHogForTests());

describe("PostHog adapter", () => {
  it("is not configured without a key, and then sends nothing", () => {
    expect(postHogConfigured()).toBe(false);
    postHogAnalytics.track("workout_start", { minutes: 10 });
    postHogAnalytics.reset();
    expect(Ctor).not.toHaveBeenCalled();
  });

  it("with a key, configures once with everything but capture switched off", () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_test";
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("../posthog-analytics") as typeof import("../posthog-analytics");
      delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
      expect(mod.postHogConfigured()).toBe(true);

      mod.postHogAnalytics.track("workout_start", { minutes: 10 });
      mod.postHogAnalytics.track("trial_start", { plan: "monthly" });
      expect(Ctor).toHaveBeenCalledTimes(1);
      expect(Ctor).toHaveBeenCalledWith(
        "phc_test",
        expect.objectContaining({
          host: "https://us.i.posthog.com",
          captureAppLifecycleEvents: true,
          disableGeoip: true,
          preloadFeatureFlags: false,
          disableSurveys: true,
          enableSessionReplay: false,
        }),
      );
      const instance = Ctor.mock.instances[0] as unknown as {
        capture: jest.Mock;
        reset: jest.Mock;
      };
      expect(instance.capture).toHaveBeenNthCalledWith(1, "workout_start", { minutes: 10 });
      expect(instance.capture).toHaveBeenNthCalledWith(2, "trial_start", { plan: "monthly" });

      mod.postHogAnalytics.reset();
      expect(instance.reset).toHaveBeenCalledTimes(1);
    });
  });

  it("swallows a throwing SDK", () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_test";
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("../posthog-analytics") as typeof import("../posthog-analytics");
      delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
      Ctor.mockImplementationOnce(() => {
        throw new Error("no native module");
      });
      expect(() => mod.postHogAnalytics.track("workout_start", { minutes: 30 })).not.toThrow();
    });
  });
});
