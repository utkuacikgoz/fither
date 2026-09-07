// The feedback port (owner decision 2026-09-07): her words about the app
// reach the owner through a small endpoint that emails them. Same shape
// as the other ports: the app talks to the network ONLY through this
// interface, the HTTP adapter is selected when its URL is configured
// (EXPO_PUBLIC_FEEDBACK_URL, see docs/feedback-setup.md), and the dev
// adapter records in memory for tests and dev builds. Nothing here may
// block the training path; the store queues while offline.

import { devFeedback } from "./dev-feedback";
import { httpFeedback, httpFeedbackConfigured } from "./http-feedback";

export interface FeedbackMessage {
  /** Her words, trimmed, never empty. */
  message: string;
  /** Optional, only if she typed one. */
  email: string | null;
  /** The app's marketing version, or null when the config has none. */
  appVersion: string | null;
  /** OS and model, e.g. "ios 18.0 iPhone" — never an identifier. */
  device: string;
  /** YYYY-MM-DD, the day she wrote it. */
  date: string;
}

export interface FeedbackPort {
  /**
   * Deliver one message. Resolves true when the endpoint accepted it,
   * false when it did not (offline, refused); never throws.
   */
  send(message: FeedbackMessage): Promise<boolean>;
}

/** The active feedback implementation. */
export function getFeedback(): FeedbackPort {
  return httpFeedbackConfigured() ? httpFeedback : devFeedback;
}

/**
 * Whether the Send feedback row exists at all: a release build without
 * an endpoint hides it rather than collecting words nobody will read.
 * Dev builds always show it, backed by the in-memory adapter.
 */
export function feedbackAvailable(): boolean {
  return httpFeedbackConfigured() || __DEV__;
}
