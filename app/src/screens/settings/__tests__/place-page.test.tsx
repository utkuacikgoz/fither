import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { hasVoiceAudio } from "../../../session/voice-manifest";
import { usePlaceStore } from "../../../state/place-store";
import { useSettingsStore } from "../../../state/settings-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { PlacePage } from "../pages/place-page";
import { SETTINGS_ROUTES } from "../settings-screen";
import { flushPersistence, resetSettingsStores } from "./settings-test-setup";

jest.mock("../../../session/voice-manifest", () => ({
  voiceCues: {},
  voiceCue: () => null,
  hasVoiceAudio: jest.fn(() => false),
}));

const hidden = { includeHiddenElements: true } as const;

beforeEach(async () => {
  await resetSettingsStores();
  jest.mocked(hasVoiceAudio).mockReturnValue(false);
});

describe("Settings → Where I train", () => {
  it("shows the title, the two places with home checked and home's presets, and nothing that explains the page", () => {
    const screen = render(<PlacePage />);
    expect(screen.getByText(strings.place.title)).toBeTruthy();
    expect(screen.getByText(strings.place.sectionPlace)).toBeTruthy();
    expect(screen.getByText(strings.place.home)).toBeTruthy();
    expect(screen.getByText(strings.place.hotel)).toBeTruthy();
    expect(screen.getByTestId("place-home-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("place-hotel-check", hidden)).toBeNull();
    expect(screen.getByTestId("place-presets-caption")).toHaveTextContent(strings.place.sectionAtHome);
    expect(screen.getByTestId("place-equipment-value")).toHaveTextContent(
      strings.settings.rows.equipmentValue.chair,
    );
    expect(screen.getByTestId("place-quiet-value")).toHaveTextContent(strings.place.quietAsk);
    // Copy cut (2026-09-14): no lead above, no footnote below.
    expect(screen.queryByTestId("place-note")).toBeNull();
  });

  it("switching to the hotel checks it, brings its equipment, and shows its presets", () => {
    const screen = render(<PlacePage />);
    fireEvent.press(screen.getByTestId("place-hotel"));
    expect(usePlaceStore.getState().place).toBe("hotel");
    expect(screen.getByTestId("place-hotel-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("place-home-check", hidden)).toBeNull();
    expect(screen.getByTestId("place-presets-caption")).toHaveTextContent(strings.place.sectionAtHotel);
    // The hotel's remembered equipment is now the engine's input.
    expect(useSettingsStore.getState().equipment).toEqual(["none", "wall"]);
    expect(screen.getByTestId("place-equipment-value")).toHaveTextContent(
      strings.settings.rows.equipmentValue.floorOnly,
    );
  });

  it("switching place never clears what she always works around", async () => {
    useSettingsStore.setState({ alwaysAvoid: ["wrists", "knees"] });
    const screen = render(<PlacePage />);
    fireEvent.press(screen.getByTestId("place-hotel"));
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["wrists", "knees"]);
    fireEvent.press(screen.getByTestId("place-home"));
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["wrists", "knees"]);
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/settings-v1")).toContain("wrists");
  });

  it("the quiet row toggles the ACTIVE place's default in place and persists it", async () => {
    const screen = render(<PlacePage />);
    fireEvent.press(screen.getByTestId("place-quiet"));
    expect(usePlaceStore.getState().presets.home.quiet).toBe("always");
    expect(usePlaceStore.getState().presets.hotel.quiet).toBe("ask");
    expect(screen.getByTestId("place-quiet-value")).toHaveTextContent(strings.place.quietAlways);
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/place-v1")).toContain('"quiet":"always"');
    fireEvent.press(screen.getByTestId("place-quiet"));
    expect(usePlaceStore.getState().presets.home.quiet).toBe("ask");
    expect(screen.getByTestId("place-quiet-value")).toHaveTextContent(strings.place.quietAsk);

    // At the hotel, the row is the hotel's.
    fireEvent.press(screen.getByTestId("place-hotel"));
    fireEvent.press(screen.getByTestId("place-quiet"));
    expect(usePlaceStore.getState().presets.hotel.quiet).toBe("always");
    expect(usePlaceStore.getState().presets.home.quiet).toBe("ask");
  });

  it("the equipment row opens the existing Equipment page", () => {
    const screen = render(<PlacePage />);
    expect(screen.getByTestId("place-equipment-chevron", hidden)).toBeTruthy();
    fireEvent.press(screen.getByTestId("place-equipment"));
    expect(router.push).toHaveBeenCalledWith(SETTINGS_ROUTES.equipment);
  });

  it("offers the voice group only when spoken cues are bundled, with its state as the value", () => {
    const silent = render(<PlacePage />);
    expect(silent.queryByText(strings.place.sectionVoice)).toBeNull();
    expect(silent.queryByTestId("place-voice-row")).toBeNull();
    silent.unmount();

    jest.mocked(hasVoiceAudio).mockReturnValue(true);
    const screen = render(<PlacePage />);
    expect(screen.getByText(strings.place.sectionVoice)).toBeTruthy();
    expect(screen.getByTestId("place-voice-row-value")).toHaveTextContent(strings.settings.voice.off);
    fireEvent.press(screen.getByTestId("place-voice-row"));
    expect(router.push).toHaveBeenCalledWith(SETTINGS_ROUTES.voice);
    screen.unmount();

    useSettingsStore.setState({ voice: true });
    const spoken = render(<PlacePage />);
    expect(spoken.getByTestId("place-voice-row-value")).toHaveTextContent(strings.settings.voice.on);
  });

  it("renders no user-facing text outside strings.ts", () => {
    jest.mocked(hasVoiceAudio).mockReturnValue(true);
    const allowed = collectStringValues(strings);
    allowed.add(glyph.check);
    for (const leaf of renderedTextLeaves(render(<PlacePage />).toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
