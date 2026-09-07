import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";

import { clearRecordedEvents, recordedEvents } from "../../analytics/dev-analytics";
import { EXPERIMENTS_STORAGE_KEY, useExperimentStore } from "../../state/experiment-store";
import {
  experimentAssignment,
  FREE_SESSIONS_EXPERIMENT,
  freeSessionsActivation,
  freeSessionsAllowance,
  useFreeSessionsAllowance,
} from "../experiment";

// ADR-0025: assignment is one persisted coin flip from a seed drawn on
// device, recorded once when the build says "on", control for everyone
// when it says "off" (the production default).

const ENV = "EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS";

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function freshStore(hydrated = true) {
  useExperimentStore.setState({
    seed: null,
    assignments: {},
    forceVariant: null,
    hydrated,
    hydrationFailed: false,
  });
}

/**
 * A relaunch: memory dies, the store hydrates from whatever disk holds.
 * Resetting memory rewrites disk too (persist writes on every set), so
 * the record is captured first and put back before hydrating.
 */
async function simulateRelaunch() {
  await flushPersistence();
  const persisted = await AsyncStorage.getItem(EXPERIMENTS_STORAGE_KEY);
  freshStore(false);
  await flushPersistence();
  if (persisted === null) await AsyncStorage.removeItem(EXPERIMENTS_STORAGE_KEY);
  else await AsyncStorage.setItem(EXPERIMENTS_STORAGE_KEY, persisted);
  await useExperimentStore.persist.rehydrate();
  await flushPersistence();
}

/** Drive the seed so a test can pick the variant it wants to look at. */
function seedFor(variant: "control" | "three"): number {
  for (let seed = 1; seed < 10_000; seed += 1) {
    freshStore();
    useExperimentStore.setState({ seed });
    if (experimentAssignment() === variant) return seed;
  }
  throw new Error(`no seed under 10000 lands on ${variant}`);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  delete process.env[ENV];
  freshStore();
});

afterAll(() => {
  delete process.env[ENV];
});

describe("activation", () => {
  it("is off unless the build says exactly 'on'", () => {
    expect(freeSessionsActivation()).toBe("off");
    process.env[ENV] = "ON";
    expect(freeSessionsActivation()).toBe("off");
    process.env[ENV] = "true";
    expect(freeSessionsActivation()).toBe("off");
    process.env[ENV] = "on";
    expect(freeSessionsActivation()).toBe("on");
  });

  it("off: everyone is control, nothing is recorded, nothing is written", async () => {
    // The reset above wrote an empty record; the read below must not.
    await flushPersistence();
    await AsyncStorage.clear();
    expect(experimentAssignment()).toBe("control");
    expect(freeSessionsAllowance()).toBe(FREE_SESSIONS_EXPERIMENT.variants.control);
    expect(useExperimentStore.getState().seed).toBeNull();
    expect(useExperimentStore.getState().assignments).toEqual({});
    await flushPersistence();
    expect(await AsyncStorage.getItem(EXPERIMENTS_STORAGE_KEY)).toBeNull();
  });

  it("off leaves a previously recorded assignment alone and still reads control", () => {
    useExperimentStore.setState({ seed: 7, assignments: { free_sessions_v1: "three" } });
    expect(experimentAssignment()).toBe("control");
    expect(useExperimentStore.getState().assignments).toEqual({ free_sessions_v1: "three" });
  });
});

