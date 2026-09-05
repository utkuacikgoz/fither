// The error-monitoring port (ADR-0016), the same shape as billing, auth,
// notifications and analytics. The app reports through this interface;
// nothing else imports the SDK. Sentry is selected only when its DSN is
// configured (EXPO_PUBLIC_SENTRY_DSN, see docs/sentry-setup.md);
// otherwise the quiet adapter keeps the last few errors in memory for
// tests and a debugger. Monitoring never blocks or gates anything: every
// call is synchronous fire-and-forget and swallows its own failures.

import type { AppStateStatus } from "react-native";

import { quietMonitoring } from "./quiet-monitoring";
import { sentryConfigured, sentryMonitoring } from "./sentry-monitoring";

export interface MonitoringPort {
  /** Start the SDK once. Safe to call more than once. */
  init(): void;
  /**
   * Report a handled error with a short, fixed context label (never
   * user content). Uncaught errors and native crashes are picked up by
   * the SDK itself once init() has run.
   */
  captureError(error: unknown, context: string): void;
  /** Throw a deliberate JS error one tick later — the launch-checklist verification. */
  testJsError(): void;
  /** Crash the native process on purpose (dev builds only, by the caller). */
  testNativeCrash(): void;
  /** Foreground/background transitions, for the SDK's session bookkeeping. */
  noteAppState?(status: AppStateStatus): void;
}

/** The active monitoring implementation. */
export function getMonitoring(): MonitoringPort {
  return sentryConfigured() ? sentryMonitoring : quietMonitoring;
}

/** The one call sites use; guarded here as well as in the adapters. */
export function captureError(error: unknown, context: string): void {
  try {
    getMonitoring().captureError(error, context);
  } catch {
    // Monitoring is never allowed to surface.
  }
}
