import { voiceCue } from "../voice-manifest";
import { sampleCue } from "../voice-sample";
import { fixtureLibrary } from "../../test-utils/fixtures";

jest.mock("../voice-manifest", () => ({
  voiceCue: jest.fn(() => null),
  hasVoiceAudio: jest.fn(() => true),
}));

it("is the first in-set cue in the library that has a bundled file", () => {
  const all = fixtureLibrary.movements.flatMap((m) => m.inSetCues);
  const wanted = all[1] ?? all[0];
  jest.mocked(voiceCue).mockImplementation((cue) => (cue === wanted ? 1 : null));
  expect(sampleCue(fixtureLibrary)).toBe(wanted);
});

it("is null with nothing bundled, and null without a library", () => {
  jest.mocked(voiceCue).mockImplementation(() => null);
  expect(sampleCue(fixtureLibrary)).toBeNull();
  expect(sampleCue(null)).toBeNull();
});
