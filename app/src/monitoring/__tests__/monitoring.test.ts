import { captureError, getMonitoring } from "../monitoring";
import { capturedErrors, clearCapturedErrors, quietMonitoring } from "../quiet-monitoring";
import { sentryMonitoring } from "../sentry-monitoring";

beforeEach(() => clearCapturedErrors());

describe("monitoring port", () => {
  it("selects the quiet adapter when no DSN is configured", () => {
    expect(process.env.EXPO_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(getMonitoring()).toBe(quietMonitoring);
    expect(getMonitoring()).not.toBe(sentryMonitoring);
  });

  it("keeps handled errors with their fixed context label", () => {
    const boom = new Error("disk");
    captureError(boom, "completeSession");
    expect(capturedErrors()).toEqual([{ error: boom, context: "completeSession" }]);
  });

  it("never throws, whatever the adapter does", () => {
    const spy = jest.spyOn(quietMonitoring, "captureError").mockImplementation(() => {
      throw new Error("vendor exploded");
    });
    expect(() => captureError(new Error("x"), "test")).not.toThrow();
    spy.mockRestore();
  });

  it("the quiet test error throws on the next tick, so the global handler sees it", () => {
    jest.useFakeTimers();
    quietMonitoring.testJsError();
    expect(() => jest.runOnlyPendingTimers()).toThrow("FITHER deliberate test error");
    jest.useRealTimers();
  });
});
