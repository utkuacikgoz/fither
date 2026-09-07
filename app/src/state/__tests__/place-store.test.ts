import AsyncStorage from "@react-native-async-storage/async-storage";

import { fixturePrompt } from "../../test-utils/fixtures";
import {
  activeQuietMode,
  placeEquipment,
  usePlaceStore,
} from "../place-store";
import { useSessionStore } from "../session-store";
import {
  FLOOR_ONLY_EQUIPMENT,
  useSettingsStore,
  WITH_CHAIR_EQUIPMENT,
} from "../settings-store";

// The place preset (owner brief 2026-09-07, wave 4). The settings store's
// equipment stays the one thing the engine reads; a switch of place is
// the explicit action that writes it. Nothing here may reach a
// restriction: alwaysAvoid and today's picks survive every switch.

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({
    equipment: WITH_CHAIR_EQUIPMENT,
    alwaysAvoid: [],
    onboardingCompleted: true,
    hydrated: true,
    hydrationFailed: false,
  });
  usePlaceStore.setState({
    ...usePlaceStore.getInitialState(),
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.getState().resetSession();
});

describe("defaults", () => {
  it("starts at home, asking the quiet question in both places", () => {
    const state = usePlaceStore.getState();
    expect(state.place).toBe("home");
    expect(state.presets.home.quiet).toBe("ask");
    expect(state.presets.hotel.quiet).toBe("ask");
    expect(activeQuietMode(state)).toBe("ask");
  });

  it("home is the settings store's equipment; a hotel is floor and wall only", () => {
    const state = usePlaceStore.getState();
    const settings = useSettingsStore.getState().equipment;
    expect(placeEquipment(state, settings, "home")).toEqual(WITH_CHAIR_EQUIPMENT);
    expect(placeEquipment(state, settings, "hotel")).toEqual(FLOOR_ONLY_EQUIPMENT);
    // Home follows whatever onboarding chose, without a switch having happened.
    useSettingsStore.getState().completeOnboarding(FLOOR_ONLY_EQUIPMENT, []);
    expect(
      placeEquipment(usePlaceStore.getState(), useSettingsStore.getState().equipment, "home"),
    ).toEqual(FLOOR_ONLY_EQUIPMENT);
  });
});

describe("setPlace — the switch", () => {
  it("copies the new place's equipment into the settings store, and back", () => {
    usePlaceStore.getState().setPlace("hotel");
    expect(usePlaceStore.getState().place).toBe("hotel");
    expect(useSettingsStore.getState().equipment).toEqual(FLOOR_ONLY_EQUIPMENT);

    usePlaceStore.getState().setPlace("home");
    expect(usePlaceStore.getState().place).toBe("home");
    expect(useSettingsStore.getState().equipment).toEqual(WITH_CHAIR_EQUIPMENT);
  });

  it("remembers what the place she leaves held — home keeps onboarding's floor-only choice", () => {
    useSettingsStore.getState().completeOnboarding(FLOOR_ONLY_EQUIPMENT, []);
    usePlaceStore.getState().setPlace("hotel");
    usePlaceStore.getState().setEquipment("hotel", WITH_CHAIR_EQUIPMENT);
    expect(useSettingsStore.getState().equipment).toEqual(WITH_CHAIR_EQUIPMENT);

    usePlaceStore.getState().setPlace("home");
    expect(useSettingsStore.getState().equipment).toEqual(FLOOR_ONLY_EQUIPMENT);
    // And the hotel remembers its chair for next time.
    expect(usePlaceStore.getState().presets.hotel.equipment).toEqual(WITH_CHAIR_EQUIPMENT);
  });

  it("switching to the place she is already in changes nothing", () => {
    useSettingsStore.setState({ equipment: FLOOR_ONLY_EQUIPMENT });
    usePlaceStore.getState().setPlace("home");
    expect(useSettingsStore.getState().equipment).toEqual(FLOOR_ONLY_EQUIPMENT);
  });

  it("never clears a restriction: alwaysAvoid and today's prompt survive every switch", () => {
    useSettingsStore.getState().setAlwaysAvoid(["knees", "wrists"]);
    useSessionStore.setState({ prompt: { ...fixturePrompt, avoid: ["back"] } });

    usePlaceStore.getState().setPlace("hotel");
    usePlaceStore.getState().setQuiet("hotel", "always");
    usePlaceStore.getState().setEquipment("hotel", WITH_CHAIR_EQUIPMENT);
    usePlaceStore.getState().setPlace("home");
    usePlaceStore.getState().setEquipment("home", FLOOR_ONLY_EQUIPMENT);

    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["knees", "wrists"]);
    expect(useSessionStore.getState().prompt?.avoid).toEqual(["back"]);
  });

  it("has no way to reach the voice setting", () => {
    useSettingsStore.setState({ voice: true });
    usePlaceStore.getState().setQuiet("home", "always");
    usePlaceStore.getState().setPlace("hotel");
    expect(useSettingsStore.getState().voice).toBe(true);
  });
});

