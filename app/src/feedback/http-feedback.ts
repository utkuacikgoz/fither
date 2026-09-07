import type { FeedbackMessage, FeedbackPort } from "./feedback";

// The HTTP adapter: one JSON POST to the configured endpoint. The body
// is the plain form-endpoint shape (Formspree and most form-to-email
// services accept it as is): `message`, `email`, `_subject`, plus the
// version, device and date fields. Accepted means a 2xx; anything else,
// including no network, is false and the store keeps the message.

const ENDPOINT = process.env.EXPO_PUBLIC_FEEDBACK_URL;
const TIMEOUT_MS = 10_000;

export function httpFeedbackConfigured(): boolean {
  return typeof ENDPOINT === "string" && ENDPOINT.startsWith("https://");
}

export const httpFeedback: FeedbackPort = {
  async send(message) {
    if (!ENDPOINT) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `FITHER feedback (${message.appVersion ?? "dev"})`,
          message: message.message,
          email: message.email ?? "",
          appVersion: message.appVersion ?? "",
          device: message.device,
          date: message.date,
        }),
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  },
};
