import type { FeedbackMessage, FeedbackPort } from "./feedback";

// The in-memory adapter: what tests read and what a dev build without an
// endpoint uses. `failNext` lets a test walk the offline path.

const sent: FeedbackMessage[] = [];
let failNext = false;

export const devFeedback: FeedbackPort = {
  async send(message) {
    if (failNext) {
      failNext = false;
      return false;
    }
    sent.push(message);
    return true;
  },
};

/** Test hooks. */
export function sentFeedback(): readonly FeedbackMessage[] {
  return sent;
}
export function clearSentFeedback(): void {
  sent.length = 0;
  failNext = false;
}
export function failNextFeedback(): void {
  failNext = true;
}
