import { hasVoiceAudio } from "../../session/voice-manifest";
import { useSettingsStore } from "../../state/settings-store";
import { nextStartRoute } from "../start-flow";

jest.mock("../../session/voice-manifest", () => ({ hasVoiceAudio: jest.fn(() => true) }));
const mockedHasVoiceAudio = jest.mocked(hasVoiceAudio);

// Begin's next route (owner decision 2026-09-08): the voice ask exactly
// while it is owed, the player otherwise. The mirror of close-flow.

beforeEach(() => {
  mockedHasVoiceAudio.mockReturnValue(true);
  useSettingsStore.setState({ voice: false, voiceAsked: false, hydrated: true });
});

it("goes to the voice ask on the first start, then straight to the session", () => {
  expect(nextStartRoute()).toBe("/voice-ask");
  useSettingsStore.getState().answerVoiceAsk(false);
  expect(nextStartRoute()).toBe("/session");
});

it("never asks without bundled audio or before settings hydrate", () => {
  mockedHasVoiceAudio.mockReturnValue(false);
  expect(nextStartRoute()).toBe("/session");
  mockedHasVoiceAudio.mockReturnValue(true);
  useSettingsStore.setState({ hydrated: false });
  expect(nextStartRoute()).toBe("/session");
});
