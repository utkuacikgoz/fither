import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { clearRecordedEvents, recordedEvents, recordedPerson } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { useSettingsStore } from "../../../state/settings-store";
import { startPersonSyncForTest } from "../../../test-utils/person-sync";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { speakCue } from "../../../session/voice";
import { VoiceAskScreen } from "../voice-ask-screen";

jest.mock("../../../session/voice", () => ({ speakCue: jest.fn(async () => true), stopVoice: jest.fn() }));
jest.mock("../../../session/voice-sample", () => ({ sampleCue: jest.fn(() => "Squeeze your glutes.") }));

beforeEach(() => {
  clearRecordedEvents();
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

  it.each([
    ["voice-ask-allow", true],
    ["voice-ask-decline", false],
  ] as const)("%s reports voice_ask and syncs the person's voice fact", (testID, voice) => {
    // The screen answers the settings store and nothing else; the person
    // sync the app root runs watches that store and carries the fact.
    const stopPersonSync = startPersonSyncForTest();
    const screen = render(<VoiceAskScreen onDone={jest.fn()} />);
    expect(recordedEvents()).toEqual([]);
    fireEvent.press(screen.getByTestId(testID));
    expect(recordedEvents()).toEqual([{ name: "voice_ask", properties: { voice } }]);
    expect(recordedPerson()).toMatchObject({ voice });
    stopPersonSync();
  });

  it("renders no user-facing text outside strings.ts", () => {
    const screen = render(<VoiceAskScreen onDone={jest.fn()} />);
    const allowed = collectStringValues(strings);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});

it("allowing the voice hears it at once; declining hears nothing", () => {
  const allow = render(<VoiceAskScreen onDone={jest.fn()} />);
  fireEvent.press(allow.getByTestId("voice-ask-allow"));
  expect(speakCue).toHaveBeenCalledWith("Squeeze your glutes.");
  allow.unmount();
  jest.mocked(speakCue).mockClear();
  const decline = render(<VoiceAskScreen onDone={jest.fn()} />);
  fireEvent.press(decline.getByTestId("voice-ask-decline"));
  expect(speakCue).not.toHaveBeenCalled();
});
