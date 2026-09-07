// What the weekly recap shows (owner brief 2026-09-07, wave 2; mockup
// weekly-recap): a pure selector over the records the engine already
// writes. Nothing adaptive lives here.
//
//   · The week and its trained days are the engine's (`weekOf`,
//     `weekParticipation`). Whether an entry is training is never
//     re-derived: the same `weekParticipation` decides it.
//   · Minutes and movements are sums of each trained entry's receipt
//     (session/receipt.ts): minutes are PLANNED, never measured, and a
//     movement is one she attempted, completed or hard (ADR-0023).
//   · "Tier N reached" rows come from the ledger, the engine's own dated
//     record. Two event types mark a tier she reached: `skillUnlock`
//     (a milestone tier, dated the session that advanced) and
//     `newTierBlock` (a completed block at a freshly reached tier, dated
//     her first session working there). The profile alone cannot say it:
//     it holds current tiers, `tierSince` is stamped on regressions too,
//     and `unlockedMilestones` carries no dates. A (pattern, tier) is
//     listed in the week its EARLIEST such event falls in, so one rise is
//     never claimed twice. The tier itself is read off the event's
//     movement in the library (data, not a rule). A rise the ledger did
//     not record (a non-milestone tier whose first session had no
//     completed block) is left out rather than guessed at: the recap
//     under-reports before it ever invents improvement.

import {
  PATTERNS,
  weekOf,
  weekParticipation,
  type HistoryEntry,
  type LedgerEvent,
  type MovementLibrary,
  type Pattern,
  type Tier,
  type Week,
  type WeekParticipation,
} from "@fither/engine";

import { sessionReceipt } from "../../session/receipt";
import { findMovement } from "../../session/load-library";

export interface TierReached {
  pattern: Pattern;
  tier: Tier;
}

export interface WeekRecap {
  week: Week;
  participation: WeekParticipation;
  /** Sum of the trained entries' planned minutes. Planned, never measured. */
  minutesPlanned: number;
  /** Movements attempted across the trained entries: done plus hard. */
  movements: number;
  /** Patterns whose tier rose this week, PATTERNS order, from the ledger. */
  tiersReached: TierReached[];
}

/** The ledger events that mark a tier reached. */
const TIER_EVENTS: ReadonlySet<LedgerEvent["type"]> = new Set(["skillUnlock", "newTierBlock"]);

function inWeek(week: Week, date: string): boolean {
  // ISO yyyy-mm-dd dates order lexically (week-view relies on the same).
  return date >= week.start && date <= week.end;
}

export function tiersReachedInWeek(
  events: readonly LedgerEvent[],
  library: MovementLibrary | null,
  week: Week,
): TierReached[] {
  if (library === null) return [];
  const earliest = new Map<string, { pattern: Pattern; tier: Tier; date: string }>();
  for (const event of events) {
    if (!TIER_EVENTS.has(event.type)) continue;
    if (event.pattern === undefined || event.movementId === undefined) continue;
    const movement = findMovement(library, event.movementId);
    if (movement === null) continue;
    const key = `${event.pattern}:${movement.tier}`;
    const known = earliest.get(key);
    if (known === undefined || event.date < known.date) {
      earliest.set(key, { pattern: event.pattern, tier: movement.tier, date: event.date });
    }
  }
  const reached: TierReached[] = [];
  for (const { pattern, tier, date } of earliest.values()) {
    if (inWeek(week, date)) reached.push({ pattern, tier });
  }
  reached.sort(
    (a, b) => PATTERNS.indexOf(a.pattern) - PATTERNS.indexOf(b.pattern) || a.tier - b.tier,
  );
  return reached;
}

/** The recap of the week containing `anchorIso` (any date in it). */
export function weekRecap(
  entries: readonly HistoryEntry[],
  events: readonly LedgerEvent[],
  library: MovementLibrary | null,
  anchorIso: string,
): WeekRecap {
  const week = weekOf(anchorIso);
  const participation = weekParticipation(entries, anchorIso);
  const trained = new Set(participation.trainedDates);
  let minutesPlanned = 0;
  let movements = 0;
  for (const entry of entries) {
    // The engine's fold already decided which dates are trained; an
    // entry on a trained date with nothing attempted (a second, fully
    // skipped session) adds nothing either way through its receipt.
    if (!trained.has(entry.date)) continue;
    const receipt = sessionReceipt(entry);
    if (receipt.close === "empty") continue;
    minutesPlanned += receipt.minutesPlanned;
    movements += receipt.done + receipt.hard;
  }
  return {
    week,
    participation,
    minutesPlanned,
    movements,
    tiersReached: tiersReachedInWeek(events, library, week),
  };
}
