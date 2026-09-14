import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { useSettingsStore } from "../../../state/settings-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { speakCue } from "../../../session/voice";
import { VoicePage } from "../pages/voice-page";
import { resetSettingsStores } from "./settings-test-setup";

const hidden = { includeHiddenElements: true } as const;

jest.mock("../../../session/voice", () => ({ speakCue: jest.fn(async () => true), stopVoice: jest.fn() }));
jest.mock("../../../session/voice-sample", () => ({ sampleCue: jest.fn(() => "Squeeze your glutes.") }));

beforeEach(async () => {
  await resetSettingsStores();
});

describe("Settings → Voice", () => {
  it("shows the title, the two facts, and Silent checked by default", () => {
    const screen = render(<VoicePage />);
    expect(screen.getByText(strings.settings.voice.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.voice.body)).toBeTruthy();
    expect(screen.getByText(strings.settings.voice.on)).toBeTruthy();
    expect(screen.getByText(strings.settings.voice.off)).toBeTruthy();
    // Off by default: audio she did not ask for is the wrong surprise.
    expect(screen.getByTestId("voice-off-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("voice-on-check", hidden)).toBeNull();
  });

  it("the choice is hers and saves on tap, the check following", () => {
    const screen = render(<VoicePage />);
    fireEvent.press(screen.getByTestId("voice-on"));
    expect(useSettingsStore.getState().voice).toBe(true);
    expect(screen.getByTestId("voice-on-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("voice-off-check", hidden)).toBeNull();
    fireEvent.press(screen.getByTestId("voice-off"));
    expect(useSettingsStore.getState().voice).toBe(false);
    expect(screen.getByTestId("voice-off-check", hidden)).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    allowed.add(glyph.check);
    for (const leaf of renderedTextLeaves(render(<VoicePage />).toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});

it("switching the voice on answers in the voice: one real cue, once; off says nothing", () => {
  const screen = render(<VoicePage />);
  fireEvent.press(screen.getByTestId("voice-on"));
  expect(speakCue).toHaveBeenCalledWith("Squeeze your glutes.");
  expect(speakCue).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId("voice-off"));
  expect(speakCue).toHaveBeenCalledTimes(1);
});
