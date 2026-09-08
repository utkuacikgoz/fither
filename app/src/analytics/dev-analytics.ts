// The in-memory analytics adapter: selected whenever PostHog has no key
// (dev builds, tests, and any release built without the key). Keeps the
// most recent events so tests can assert on exactly what a flow sent,
// and so a dev build can be inspected from a debugger. Nothing leaves
// the process.

import type { AnalyticsPort } from "./analytics";
import type { AnalyticsEventName, AnalyticsEvents, PersonProperties } from "./events";

export interface RecordedEvent<N extends AnalyticsEventName = AnalyticsEventName> {
  name: N;
  properties: AnalyticsEvents[N];
}

const KEEP = 50;
let recorded: RecordedEvent[] = [];
let identified: string | null = null;
let aliases: string[] = [];
let person: Partial<PersonProperties> = {};

export const devAnalytics: AnalyticsPort = {
  track(name, properties) {
    recorded = [...recorded.slice(-(KEEP - 1)), { name, properties }];
  },
  reset() {
    recorded = [];
    identified = null;
    aliases = [];
    person = {};
  },
  alias(distinctId) {
    aliases = [...aliases, distinctId];
  },
  identify(distinctId) {
    identified = distinctId;
  },
  setPersonProperties(properties) {
    person = { ...person, ...properties };
  },
};

/** Every alias the dev adapter was handed since the last reset, in order. */
export function recordedAliases(): readonly string[] {
  return aliases;
}

/** The distinct id the dev adapter was last handed, or null. */
export function identifiedAs(): string | null {
  return identified;
}

/** The person properties the dev adapter holds, merged in order. */
export function recordedPerson(): Readonly<Partial<PersonProperties>> {
  return person;
}

/** Everything the dev adapter has recorded, oldest first. */
export function recordedEvents(): readonly RecordedEvent[] {
  return recorded;
}

/** Test helper: start every test from an empty record. */
export function clearRecordedEvents(): void {
  recorded = [];
  identified = null;
  aliases = [];
  person = {};
}
