import AsyncStorage from "@react-native-async-storage/async-storage";

import { useSettingsStore } from "../settings-store";

// The settings store's persistent avoid-list setters. `setAlwaysAvoid`
// is the first session's "Remember for every session" (owner brief
// 2026-09-07): it replaces the list wholesale and persists through the
// store layer, offline, like every other setting.

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({
    alwaysAvoid: [],
    onboardingCompleted: false,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("setAlwaysAvoid", () => {
  it("replaces the permanent list wholesale and touches nothing else", () => {
    useSettingsStore.getState().completeOnboarding(["none", "wall"], []);
    useSettingsStore.getState().setAlwaysAvoid(["knees", "back"]);
    const state = useSettingsStore.getState();
    expect(state.alwaysAvoid).toEqual(["knees", "back"]);
    expect(state.equipment).toEqual(["none", "wall"]);
    expect(state.onboardingCompleted).toBe(true);
  });

  it("persists to disk so a relaunch keeps the list", async () => {
    useSettingsStore.getState().setAlwaysAvoid(["wrists"]);
    await flushPersistence();
    const raw = await AsyncStorage.getItem("fither/settings-v1");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as { state: { alwaysAvoid: string[] } };
    expect(persisted.state.alwaysAvoid).toEqual(["wrists"]);
  });

  it("composes with the settings editor's toggle afterwards", () => {
    useSettingsStore.getState().setAlwaysAvoid(["knees"]);
    useSettingsStore.getState().toggleAlwaysAvoid("knees");
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    useSettingsStore.getState().toggleAlwaysAvoid("hips");
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["hips"]);
  });
});
