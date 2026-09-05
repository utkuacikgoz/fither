import * as Sentry from "@sentry/react-native";

import { resetSentryForTests, scrubEvent, sentryConfigured, sentryMonitoring } from "../sentry-monitoring";

const init = jest.mocked(Sentry.init);
const captureException = jest.mocked(Sentry.captureException);

beforeEach(() => resetSentryForTests());

function loadWithDsn() {
  process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@o1.ingest.sentry.io/1";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../sentry-monitoring") as typeof import("../sentry-monitoring");
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  return mod;
}

describe("Sentry adapter", () => {
  it("is not configured without a DSN, and then starts nothing", () => {
    expect(sentryConfigured()).toBe(false);
    sentryMonitoring.init();
    sentryMonitoring.captureError(new Error("x"), "test");
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("with a DSN, starts once with crash reporting only — no PII, no tracing, no attachments", () => {
    jest.isolateModules(() => {
      const mod = loadWithDsn();
      expect(mod.sentryConfigured()).toBe(true);
      mod.sentryMonitoring.init();
      mod.sentryMonitoring.init();
      expect(init).toHaveBeenCalledTimes(1);
      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://public@o1.ingest.sentry.io/1",
          sendDefaultPii: false,
          tracesSampleRate: 0,
          enableAutoPerformanceTracing: false,
          enableUserInteractionTracing: false,
          enableCaptureFailedRequests: false,
          attachScreenshot: false,
          attachViewHierarchy: false,
        }),
      );
      const options = init.mock.calls[0]?.[0];
      expect(options?.beforeSend).toBeInstanceOf(Function);
    });
  });

  it("reports handled errors with the context tag, starting the SDK if needed", () => {
    jest.isolateModules(() => {
      const mod = loadWithDsn();
      const boom = new Error("disk");
      mod.sentryMonitoring.captureError(boom, "completeSession");
      expect(init).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(boom, { tags: { context: "completeSession" } });
    });
  });

  it("the test crash calls the native crash, the test error throws next tick", () => {
    jest.isolateModules(() => {
      const mod = loadWithDsn();
      mod.sentryMonitoring.testNativeCrash();
      expect(Sentry.nativeCrash).toHaveBeenCalledTimes(1);
      jest.useFakeTimers();
      mod.sentryMonitoring.testJsError();
      expect(() => jest.runOnlyPendingTimers()).toThrow("FITHER deliberate test error");
      jest.useRealTimers();
    });
  });

  it("scrubs user and request from every event before it leaves", () => {
    const event = {
      event_id: "e1",
      message: "boom",
      user: { id: "her", email: "her@example.com" },
      request: { url: "https://x" },
      tags: { context: "test" },
    };
    expect(scrubEvent(event as never)).toEqual({
      event_id: "e1",
      message: "boom",
      tags: { context: "test" },
    });
  });

  it("swallows a throwing SDK", () => {
    jest.isolateModules(() => {
      const mod = loadWithDsn();
      init.mockImplementationOnce(() => {
        throw new Error("no native module");
      });
      expect(() => mod.sentryMonitoring.init()).not.toThrow();
      expect(() => mod.sentryMonitoring.captureError(new Error("x"), "test")).not.toThrow();
    });
  });
});
