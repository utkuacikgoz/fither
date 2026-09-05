import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

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
//
// One player at a time (reviewer should-fix): a new cue releases the
// previous one, so two fast transitions never overlap, and stopVoice()
// releases it when the session leaves the screen or a block is skipped,
// so a cue interrupted by a call does not keep its native player for the
// rest of the process.

let modeReady: Promise<void> | null = null;
let current: AudioPlayer | null = null;

function ensureAudioMode(): Promise<void> {
  if (modeReady === null) {
    modeReady = setAudioModeAsync({ playsInSilentMode: false }).catch(() => {
      // Unknown platform state — keep playing with defaults, and try the
      // mode again next time rather than caching the failure.
      modeReady = null;
    });
  }
  return modeReady;
}

function release(player: AudioPlayer): void {
  try {
    player.remove();
  } catch {
    // Already released — nothing to do.
  }
}

/** Stop whatever is speaking and release it. Safe to call when silent. */
export function stopVoice(): void {
  if (current === null) return;
  const player = current;
  current = null;
  release(player);
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
    stopVoice();
    const player = createAudioPlayer(source);
    current = player;
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        if (current === player) current = null;
        release(player);
      }
    });
    player.play();
    return true;
  } catch {
    return false;
  }
}

/** Test seam: forget the one-time audio-mode setup and any player. */
export function resetVoiceForTests(): void {
  modeReady = null;
  current = null;
}
