// The in-memory monitoring adapter: selected whenever Sentry has no DSN
// (dev builds, tests, any release built without it). Nothing leaves the
// process; the last few captures are readable for tests.

import type { MonitoringPort } from "./monitoring";

export interface CapturedError {
  error: unknown;
  context: string;
}

const KEEP = 20;
let captured: CapturedError[] = [];

export const quietMonitoring: MonitoringPort = {
  init() {},
  captureError(error, context) {
    captured = [...captured.slice(-(KEEP - 1)), { error, context }];
  },
  testJsError() {
    setTimeout(() => {
      throw new Error("FITHER deliberate test error");
    }, 0);
  },
  testNativeCrash() {},
};

/** Everything the quiet adapter has captured, oldest first. */
export function capturedErrors(): readonly CapturedError[] {
  return captured;
}

/** Test helper. */
export function clearCapturedErrors(): void {
  captured = [];
}
