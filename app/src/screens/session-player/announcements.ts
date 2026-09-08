// VoiceOver announcements for the session player — composed ENTIRELY
// from strings.player / strings.finish plus the block data the player
// already renders (audit P0 #6). Announcements fire on phase TRANSITIONS
// only, never per tick: announcementKey identifies a machine position
// ignoring countdown seconds, so the screen announces once when the key
// changes and stays silent while a countdown runs. Pure module: no
// React, no AccessibilityInfo — the screen owns the side effect.

import { strings } from "../../copy/strings";
import type { PlayerState } from "../../session/player-machine";

/**
 * Stable identity for "one announcement per transition". Countdown ticks
 * keep the key; entering a phase (per block, set and side) changes it.
 */
export function announcementKey(state: PlayerState): string {
  const { phase } = state;
  const blockIndex = "blockIndex" in phase ? phase.blockIndex : -1;
  const setIndex = "setIndex" in phase ? phase.setIndex : -1;
  const side = phase.kind === "work" ? phase.side : null;
  return `${phase.kind}:${blockIndex}:${setIndex}:${side}`;
}

/**
 * What VoiceOver speaks on entering the current phase, or null for the
 * phases that carry their own focusable copy (feedback's one calm
 * question). Work announces the same cue the screen shows for that set
 * and side; rest announces the seconds she is entering rest with.
 */
export function phaseAnnouncement(state: PlayerState): string | null {
  const { phase } = state;
  // Done is announced by the FINISH screen, which knows the honest close
  // reason ("Session complete" vs "Today didn't fit" vs the time-kept
  // close) — announcing a generic success here could contradict it.
  if (phase.kind === "done") return null;
  if (phase.kind === "feedback") return null;
  const block = state.blocks[phase.blockIndex];
  if (!block) return null;
  switch (phase.kind) {
    case "blockIntro":
      return `${block.name}. ${strings.player.blockPlan(
        block.sets,
        block.amount,
        block.timingType === "seconds",
        block.unilateral,
      )}`;
    case "work": {
      const cue = workCue(state);
      const sideLabel =
        phase.side !== null ? strings.player.sides[phase.side] : null;
      const parts = [sideLabel, cue ?? block.name].filter(
        (part): part is string => part !== null,
      );
      return parts.join(". ");
    }
    case "sideSwitch":
      return `${strings.player.sides.switchTitle}. ${strings.player.sides.switchBody}`;
    case "rest":
      return `${strings.player.rest}. ${phase.remainingSeconds} ${strings.player.holdLabel}`;
  }
}

/**
 * The exact cue the screen renders for the current work set and side —
 * the ONE definition shared by the screen, VoiceOver and the spoken
 * voice, so all three say the same line. The in-set corrections carry
 * the set (owner decision 2026-09-08): one per set and side, rotating,
 * so a three-set block hears each. The setup cues stay at the intro and
 * are the fallback only for a block whose library entry has none. Null
 * outside work or for a block without cues of either kind.
 */
export function workCue(state: PlayerState): string | null {
  const { phase } = state;
  if (phase.kind !== "work") return null;
  const block = state.blocks[phase.blockIndex];
  if (!block) return null;
  const lines = block.inSetCues.length > 0 ? block.inSetCues : block.cues;
  if (lines.length === 0) return null;
  return lines[(phase.setIndex + (phase.side === "right" ? 1 : 0)) % lines.length] ?? null;
}

/** The voice counts the last five seconds of a rest or a timed hold. */
export const COUNTDOWN_FROM = 5;

type CountdownSecond = 1 | 2 | 3 | 4 | 5;

/**
 * The spoken countdown line for the current second, or null (owner
 * decision 2026-09-08): only a count that is running (a rest, or a
 * timed hold), only its last five seconds, and never the count's first
 * second — a hold or rest that short belongs to its start cue, not to a
 * warning on top of it. The five is the warning line; four to one are
 * the numbers. Spoken by the voice only: VoiceOver keeps its one
 * announcement per transition.
 */
export function countdownLine(state: PlayerState): string | null {
  const { phase } = state;
  if (phase.kind !== "rest" && phase.kind !== "work") return null;
  const remaining = phase.remainingSeconds;
  if (remaining === null || remaining < 1 || remaining > COUNTDOWN_FROM) return null;
  const block = state.blocks[phase.blockIndex];
  if (!block) return null;
  const total = phase.kind === "rest" ? block.restSeconds : block.amount;
  if (remaining >= total) return null;
  return strings.player.countdown(remaining as CountdownSecond);
}
