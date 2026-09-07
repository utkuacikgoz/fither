// What the share card is about (wave 3, mockup share-receipt): a pure
// selector from the route's parameters and the history the engine
// wrote. Nothing adaptive lives here — a session's facts come through
// `sessionReceipt`, the week's through `weekView`, and the only
// arithmetic added is counting what those already list. Every input is
// untrusted (the route is public): a malformed date falls back to
// today, a date with no entry falls back to the week, and the card is
// always a truthful one about something she did.

import type { HistoryEntry, WeeklyTarget } from "@fither/engine";

import { sessionReceipt } from "../../session/receipt";
import { weekView } from "../../state/week-view";
import type { ShareLinkKind } from "../../share/share-url";

/** Where the share was started; the analytics event's own union. */
export type ShareSource = "finish" | "receipt" | "recap";

/** The one optional public context she may add; null is the plain card. */
export type ShareContext = "home" | "hotel" | "meetings";

export type ShareSubject =
  | {
      kind: "session";
      /** The length she chose. Planned, never measured. */
      minutes: number;
      /** Movements she attempted (completed or hard); skipped is not training. */
      movements: number;
      /** The first attempted movement, drawn on the card; "" draws nothing. */
      figureId: string;
    }
  | {
      kind: "week";
      /** Trained sessions in the week containing today. */
      sessions: number;
      /** Movements attempted across those sessions. */
      movements: number;
      /** The latest trained session's first movement; "" draws nothing. */
      figureId: string;
    };

const SOURCES: readonly ShareSource[] = ["finish", "receipt", "recap"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The route's `source`, or "receipt" for anything the route did not name. */
export function parseShareSource(value: string | string[] | undefined): ShareSource {
  const single = Array.isArray(value) ? value[0] : value;
  return SOURCES.find((source) => source === single) ?? "receipt";
}

/** The route's `date` when it is a yyyy-mm-dd; otherwise undefined (today). */
export function parseShareDate(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === "string" && ISO_DATE.test(single) ? single : undefined;
}

function lastEntryOn(
  entries: readonly HistoryEntry[],
  date: string,
): HistoryEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && entry.date === date) return entry;
  }
  return null;
}

function weekSubject(
  entries: readonly HistoryEntry[],
  todayIso: string,
  target: WeeklyTarget,
): ShareSubject {
  const { participation } = weekView(entries, todayIso, target);
  const trained = new Set(participation.trainedDates);
  let movements = 0;
  let figureId = "";
  for (const entry of entries) {
    if (!trained.has(entry.date)) continue;
    const receipt = sessionReceipt(entry);
    movements += receipt.movementIds.length;
    // Entries are in the order the engine appended them: the last one
    // with an attempted movement is the latest.
    if (receipt.movementIds[0] !== undefined) figureId = receipt.movementIds[0];
  }
  return { kind: "week", sessions: participation.sessions, movements, figureId };
}

/**
 * The subject for a source and (already validated) date. A recap is the
 * week; anything else is the last entry of the date (today when absent),
 * or the week when that date holds nothing.
 */
export function shareSubject(
  entries: readonly HistoryEntry[],
  todayIso: string,
  target: WeeklyTarget,
  source: ShareSource,
  date: string | undefined,
): ShareSubject {
  if (source === "recap") return weekSubject(entries, todayIso, target);
  const entry = lastEntryOn(entries, date ?? todayIso);
  if (entry === null) return weekSubject(entries, todayIso, target);
  const receipt = sessionReceipt(entry);
  return {
    kind: "session",
    minutes: receipt.minutesPlanned,
    movements: receipt.movementIds.length,
    figureId: receipt.movementIds[0] ?? "",
  };
}

/** Which recipient page a subject links to. The context never changes it (this wave). */
export function shareLinkKind(subject: ShareSubject): ShareLinkKind {
  return subject.kind;
}
