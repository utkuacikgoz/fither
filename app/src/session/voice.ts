import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

import { voiceCue } from "./voice-manifest";

// Voice: the coaching cue she is looking at, spoken once by the app's one
// coach voice. Playback only — every file is bundled by the generator
// (scripts/generate-voice-audio.mjs), so nothing here can touch the
// network and airplane mode changes nothing.
//
// Two rules live outside this file, where the facts are: the player
// decides WHETHER to speak (her Settings choice, and never on a day she
// answered "quiet"); this module only speaks a cue it was handed. The
// phone's silent switch wins absolutely — playsInSilentMode stays false,
// the platform default, and is set explicitly so a future change is a
// visible decision rather than a drift.

let modeReady: Promise<void> | null = null;

function ensureAudioMode(): Promise<void> {
  if (modeReady === null) {
    modeReady = setAudioModeAsync({ playsInSilentMode: false }).catch(() => {
      // Unknown platform state — keep playing with defaults.
    });
  }
  return modeReady;
}

/**
 * Speak one cue. Returns whether a file existed to play: a cue with no
 * bundled audio is silently skipped, never an error. Playback errors are
 * swallowed for the same reason — mid-set is no place for a message.
 */
export async function speakCue(cue: string): Promise<boolean> {
  const source = voiceCue(cue);
  if (source === null) return false;
  try {
    await ensureAudioMode();
    const player = createAudioPlayer(source);
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        player.remove();
      }
    });
    player.play();
    return true;
  } catch {
    return false;
  }
}

/** Test seam: forget the one-time audio-mode setup. */
export function resetVoiceForTests(): void {
  modeReady = null;
}
