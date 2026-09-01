import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FirstMovementRun } from "../../lib/first-movement-timer";
import { useFirstMovementStore } from "../first-movement-store";

const STORAGE_KEY = "fither/first-movement-v1";

function run(overrides: Partial<FirstMovementRun> = {}): FirstMovementRun {
  return { t0: 1_000, t1: 43_500, deltaMs: 42_500, firstRun: true, ...overrides };
}

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useFirstMovementStore.setState({
    runs: [],
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("first-movement store", () => {
  it("record appends runs in launch order", () => {
    useFirstMovementStore.getState().record(run({ t0: 1, firstRun: true }));
    useFirstMovementStore.getState().record(run({ t0: 2, firstRun: false }));
    expect(useFirstMovementStore.getState().runs.map((r) => r.t0)).toEqual([1, 2]);
  });

  it("round-trips recordings through AsyncStorage under its own key", async () => {
    useFirstMovementStore.getState().record(run());
    await flushPersistence();

    // Simulated relaunch: capture disk, wipe memory, restore disk, rehydrate.
    const persisted = await AsyncStorage.getItem(STORAGE_KEY);
    expect(persisted).not.toBeNull();
    useFirstMovementStore.setState({
      runs: [],
      hydrated: false,
      hydrationFailed: false,
    });
    await flushPersistence();
    await AsyncStorage.setItem(STORAGE_KEY, persisted ?? "");
    await useFirstMovementStore.persist.rehydrate();
    await flushPersistence();

    const state = useFirstMovementStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.runs).toEqual([run()]);
  });

  it("buffers a capture that lands before hydration and flushes it after", async () => {
    useFirstMovementStore.setState({ hydrated: false, hydrationFailed: false });
    useFirstMovementStore.getState().record(run({ t0: 7 }));
    // Not applied yet — a rehydrate would otherwise clobber it.
    expect(useFirstMovementStore.getState().runs).toEqual([]);

    await useFirstMovementStore.persist.rehydrate();
    await flushPersistence();
    const state = useFirstMovementStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.runs.map((r) => r.t0)).toEqual([7]);
  });

  it("dev reset clears the recordings, in memory and on disk", async () => {
    useFirstMovementStore.getState().record(run());
    await flushPersistence();
    useFirstMovementStore.getState().resetForDev();
    await flushPersistence();

    expect(useFirstMovementStore.getState().runs).toEqual([]);
    const persisted = await AsyncStorage.getItem(STORAGE_KEY);
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted as string) as {
      state: { runs: FirstMovementRun[] };
    };
    expect(parsed.state.runs).toEqual([]);
  });
});