describe("assignment when on", () => {
  beforeEach(() => {
    process.env[ENV] = "on";
  });

  it("assigns once from a seed drawn on the first read and records it", async () => {
    const variant = experimentAssignment();
    const { seed, assignments } = useExperimentStore.getState();
    expect(seed).not.toBeNull();
    expect(assignments).toEqual({ [FREE_SESSIONS_EXPERIMENT.id]: variant });
    // Later reads never re-draw.
    for (let i = 0; i < 5; i += 1) expect(experimentAssignment()).toBe(variant);
    expect(useExperimentStore.getState().seed).toBe(seed);
    expect(freeSessionsAllowance()).toBe(FREE_SESSIONS_EXPERIMENT.variants[variant]);
  });

  it("is deterministic from the seed: the same seed always lands on the same variant", () => {
    const seed = seedFor("three");
    for (let i = 0; i < 3; i += 1) {
      freshStore();
      useExperimentStore.setState({ seed });
      expect(experimentAssignment()).toBe("three");
    }
    const other = seedFor("control");
    freshStore();
    useExperimentStore.setState({ seed: other });
    expect(experimentAssignment()).toBe("control");
  });

  it("splits close to 50/50 over many seeds", () => {
    let three = 0;
    const total = 2000;
    for (let seed = 1; seed <= total; seed += 1) {
      freshStore();
      useExperimentStore.setState({ seed });
      if (experimentAssignment() === "three") three += 1;
    }
    expect(three / total).toBeGreaterThan(0.45);
    expect(three / total).toBeLessThan(0.55);
  });

  it("stays stable across a relaunch: the recorded variant comes back from disk", async () => {
    const variant = experimentAssignment();
    const seed = useExperimentStore.getState().seed;
    await flushPersistence();

    await simulateRelaunch();
    expect(useExperimentStore.getState().hydrated).toBe(true);
    expect(useExperimentStore.getState().seed).toBe(seed);
    expect(experimentAssignment()).toBe(variant);
    // Even a random-number source that now disagrees changes nothing.
    const random = jest.spyOn(Math, "random").mockReturnValue(0.123456);
    await simulateRelaunch();
    expect(experimentAssignment()).toBe(variant);
    random.mockRestore();
  });

  it("never assigns before the store has hydrated — a write then could shadow the disk", async () => {
    freshStore(false);
    await flushPersistence();
    await AsyncStorage.setItem(
      EXPERIMENTS_STORAGE_KEY,
      JSON.stringify({
        state: { seed: 42, assignments: { [FREE_SESSIONS_EXPERIMENT.id]: "three" }, forceVariant: null },
        version: 0,
      }),
    );
    expect(experimentAssignment()).toBe("control");
    expect(useExperimentStore.getState().seed).toBeNull();
    await useExperimentStore.persist.rehydrate();
    await flushPersistence();
    expect(experimentAssignment()).toBe("three");
    expect(useExperimentStore.getState().seed).toBe(42);
  });

  it("switching off later reads control again without erasing the record", () => {
    const variant = experimentAssignment();
    delete process.env[ENV];
    expect(experimentAssignment()).toBe("control");
    expect(useExperimentStore.getState().assignments[FREE_SESSIONS_EXPERIMENT.id]).toBe(variant);
  });

  it("works with nothing but the phone: no network, no analytics, no identity read", () => {
    const fetchSpy = jest.fn(() => {
      throw new Error("network reached");
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    clearRecordedEvents();
    try {
      const variant = experimentAssignment();
      expect(["control", "three"]).toContain(variant);
      expect(fetchSpy).not.toHaveBeenCalled();
      // The one exposure event goes through the non-blocking port; the
      // assignment never waits on or reads from it.
      expect(recordedEvents().map((e) => e.name)).toEqual(["experiment_exposure"]);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

describe("the dev override", () => {
  it("shows either variant in a dev build without touching activation or the record", () => {
    useExperimentStore.getState().setForceVariantForDev("three");
    expect(freeSessionsActivation()).toBe("off");
    expect(experimentAssignment()).toBe("three");
    expect(freeSessionsAllowance()).toBe(3);
    expect(useExperimentStore.getState().assignments).toEqual({});
    expect(useExperimentStore.getState().seed).toBeNull();
    useExperimentStore.getState().setForceVariantForDev("control");
    expect(experimentAssignment()).toBe("control");
    useExperimentStore.getState().setForceVariantForDev(null);
    expect(experimentAssignment()).toBe("control");
  });

  it("wins over a recorded assignment while set, and yields it back when cleared", () => {
    process.env[ENV] = "on";
    useExperimentStore.setState({ seed: seedFor("three") });
    freshStore();
    useExperimentStore.setState({ seed: seedFor("three") });
    expect(experimentAssignment()).toBe("three");
    useExperimentStore.getState().setForceVariantForDev("control");
    expect(experimentAssignment()).toBe("control");
    useExperimentStore.getState().setForceVariantForDev(null);
    expect(experimentAssignment()).toBe("three");
  });

  it("is ignored outside a dev build", () => {
    const globals = globalThis as unknown as { __DEV__: boolean };
    const wasDev = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      useExperimentStore.getState().setForceVariantForDev("three");
      expect(experimentAssignment()).toBe("control");
      expect(freeSessionsAllowance()).toBe(1);
    } finally {
      globals.__DEV__ = wasDev;
    }
  });

  it("an unknown override value is not a variant and falls through", () => {
    useExperimentStore.getState().setForceVariantForDev("five");
    expect(experimentAssignment()).toBe("control");
  });
});

describe("useFreeSessionsAllowance", () => {
  it("reads the allowance reactively and assigns in an effect once hydrated", async () => {
    process.env[ENV] = "on";
    freshStore(false);
    const hook = renderHook(() => useFreeSessionsAllowance());
    // Unhydrated: control, nothing written.
    expect(hook.result.current).toBe(1);
    expect(useExperimentStore.getState().assignments).toEqual({});

    await act(async () => {
      await useExperimentStore.persist.rehydrate();
      await flushPersistence();
    });
    const variant = useExperimentStore.getState().assignments[FREE_SESSIONS_EXPERIMENT.id];
    expect(["control", "three"]).toContain(variant);
    expect(hook.result.current).toBe(
      FREE_SESSIONS_EXPERIMENT.variants[variant as "control" | "three"],
    );
    hook.unmount();
  });

  it("follows the dev override", () => {
    const hook = renderHook(() => useFreeSessionsAllowance());
    expect(hook.result.current).toBe(1);
    // Block body: the persist middleware's setState returns its storage
    // write, and a thenable returned to act() would defer the flush.
    act(() => {
      useExperimentStore.getState().setForceVariantForDev("three");
    });
    expect(hook.result.current).toBe(3);
    hook.unmount();
  });
});
