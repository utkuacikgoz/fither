import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { useSettingsStore } from "../../../state/settings-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { AvoidPage } from "../pages/avoid-page";
import { flushPersistence, resetSettingsStores } from "./settings-test-setup";

const hidden = { includeHiddenElements: true } as const;

beforeEach(async () => {
  await resetSettingsStores();
});

describe("Settings → Always work around", () => {
  it("shows the title, the lead and all eight areas as the shared grid", () => {
    const screen = render(<AvoidPage />);
    expect(screen.getByText(strings.settings.avoid.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.avoid.body)).toBeTruthy();
    for (const label of Object.values(strings.prompt.soreness.areas)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("toggling an area shows the check and persists to the settings store at once", async () => {
    const screen = render(<AvoidPage />);
    expect(screen.queryByTestId("avoid-knees-check", hidden)).toBeNull();
    fireEvent.press(screen.getByTestId("avoid-knees"));
    expect(screen.getByTestId("avoid-knees-check", hidden)).toBeTruthy();
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["knees"]);

    // Persisted immediately via the store layer (offline-safe disk write).
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/settings-v1")).toContain("knees");

    fireEvent.press(screen.getByTestId("avoid-knees"));
    expect(screen.queryByTestId("avoid-knees-check", hidden)).toBeNull();
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/settings-v1")).not.toContain("knees");
  });

  it("shows areas already on the persistent list as selected", () => {
    useSettingsStore.setState({ alwaysAvoid: ["wrists", "back"] });
    const screen = render(<AvoidPage />);
    expect(screen.getByTestId("avoid-wrists-check", hidden)).toBeTruthy();
    expect(screen.getByTestId("avoid-back-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("avoid-knees-check", hidden)).toBeNull();
  });

  it("renders no user-facing text outside strings.ts", () => {
    useSettingsStore.setState({ alwaysAvoid: ["wrists"] });
    const allowed = collectStringValues(strings);
    allowed.add(glyph.check);
    for (const leaf of renderedTextLeaves(render(<AvoidPage />).toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
