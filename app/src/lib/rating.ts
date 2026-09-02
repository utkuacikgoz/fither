// The system rating prompt, fire-and-forget (launch checklist: the
// system prompt only — it rate-limits itself — no custom UI, no
// pre-prompt). Callers own the WHEN (the decided moments and the
// second-completed-session gate live at the call sites); this module
// owns only the honest HOW: check the OS can actually show the prompt,
// request it, and never let a failure surface — a rating ask that
// errors at her is worse than no ask.

import * as StoreReview from "expo-store-review";

export function maybeRequestReview(): void {
  void (async () => {
    try {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
      }
    } catch {
      // Intentionally silent: the prompt is a bonus, never a state.
    }
  })();
}
