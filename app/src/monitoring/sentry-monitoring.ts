// The Sentry adapter (ADR-0016). Crash and error reports only: no
// performance tracing, no session replay, no screenshots, no view
// hierarchy, no failed-request capture, no PII. The DSN is a public
// client key; the build-time auth token for source maps never enters
// the bundle (docs/sentry-setup.md).
//
// Identity: no setUser, ever. Events carry Sentry's own anonymous
// installation id and the app version; beforeSend strips anything an
// integration might have attached under user or request.

import * as Sentry from "@sentry/react-native";

import type { MonitoringPort } from "./monitoring";

/** Public DSN; undefined means "use the quiet adapter". */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function sentryConfigured(): boolean {
  return typeof DSN === "string" && DSN.length > 0;
}

type SentryEvent = Parameters<NonNullable<Parameters<typeof Sentry.init>[0]["beforeSend"]>>[0];

/** Drop the fields no FITHER report may carry. Exported for its test. */
export function scrubEvent<E extends SentryEvent>(event: E): E {
  const { user: _user, request: _request, ...rest } = event;
  return rest as E;
}

let initialised = false;

function ensureInit(): void {
  if (initialised || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    enableCaptureFailedRequests: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableNativeNagger: false,
    maxBreadcrumbs: 30,
    beforeSend: (event) => scrubEvent(event),
    // Session replay (ADR-0032, owner 2026-10-02): one session in ten, and
    // every session that hits an error, recorded as a wireframe. Every
    // text, image and drawn figure is masked: a replay shows where she
    // tapped and which screen she was on, never a word she wrote or read
    // (her notes, her answers, her sore areas stay hers).
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
        maskAllVectors: true,
      }),
    ],
  });
  initialised = true;
}

export const sentryMonitoring: MonitoringPort = {
  init() {
    try {
      ensureInit();
    } catch {
      // A monitoring SDK that fails to start must not take the app with it.
    }
  },
  captureError(error, context) {
    if (!DSN) return;
    try {
      ensureInit();
      Sentry.captureException(error, { tags: { context } });
    } catch {
      // As above.
    }
  },
  testJsError() {
    if (!DSN) return;
    ensureInit();
    setTimeout(() => {
      throw new Error("FITHER deliberate test error");
    }, 0);
  },
  testNativeCrash() {
    if (!DSN) return;
    ensureInit();
    Sentry.nativeCrash();
  },
};

/** Test helper: forget the started client. */
export function resetSentryForTests(): void {
  initialised = false;
}
