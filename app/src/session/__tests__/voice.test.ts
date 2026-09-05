import * as Audio from "expo-audio";

import { resetVoiceForTests, speakCue, stopVoice } from "../voice";

// Playback only — the manifest decides what exists; this module never
// errors mid-set. The manifest is generated (empty until the owner runs
// the generator), so it is stubbed per test here.

jest.mock("../voice-manifest", () => ({
  voiceCue: jest.fn((cue: string) => (cue === "Push through your palms." ? 1 : null)),
  hasVoiceAudio: jest.fn(() => true),
}));

type Mocked = typeof Audio & {
  __players: Array<{ play: jest.Mock; remove: jest.Mock; listeners: Array<(s: unknown) => void> }>;
};
const audio = Audio as Mocked;

beforeEach(() => {
  audio.__players.length = 0;
  resetVoiceForTests();
});

it("speaks a cue that has a bundled file, once, and releases the player when done", async () => {
  expect(await speakCue("Push through your palms.")).toBe(true);
  expect(audio.__players).toHaveLength(1);
  const player = audio.__players[0]!;
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(player.remove).not.toHaveBeenCalled();
  player.listeners[0]!({ didJustFinish: true });
  expect(player.remove).toHaveBeenCalledTimes(1);
});

it("a cue with no bundled audio is skipped silently — never an error", async () => {
  expect(await speakCue("Keep your body in one line.")).toBe(false);
  expect(audio.__players).toHaveLength(0);
});

it("the phone's silent switch wins: the audio mode never plays in silent mode", async () => {
  await speakCue("Push through your palms.");
  expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false });
  // Set once for the process, not per cue.
  await speakCue("Push through your palms.");
  expect(Audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
});

it("a playback failure is swallowed — mid-set is no place for a message", async () => {
  jest.mocked(Audio.createAudioPlayer).mockImplementationOnce(() => {
    throw new Error("no audio session");
  });
  expect(await speakCue("Push through your palms.")).toBe(false);
});

it("one voice at a time: a new cue releases the one still speaking", async () => {
  await speakCue("Push through your palms.");
  await speakCue("Push through your palms.");
  expect(audio.__players).toHaveLength(2);
  expect(audio.__players[0]!.remove).toHaveBeenCalledTimes(1);
  expect(audio.__players[1]!.remove).not.toHaveBeenCalled();
});

it("stopVoice releases whatever is speaking, and is safe when nothing is", async () => {
  stopVoice();
  await speakCue("Push through your palms.");
  stopVoice();
  expect(audio.__players[0]!.remove).toHaveBeenCalledTimes(1);
  stopVoice();
  expect(audio.__players[0]!.remove).toHaveBeenCalledTimes(1);
});

it("a failed audio-mode setup is retried next time, not cached as done", async () => {
  jest.mocked(Audio.setAudioModeAsync).mockRejectedValueOnce(new Error("no session"));
  await speakCue("Push through your palms.");
  await speakCue("Push through your palms.");
  expect(Audio.setAudioModeAsync).toHaveBeenCalledTimes(2);
});
