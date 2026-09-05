// The in-memory analytics adapter: selected whenever PostHog has no key
// (dev builds, tests, and any release built without the key). Keeps the
// most recent events so tests can assert on exactly what a flow sent,
// and so a dev build can be inspected from a debugger. Nothing leaves
// the process.

import type { AnalyticsPort } from "./analytics";
import type { AnalyticsEventName, AnalyticsEvents } from "./events";

export interface RecordedEvent<N extends AnalyticsEventName = AnalyticsEventName> {
  name: N;
  properties: AnalyticsEvents[N];
}

const KEEP = 50;
let recorded: RecordedEvent[] = [];

export const devAnalytics: AnalyticsPort = {
  track(name, properties) {
    recorded = [...recorded.slice(-(KEEP - 1)), { name, properties }];
  },
  reset() {
    recorded = [];
  },
};

/** Everything the dev adapter has recorded, oldest first. */
export function recordedEvents(): readonly RecordedEvent[] {
  return recorded;
}

/** Test helper: start every test from an empty record. */
export function clearRecordedEvents(): void {
  recorded = [];
}
