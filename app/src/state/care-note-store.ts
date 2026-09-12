// Her private notes from heavy days — the optional "want to say what
// happened?" moment. LOCAL ONLY, as a hard rule: entries persist to
// AsyncStorage on this device and never go anywhere else — no network,
// no analytics event, no engine input. The one place they render back is
// the settings care journal (ADR-0012 §4), where she can read, edit and
// delete them; the UI states "stays on your phone" because this file
// makes it true. Entries are date-stamped, one per save; an edit changes
// the text only — the date keeps saying when the heavy day was.
//
// This file also owns the day's memory of the care moment itself — which
// local day the "that's a lot to carry" beat was already shown on. Two
// screens can open with that beat (the daily prompt's can't-build dead
// end and the session preview), and before this memory existed each kept
// its own flag, so one heavy pass through the flow could ask for the same
// note twice (owner report 2026-09-12). Whether the beat is warranted at
// all stays where it was: lib/care-moment.ts. This store only remembers
// that it already happened today.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CareNoteEntry {
  /**
   * Stable identity for the journal's delete path. Assigned on append
   * (and backfilled by the v1 migration); notes persisted before the
   * journal existed may still lack one in exotic states, and every
   * consumer tolerates that.
   */
  id?: string;
  /** YYYY-MM-DD, the same local-date source the daily prompt uses. */
  date: string;
  text: string;
}

/** What callers hand to append — the store assigns the id itself. */
export type CareNoteInput = Omit<CareNoteEntry, "id">;

interface CareNoteState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Oldest first. Appended, edited in place (text only) and deleted. */
  entries: CareNoteEntry[];
  /**
   * The local date (YYYY-MM-DD) the care moment was last shown AND
   * dismissed, or null if never. Read through `careMomentDue`, written by
   * `markCareMomentShown` — never by a screen directly.
   */
  careMomentShownDate: string | null;
  /** Append one entry. Buffered if hydration hasn't landed yet. */
  append: (entry: CareNoteInput) => void;
  /**
   * Delete one entry — the journal's confirmed destructive action
   * (ADR-0012 §4). Matches by id when the entry has one; a legacy entry
   * without an id is matched by reference, then by date + text among the
   * other id-less entries. Removing what isn't there is a no-op.
   */
  remove: (entry: CareNoteEntry) => void;
  /**
   * Edit one entry's text in place (ADR-0012 §4) — id, date and position
   * are untouched: the date keeps saying when the heavy day was. Targets
   * are matched exactly like `remove` (id first, legacy tolerance after).
   * Text is trimmed like append's callers trim; a save that trims to
   * empty is a NO-OP — blanking a note would be deletion in disguise,
   * and deletion is the journal's one confirmed path, never a side
   * effect of saving. Updating what isn't there is a no-op too.
   */
  update: (entry: CareNoteEntry, text: string) => void;
  /**
   * The care moment was shown and dismissed on `date` — however she
   * dismissed it (continued with a note, continued with an empty field,
   * or skipped). Called by whichever screen showed it; the other screen
   * then reads `careMomentDue` as false for the rest of that day.
   */
  markCareMomentShown: (date: string) => void;
}

/**
 * Whether the care moment is still owed on `date` — the one rule both
 * screens ask, so "at most once a day" cannot drift between them. A new
 * day asks again by design: the beat belongs to a heavy day, not to an
 * install.
 *
 * Pure over a state snapshot (like place-store's selectors), so it works
 * as a subscription — `useCareNoteStore((s) => careMomentDue(s, date))`
 * re-renders the screen the moment the beat is marked shown.
 *
 * Before hydration it fails SAFE toward NOT showing: a beat that is
 * skipped on a cold launch costs her nothing, while showing it twice is
 * exactly the bug this memory exists to prevent. A store whose storage
 * ERRORED still answers from memory — within one run that is all the
 * two screens need, and a broken disk must not bring the double ask
 * back.
 */
export function careMomentDue(
  state: Pick<
    CareNoteState,
    "hydrated" | "hydrationFailed" | "careMomentShownDate"
  >,
  date: string,
): boolean {
  if (!state.hydrated && !state.hydrationFailed) return false;
  return state.careMomentShownDate !== date;
}

// Ids only need to be unique within this one on-device list. Wall-clock
// plus a monotonic per-launch counter cannot collide locally, and the
// value never leaves the phone.
let noteSequence = 0;
function nextNoteId(date: string): string {
  noteSequence += 1;
  return `${date}:${Date.now().toString(36)}:${noteSequence.toString(36)}`;
}