describe("setEquipment", () => {
  it("for the active place reaches the settings store at once", () => {
    usePlaceStore.getState().setEquipment("home", FLOOR_ONLY_EQUIPMENT);
    expect(useSettingsStore.getState().equipment).toEqual(FLOOR_ONLY_EQUIPMENT);
    expect(usePlaceStore.getState().presets.home.equipment).toEqual(FLOOR_ONLY_EQUIPMENT);
  });

  it("for the other place only changes what it will bring on the next switch", () => {
    usePlaceStore.getState().setEquipment("hotel", WITH_CHAIR_EQUIPMENT);
    expect(useSettingsStore.getState().equipment).toEqual(WITH_CHAIR_EQUIPMENT);
    expect(
      placeEquipment(usePlaceStore.getState(), useSettingsStore.getState().equipment, "hotel"),
    ).toEqual(WITH_CHAIR_EQUIPMENT);

    useSettingsStore.setState({ equipment: FLOOR_ONLY_EQUIPMENT });
    usePlaceStore.getState().setEquipment("hotel", FLOOR_ONLY_EQUIPMENT);
    expect(useSettingsStore.getState().equipment).toEqual(FLOOR_ONLY_EQUIPMENT);
    usePlaceStore.getState().setEquipment("hotel", WITH_CHAIR_EQUIPMENT);
    // Home is active: the settings store is untouched by a hotel edit.
    expect(useSettingsStore.getState().equipment).toEqual(FLOOR_ONLY_EQUIPMENT);
    usePlaceStore.getState().setPlace("hotel");
    expect(useSettingsStore.getState().equipment).toEqual(WITH_CHAIR_EQUIPMENT);
  });
});

describe("setQuiet", () => {
  it("sets one place's default and touches nothing else", () => {
    usePlaceStore.getState().setQuiet("hotel", "always");
    const state = usePlaceStore.getState();
    expect(state.presets.hotel.quiet).toBe("always");
    expect(state.presets.home.quiet).toBe("ask");
    expect(activeQuietMode(state)).toBe("ask");
    expect(useSettingsStore.getState().equipment).toEqual(WITH_CHAIR_EQUIPMENT);

    usePlaceStore.getState().setPlace("hotel");
    expect(activeQuietMode(usePlaceStore.getState())).toBe("always");
  });
});

describe("persistence", () => {
  it("writes the place and both presets under fither/place-v1", async () => {
    usePlaceStore.getState().setQuiet("hotel", "always");
    usePlaceStore.getState().setPlace("hotel");
    await flushPersistence();
    const raw = await AsyncStorage.getItem("fither/place-v1");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as {
      state: { place: string; presets: Record<string, { equipment: string[]; quiet: string }> };
    };
    expect(persisted.state.place).toBe("hotel");
    expect(persisted.state.presets.hotel).toEqual({
      equipment: FLOOR_ONLY_EQUIPMENT,
      quiet: "always",
    });
    expect(persisted.state.presets.home).toEqual({
      equipment: WITH_CHAIR_EQUIPMENT,
      quiet: "ask",
    });
    // Nothing of the settings store's leaks into the place key.
    expect(raw).not.toContain("alwaysAvoid");
    expect(raw).not.toContain("voice");
  });
});
