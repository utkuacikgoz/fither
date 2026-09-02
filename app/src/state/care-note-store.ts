// Her private notes from heavy days — the optional "want to say what
// happened?" moment. LOCAL ONLY, as a hard rule: entries persist to
// AsyncStorage on this device and never go anywhere else — no network,
// no analytics event, no engine input. The one place they render back is
// the settings care journal (ADR-0012 §4), where she can read and delete
// them; the UI states "stays on your phone" because this file makes it
// true. Entries are date-stamped, one per save, and never edited.

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
  /** Oldest first. Appended and deleted only — never edited in place. */
  entries: CareNoteEntry[];
  /** Append one entry. Buffered if hydration hasn't landed yet. */
  append: (entry: CareNoteInput) => void;
  /**
   * Delete one entry — the journal's confirmed destructive action
   * (ADR-0012 §4). Matches by id when the entry has one; a legacy entry
   * without an id is matched by reference, then by date + text among the
   * other id-less entries. Removing what isn't there is a no-op.
   */
  remove: (entry: CareNoteEntry) => void;
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

export const useCareNoteStore = create<CareNoteState>()(
  persist(
    (set, get) => ({
      entries: [],
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
        const index = entries.findIndex((entry) =>
          target.id !== undefined
            ? entry.id === target.id
            : entry === target ||
              (entry.id === undefined &&
                entry.date === target.date &&
                entry.text === target.text),
        );
        if (index === -1) return;
        set({ entries: entries.filter((_, i) => i !== index) });
      },
    }),
    {
      name: "fither/care-notes-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
      // v0 → v1: entries gained stable ids for the journal's delete path.
      // Additive only — legacy notes keep their date and text untouched
      // and receive a deterministic id from their stored position.
      version: 1,
      migrate: (persisted) => {
        const previous = (persisted ?? {}) as { entries?: CareNoteEntry[] };
        const entries = (previous.entries ?? []).map((entry, index) =>
          entry.id === undefined ? { ...entry, id: `legacy:${index}` } : entry,
        );
        return { entries };
      },
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() => {
          const flushed = pendingBeforeHydration.splice(0);
          useCareNoteStore.setState((state) => ({
            hydrated: !error,
            hydrationFailed: Boolean(error),
            entries: [...state.entries, ...flushed],
          }));
        });
      },
    },
  ),
);