// An append that beats hydration waits here instead of racing the
// rehydrate merge (same pattern as the first-movement store).
const pendingBeforeHydration: CareNoteEntry[] = [];

// A "shown" mark that beats hydration waits here for the same reason.
// Unreachable through the screens — careMomentDue answers "not due"
// while unhydrated, so the beat is never on screen to dismiss — but a
// mark is buffered rather than dropped: losing one would ask twice.
let pendingShownDate: string | null = null;

/**
 * The one target-matching rule, shared by remove and update so the two
 * never drift: id when the entry has one; a legacy id-less entry by
 * reference, then by date + text among the other id-less entries.
 */
function indexOfEntry(entries: CareNoteEntry[], target: CareNoteEntry): number {
  return entries.findIndex((entry) =>
    target.id !== undefined
      ? entry.id === target.id
      : entry === target ||
        (entry.id === undefined &&
          entry.date === target.date &&
          entry.text === target.text),
  );
}

export const useCareNoteStore = create<CareNoteState>()(
  persist(
    (set, get) => ({
      entries: [],
      careMomentShownDate: null,
      hydrated: false,
      hydrationFailed: false,

      append: (entry) => {
        const { hydrated, hydrationFailed, entries } = get();
        const stamped: CareNoteEntry = { ...entry, id: nextNoteId(entry.date) };
        if (!hydrated && !hydrationFailed) {
          pendingBeforeHydration.push(stamped);
          return;
        }
        set({ entries: [...entries, stamped] });
      },

      remove: (target) => {
        const { hydrated, hydrationFailed, entries } = get();
        // Before hydration there is nothing on screen to delete, and a
        // removal now would be clobbered by the rehydrate merge anyway.
        if (!hydrated && !hydrationFailed) return;
        const index = indexOfEntry(entries, target);
        if (index === -1) return;
        set({ entries: entries.filter((_, i) => i !== index) });
      },

      update: (target, text) => {
        const { hydrated, hydrationFailed, entries } = get();
        // Same hydration gate as remove: nothing renders before
        // hydration, so nothing can be in edit mode yet.
        if (!hydrated && !hydrationFailed) return;
        // Trimmed like append's callers trim; empty means keep the
        // original — never a silent, unconfirmed delete.
        const trimmed = text.trim();
        if (trimmed.length === 0) return;
        const index = indexOfEntry(entries, target);
        if (index === -1) return;
        set({
          entries: entries.map((entry, i) =>
            i === index ? { ...entry, text: trimmed } : entry,
          ),
        });
      },

      markCareMomentShown: (date) => {
        const { hydrated, hydrationFailed } = get();
        if (!hydrated && !hydrationFailed) {
          pendingShownDate = date;
          return;
        }
        set({ careMomentShownDate: date });
      },
    }),
    {
      name: "fither/care-notes-v1",
      storage: createJSONStorage(() => AsyncStorage),
      // `careMomentShownDate` is additive, so the envelope version does
      // NOT move: an older payload simply lacks the key, and an absent
      // key means "never shown" — a heavy day still gets its one beat.
      partialize: (state) => ({
        entries: state.entries,
        careMomentShownDate: state.careMomentShownDate,
      }),
      // v0 → v1: entries gained stable ids for the journal's delete path.
      // Additive only — legacy notes keep their date and text untouched
      // and receive a deterministic id from their stored position.
      version: 1,
      migrate: (persisted) => {
        const previous = (persisted ?? {}) as { entries?: CareNoteEntry[] };
        const entries = (previous.entries ?? []).map((entry, index) =>
          entry.id === undefined ? { ...entry, id: `legacy:${index}` } : entry,
        );
        // A v0 envelope predates the care-moment memory: nothing was
        // shown as far as it knows, so today still gets its one beat.
        return { entries, careMomentShownDate: null };
      },
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() => {
          const flushed = pendingBeforeHydration.splice(0);
          const flushedShown = pendingShownDate;
          pendingShownDate = null;
          useCareNoteStore.setState((state) => ({
            hydrated: !error,
            hydrationFailed: Boolean(error),
            entries: [...state.entries, ...flushed],
            // A mark made in THIS run wins over the stored one: it is
            // the day the beat was actually just shown on.
            careMomentShownDate: flushedShown ?? state.careMomentShownDate,
          }));
        });
      },
    },
  ),
);
