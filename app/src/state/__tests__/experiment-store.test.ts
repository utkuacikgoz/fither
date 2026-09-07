import AsyncStorage from "@react-native-async-storage/async-storage";

import { EXPERIMENTS_STORAGE_KEY, useExperimentStore, variantIndex } from "../experiment-store";
import { persistedKeys } from "../persisted-stores";

// The experiment record (ADR-0025): one seed, one variant per experiment,
// written once, cleared with everything else.

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useExperimentStore.setState({
    seed: null,
    assignments: {},
    forceVariant: null,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("experiment store", () => {
  it("draws the seed on the first assignment and keeps it for every later one", () => {
    const first = useExperimentStore.getState().assign("a", ["x", "y"] as const);
    const seed = useExperimentStore.getState().seed;
    expect(seed).not.toBeNull();
    expect(["x", "y"]).toContain(first);
    const second = useExperimentStore.getState().assign("b", ["p", "q"] as const);
    expect(["p", "q"]).toContain(second);
    expect(useExperimentStore.getState().seed).toBe(seed);
    expect(useExperimentStore.getState().assignments).toEqual({ a: first, b: second });
  });

  it("assigns each experiment once — a second call returns the record, even with a new seed", () => {
    useExperimentStore.setState({ seed: 11 });
    const first = useExperimentStore.getState().assign("a", ["x", "y"] as const);
    useExperimentStore.setState({ seed: 12 });
    expect(useExperimentStore.getState().assign("a", ["x", "y"] as const)).toBe(first);
  });

  it("is a pure function of seed and experiment id", () => {
    expect(variantIndex(5, "a", 2)).toBe(variantIndex(5, "a", 2));
    // Two experiments on one seed are not one coin flip.
    const flips = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      flips.add(`${variantIndex(seed, "a", 2)}${variantIndex(seed, "b", 2)}`);
    }
    expect(flips.size).toBe(4);
  });

  it("persists under fither/experiments-v1 and comes back after a relaunch", async () => {
    const variant = useExperimentStore.getState().assign("a", ["x", "y"] as const);
    const seed = useExperimentStore.getState().seed;
    await flushPersistence();
    const persisted = await AsyncStorage.getItem(EXPERIMENTS_STORAGE_KEY);
    expect(persisted).toContain(variant);

    // The process dies (memory resets — which also rewrites disk, so the
    // captured record is put back), then the store hydrates from disk.
    useExperimentStore.setState({ seed: null, assignments: {}, hydrated: false });
    await flushPersistence();
    await AsyncStorage.setItem(EXPERIMENTS_STORAGE_KEY, persisted ?? "");
    await useExperimentStore.persist.rehydrate();
    await flushPersistence();
    expect(useExperimentStore.getState().hydrated).toBe(true);
    expect(useExperimentStore.getState().seed).toBe(seed);
    expect(useExperimentStore.getState().assignments).toEqual({ a: variant });
  });

  it("is in the shared persisted-store list, so erase and the dev reset clear it", () => {
    expect(persistedKeys()).toContain(EXPERIMENTS_STORAGE_KEY);
  });

  it("the dev reset forgets seed, assignments and the override", () => {
    useExperimentStore.getState().assign("a", ["x", "y"] as const);
    useExperimentStore.getState().setForceVariantForDev("y");
    useExperimentStore.getState().resetForDev();
    expect(useExperimentStore.getState()).toMatchObject({
      seed: null,
      assignments: {},
      forceVariant: null,
    });
  });
});
