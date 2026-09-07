import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";

import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { movementFigure } from "../../../session/movement-figures";
import { useSettingsStore } from "../../../state/settings-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { EQUIPMENT_FIGURES } from "../../onboarding/onboarding-screen";
import { EquipmentPage } from "../pages/equipment-page";
import { flushPersistence, resetSettingsStores } from "./settings-test-setup";

const hidden = { includeHiddenElements: true } as const;

beforeEach(async () => {
  await resetSettingsStores();
});

describe("Settings → Equipment", () => {
  it("shows onboarding's two answers with their figures, the current one checked", () => {
    const screen = render(<EquipmentPage />);
    expect(screen.getByText(strings.settings.rows.equipment)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.equipment.options.floorOnly)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.equipment.options.chair)).toBeTruthy();
    expect(screen.getByTestId("equipment-chair-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("equipment-floor-only-check", hidden)).toBeNull();
    // Every option has a face: the same figures onboarding shows.
    const sources = screen.UNSAFE_getAllByType(Image).map((image) => image.props.source);
    expect(sources).toEqual(
      expect.arrayContaining([
        movementFigure(EQUIPMENT_FIGURES.floorOnly),
        movementFigure(EQUIPMENT_FIGURES.chair),
      ]),
    );
  });

  it("changes the stored equipment set at once — the exact onboarding sets, wall on both", async () => {
    const screen = render(<EquipmentPage />);
    fireEvent.press(screen.getByTestId("equipment-floor-only"));
    expect(useSettingsStore.getState().equipment).toEqual(["none", "wall"]);
    expect(screen.getByTestId("equipment-floor-only-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("equipment-chair-check", hidden)).toBeNull();
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/settings-v1")).not.toContain("chair");

    fireEvent.press(screen.getByTestId("equipment-chair"));
    expect(useSettingsStore.getState().equipment).toEqual(["none", "chair", "wall"]);
    expect(screen.getByTestId("equipment-chair-check", hidden)).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    allowed.add(glyph.check);
    for (const leaf of renderedTextLeaves(render(<EquipmentPage />).toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
