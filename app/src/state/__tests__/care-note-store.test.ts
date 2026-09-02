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
  it("appends entries in order, stamping each with a stable unique id", () => {
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "first" });
    useCareNoteStore.getState().append({ date: "2026-09-02", text: "second" });

    const entries = useCareNoteStore.getState().entries;
    expect(entries).toMatchObject([
      { date: "2026-09-01", text: "first" },
      { date: "2026-09-02", text: "second" },
    ]);
    expect(entries[0]?.id).toBeDefined();
    expect(entries[1]?.id).toBeDefined();
    expect(entries[0]?.id).not.toBe(entries[1]?.id);
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
    expect(state.entries).toMatchObject([
      { date: "2026-09-01", text: "rough week" },
    ]);
    expect(state.entries[0]?.id).toBeDefined();
  });

  it("gates on hydration: an append before hydration waits, then lands after", async () => {
    useCareNoteStore.setState({ hydrated: false, hydrationFailed: false });
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "early" });
    // Not applied yet — a rehydrate would otherwise clobber it.
    expect(useCareNoteStore.getState().entries).toEqual([]);

    await useCareNoteStore.persist.rehydrate();
    await flushPersistence();
    const state = useCareNoteStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.entries).toMatchObject([{ date: "2026-09-01", text: "early" }]);
    expect(state.entries[0]?.id).toBeDefined();
  });

  it("removes exactly the targeted entry by id and persists the deletion", async () => {
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "keep me" });
    useCareNoteStore.getState().append({ date: "2026-09-02", text: "delete me" });
    const target = useCareNoteStore.getState().entries[1];
    expect(target).toBeDefined();
    if (!target) return;

    useCareNoteStore.getState().remove(target);
    expect(useCareNoteStore.getState().entries).toMatchObject([
      { date: "2026-09-01", text: "keep me" },
    ]);

    // The deletion reaches disk — the note is gone after a relaunch too.
    await flushPersistence();
    const persisted = await AsyncStorage.getItem(STORAGE_KEY);
    expect(persisted).toContain("keep me");
    expect(persisted).not.toContain("delete me");
  });

  it("updates exactly the targeted entry, persists it, and no-ops on blank text", async () => {
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "original" });
    useCareNoteStore.getState().append({ date: "2026-09-02", text: "untouched" });
    const target = useCareNoteStore.getState().entries[0];
    expect(target).toBeDefined();
    if (!target) return;

    useCareNoteStore.getState().update(target, "revised words");
    expect(useCareNoteStore.getState().entries).toMatchObject([
      { date: "2026-09-01", text: "revised words" },
      { date: "2026-09-02", text: "untouched" },
    ]);

    // A blanked note is kept as-is: deleting has its own confirmed path.
    const revised = useCareNoteStore.getState().entries[0];
    if (revised) useCareNoteStore.getState().update(revised, "   ");
    expect(useCareNoteStore.getState().entries[0]?.text).toBe("revised words");

    await flushPersistence();
    const persisted = await AsyncStorage.getItem(STORAGE_KEY);
    expect(persisted).toContain("revised words");
    expect(persisted).not.toContain("original");
  });

  it("removing an entry that is not there is a no-op", () => {
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "only note" });
    const ghost: CareNoteEntry = { id: "nope", date: "2026-09-01", text: "only note" };
    useCareNoteStore.getState().remove(ghost);
    expect(useCareNoteStore.getState().entries).toHaveLength(1);
  });

  it("migrates v0 notes without ids: content untouched, stable ids backfilled", async () => {
    // Quiesce the store FIRST (setState persists), then plant a
    // pre-journal (v0) envelope exactly as the old store wrote it.
    useCareNoteStore.setState({
      entries: [],
      hydrated: false,
      hydrationFailed: false,
    });
    await flushPersistence();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          entries: [
            { date: "2026-08-01", text: "legacy one" },
            { date: "2026-08-02", text: "legacy two" },
          ],
        },
        version: 0,
      }),
    );
    await useCareNoteStore.persist.rehydrate();
    await flushPersistence();

    const state = useCareNoteStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.entries).toMatchObject([
      { id: "legacy:0", date: "2026-08-01", text: "legacy one" },
      { id: "legacy:1", date: "2026-08-02", text: "legacy two" },
    ]);

    // And the backfilled ids support the journal's delete.
    const first = state.entries[0];
    if (!first) return;
    useCareNoteStore.getState().remove(first);
    expect(useCareNoteStore.getState().entries).toMatchObject([
      { date: "2026-08-02", text: "legacy two" },
    ]);
  });

  it("tolerates an id-less entry in memory: removable by date + text", () => {
    // Legacy tolerance beyond the migration path (e.g. state set directly).
    const legacy: CareNoteEntry = { date: "2026-08-01", text: "no id here" };
    useCareNoteStore.setState({ entries: [legacy] });
    useCareNoteStore.getState().append({ date: "2026-09-01", text: "modern" });

    useCareNoteStore.getState().remove({ date: "2026-08-01", text: "no id here" });
    expect(useCareNoteStore.getState().entries).toMatchObject([
      { date: "2026-09-01", text: "modern" },
    ]);
  });
});
