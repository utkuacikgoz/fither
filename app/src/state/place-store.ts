// Where she trains (owner brief 2026-09-07, wave 4): Home or Hotel. Each
// place remembers two things — the equipment in the room and whether the
// quiet question is asked each day or answered "yes" for her — and the
// switch between them is one explicit tap.
//
// Ownership, stated once so the two stores never fight:
//
//   · The settings store's `equipment` REMAINS the one source the engine
//     reads (the prompt copies it into every DailyPrompt). This store
//     never becomes a second input to session generation.
//   · A place's preset is a REMEMBERED equipment list. `setPlace` is the
//     switch: it snapshots the settings store's current equipment into
//     the place she is leaving (so anything the Equipment page changed
//     while she was there is what that place remembers), then copies the
//     new place's equipment into the settings store. `setEquipment` for
//     the ACTIVE place copies too — editing the room she is in edits the
//     engine's input at once; editing the other place only edits what it
//     will bring when she switches. Home's initial equipment is the
//     settings store's own default: before her first switch, home simply
//     IS the settings store's equipment (see `placeEquipment`).
//   · Quiet mode is a per-place default for ONE daily question. "always"
//     answers "Do you need to be quiet right now?" with yes and skips the
//     step; "ask" changes nothing. It is never a session rule: the engine
//     still receives an ordinary prompt with `quiet: true`.
//   · Presets never touch `alwaysAvoid` or today's soreness picks. A
//     restriction survives every switch; the store has no way to reach
//     one, and the tests pin it.
//   · Quiet movements and the coaching voice are separate. Nothing here
//     reads or writes the voice setting; the player speaks whenever the
//     voice is on, quiet days included.
//
// Local-only, persisted through the store layer, works in airplane mode.

import type { Equipment } from "@fither/engine";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  FLOOR_ONLY_EQUIPMENT,
  useSettingsStore,
} from "./settings-store";

export type Place = "home" | "hotel";

/** The two places, in the order Settings lists them. Never mutate. */
export const PLACES: Place[] = ["home", "hotel"];

/** "ask": the quiet question is asked each day. "always": answered yes. */
export type QuietMode = "ask" | "always";

export interface PlacePreset {
  equipment: Equipment[];
  quiet: QuietMode;
}

interface PlaceState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** The place she trains in today. */
  place: Place;
  presets: Record<Place, PlacePreset>;
  /** The switch: remembers where she was, brings the new place's equipment. */
  setPlace: (place: Place) => void;
  /** Edit a place's remembered equipment; the active place's edit reaches the engine at once. */
  setEquipment: (place: Place, equipment: Equipment[]) => void;
  /** Edit a place's quiet default. Touches nothing else. */
  setQuiet: (place: Place, quiet: QuietMode) => void;
}

/**
 * A place's equipment as she would see it on the Where I train page: the
 * ACTIVE place is whatever the settings store holds right now (that is
 * the room she is in, and the Equipment page may have edited it), the
 * other place is what it remembers. Pure, so screens and tests read one
 * definition.
 */
export function placeEquipment(
  state: Pick<PlaceState, "place" | "presets">,
  settingsEquipment: Equipment[],
  place: Place,
): Equipment[] {
  return state.place === place ? settingsEquipment : state.presets[place].equipment;
}

export const usePlaceStore = create<PlaceState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hydrationFailed: false,
      place: "home",
      presets: {
        // Home starts as the settings store's own default; until her
        // first switch the settings store's equipment IS home's.
        home: { equipment: useSettingsStore.getState().equipment, quiet: "ask" },
        // A hotel room: floor and a wall, nothing assumed about a chair.
        hotel: { equipment: FLOOR_ONLY_EQUIPMENT, quiet: "ask" },
      },

      setPlace: (place) => {
        const current = get();
        if (current.place === place) return;
        const settings = useSettingsStore.getState();
        const leaving: PlacePreset = {
          ...current.presets[current.place],
          equipment: settings.equipment,
        };
        const presets = { ...current.presets, [current.place]: leaving };
        set({ place, presets });
        settings.setEquipment(presets[place].equipment);
      },

      setEquipment: (place, equipment) => {
        set((state) => ({
          presets: {
            ...state.presets,
            [place]: { ...state.presets[place], equipment },
          },
        }));
        if (get().place === place) {
          useSettingsStore.getState().setEquipment(equipment);
        }
      },

      setQuiet: (place, quiet) =>
        set((state) => ({
          presets: {
            ...state.presets,
            [place]: { ...state.presets[place], quiet },
          },
        })),
    }),
    {
      name: "fither/place-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        place: state.place,
        presets: state.presets,
      }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          usePlaceStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);

/**
 * Whether the active place answers the quiet question for her. Read by
 * the daily prompt; before hydration it is "ask" — a question asked once
 * too often costs a tap, an answer she did not give costs trust.
 */
export function activeQuietMode(state: Pick<PlaceState, "place" | "presets">): QuietMode {
  return state.presets[state.place].quiet;
}
