import AsyncStorage from "@react-native-async-storage/async-storage";

import { useCareNoteStore, type CareNoteEntry } from "../care-note-store";

const STORAGE_KEY = "fither/care-notes-v1";

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useCareNoteStore.setState({
    entries: [],
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("care-note store", () => {
  it("appends entries in order, never editing or dropping earlier ones", () => {
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "first" });
    useCareNoteStore.getState().append({ date: "2026-09-02", text: "second" });

    expect(useCareNoteStore.getState().entries).toEqual([
      { date: "2026-09-01", text: "first" },
      { date: "2026-09-02", text: "second" },
    ]);
  });

  it("round-trips notes through AsyncStorage under its own key (offline, local-only)", async () => {
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "rough week" });
    await flushPersistence();

    // Simulated relaunch: capture disk, wipe memory, restore disk, rehydrate.
    const persisted = await AsyncStorage.getItem(STORAGE_KEY);
    expect(persisted).not.toBeNull();
    useCareNoteStore.setState({
      entries: [],
      hydrated: false,
      hydrationFailed: false,
    });
    await flushPersistence();
    await AsyncStorage.setItem(STORAGE_KEY, persisted ?? "");
    await useCareNoteStore.persist.rehydrate();
    await flushPersistence();

    const state = useCareNoteStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.entries).toEqual([{ date: "2026-09-01", text: "rough week" }]);
  });

  it("gates on hydration: an append before hydration waits, then lands after", async () => {
    useCareNoteStore.setState({ hydrated: false, hydrationFailed: false });
    const early: CareNoteEntry = { date: "2026-09-01", text: "early" };
    useCareNoteStore.getState().append(early);
    // Not applied yet — a rehydrate would otherwise clobber it.
    expect(useCareNoteStore.getState().entries).toEqual([]);

    await useCareNoteStore.persist.rehydrate();
    await flushPersistence();
    const state = useCareNoteStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.entries).toEqual([early]);
  });
});
