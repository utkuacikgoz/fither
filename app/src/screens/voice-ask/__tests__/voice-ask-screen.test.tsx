import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { useSettingsStore } from "../../../state/settings-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { VoiceAskScreen } from "../voice-ask-screen";

beforeEach(() => {
  useSettingsStore.setState({ voice: false, voiceAsked: false, hydrated: true });
});

describe("VoiceAskScreen", () => {
  it("asks once: the headline, one line, the filled answer and its quiet peer", () => {
    const screen = render(<VoiceAskScreen onDone={jest.fn()} />);
    expect(screen.getByText(strings.voiceAsk.headline)).toBeTruthy();
    expect(screen.getByText(strings.voiceAsk.line)).toBeTruthy();
    expect(screen.getByTestId("voice-ask-allow")).toBeTruthy();
    expect(screen.getByTestId("voice-ask-decline")).toBeTruthy();
    // Decorative: hidden from VoiceOver, so the query must opt in to see it.
    const glyph = screen.getByTestId("voice-ask-glyph", { includeHiddenElements: true });
    expect(glyph.props.accessibilityElementsHidden).toBe(true);
  });

  it("the filled answer turns the voice on, spends the ask and leaves", () => {
    const onDone = jest.fn();
    const screen = render(<VoiceAskScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("voice-ask-allow"));
    expect(useSettingsStore.getState()).toMatchObject({ voice: true, voiceAsked: true });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the quiet answer keeps silence, spends the ask just the same, and leaves", () => {
    const onDone = jest.fn();
    const screen = render(<VoiceAskScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("voice-ask-decline"));
    expect(useSettingsStore.getState()).toMatchObject({ voice: false, voiceAsked: true });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders no user-facing text outside strings.ts", () => {
    const screen = render(<VoiceAskScreen onDone={jest.fn()} />);
    const allowed = collectStringValues(strings);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
