// The session receipt (owner brief 2026-09-07, wave 2): what one history
// entry says about the session it records, in the four counts the finish
// receipt shows. A pure read of engine-written outcomes — the engine
// decides each block's outcome and history is its record; nothing here is
// a rule. The one definition it leans on is the engine's own: an attempted
// block is a completed or struggled one, and a skipped block is not
// (`trainedDay`, ADR-0018 §1 as amended by ADR-0023).
//
// Never a measured-minutes claim. The app does not time her; the entry's
// `minutes` is what was planned, so the receipt names it `minutesPlanned`
// and nothing else about time.

import { trainedDay, type HistoryEntry } from "@fither/engine";

/**
 * How the session closed, by ADR-0023's accounting:
 * - `completed`: every block attempted and none skipped. A struggled
 *   block is done ("Hard today" is showing up and doing the work).
 * - `partial`: some blocks attempted, some skipped.
 * - `hard`: attempted, but no block completed — every attempted block
 *   was struggled.
 * - `empty`: nothing attempted (every block skipped, or no blocks at all).
 */
export type ReceiptClose = "completed" | "partial" | "hard" | "empty";

export interface SessionReceipt {
  /** The entry's own local date, ISO yyyy-mm-dd. */
  date: string;
  /** The session length she chose. Planned, never measured. */
  minutesPlanned: number;
  /** Blocks completed. */
  done: number;
  /** Blocks she answered "Hard today" on (struggled). */
  hard: number;
  /** Blocks skipped. */
  skipped: number;
  /** The attempted blocks' movement ids, in session order. */
  movementIds: string[];
  close: ReceiptClose;
}

export function sessionReceipt(entry: HistoryEntry): SessionReceipt {
  let done = 0;
  let hard = 0;
  let skipped = 0;
  const movementIds: string[] = [];
  for (const block of entry.blocks) {
    if (block.outcome === "completed") done += 1;
    else if (block.outcome === "struggled") hard += 1;
    else skipped += 1;
    if (block.outcome !== "skipped") movementIds.push(block.movementId);
  }

  // Precedence: nothing attempted is the empty close whatever else is
  // true (it also covers an entry with no blocks); then "hard" when
  // nothing completed; then whether anything was left out.
  const close: ReceiptClose = !trainedDay(entry)
    ? "empty"
    : done === 0
      ? "hard"
      : skipped > 0
        ? "partial"
        : "completed";

  return {
    date: entry.date,
    minutesPlanned: entry.minutes,
    done,
    hard,
    skipped,
    movementIds,
    close,
  };
}
