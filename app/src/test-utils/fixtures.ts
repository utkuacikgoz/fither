// Shared test fixtures shaped by the engine contract (types.ts). The
// engine implementation is still a stub, so integration paths are
// exercised against these until it lands.

import type {
  BlockOutcome,
  ApplyResult,
  DailyPrompt,
  MovementLibrary,
  Session,
} from "@fither/engine";

import type { PlayerBlock } from "../session/player-machine";

export const fixtureLibrary: MovementLibrary = {
  version: 1,
  movements: [
    {
      id: "wall-push-up",
      name: "Wall Push-Up",
      pattern: "push",
      tier: 1,
      progressionTo: "incline-push-up",
      silent: true,
      equipment: "wall",
      loads: ["shoulders", "wrists", "elbows"],
      unilateral: false,
      timing: { type: "reps", defaultValue: 8, secondsPerRep: 3 },
      cues: ["Push through your palms.", "Keep your body in one line."],
      inSetCues: ["Elbows back, not out.", "Hips level with your shoulders."],
    },
    {
      id: "plank",
      name: "Plank",
      pattern: "core",
      tier: 1,
      progressionTo: "side-plank",
      silent: true,
      equipment: "none",
      loads: ["core", "shoulders", "wrists"],
      unilateral: false,
      timing: { type: "seconds", defaultValue: 20 },
      cues: ["Squeeze your glutes.", "Breathe steadily."],
      inSetCues: ["Ribs down, keep breathing."],
    },
  ],
};

export const fixturePrompt: DailyPrompt = {
  minutes: 10,
  energy: "okay",
  quiet: true,
  avoid: [],
  date: "2026-08-31",
  equipment: ["none", "chair", "wall"],
};

export const fixtureSession: Session = {
  date: "2026-08-31",
  minutes: 10,
  blocks: [
    {
      movementId: "wall-push-up",
      pattern: "push",
      sets: 2,
      amount: 8,
      restSeconds: 30,
      estimatedSeconds: 78,
      atNewTier: false,
    },
    {
      movementId: "plank",
      pattern: "core",
      sets: 1,
      amount: 20,
      restSeconds: 0,
      estimatedSeconds: 20,
      atNewTier: false,
    },
  ],
  estimatedTotalSeconds: 98,
  seed: 42,
  adaptations: [],
};

export const fixturePlayerBlocks: PlayerBlock[] = [
  {
    movementId: "wall-push-up",
    name: "Wall Push-Up",
    cues: ["Push through your palms.", "Keep your body in one line."],
    inSetCues: ["Elbows back, not out.", "Hips level with your shoulders."],
    unilateral: false,
    sets: 2,
    amount: 8,
    restSeconds: 30,
    timingType: "reps",
  },
  {
    movementId: "plank",
    name: "Plank",
    cues: ["Squeeze your glutes.", "Breathe steadily."],
    inSetCues: ["Ribs down, keep breathing."],
    unilateral: false,
    sets: 1,
    amount: 20,
    restSeconds: 0,
    timingType: "seconds",
  },
];

export function fixtureApplyResult(): ApplyResult {
  return {
    profile: {
      patterns: {
        push: { tier: 4, cleanCount: 0, struggleCount: 0, volumeReduced: false },
        pull: { tier: 1, cleanCount: 1, struggleCount: 0, volumeReduced: false },
        squat: { tier: 1, cleanCount: 0, struggleCount: 0, volumeReduced: false },
        hinge: { tier: 1, cleanCount: 0, struggleCount: 0, volumeReduced: false },
        core: { tier: 1, cleanCount: 2, struggleCount: 0, volumeReduced: false },
      },
      unlockedMilestones: [{ pattern: "push", tier: 4 }],
    },
    history: {
      entries: [
        {
          date: "2026-08-31",
          minutes: 10,
          blocks: [
            { movementId: "wall-push-up", pattern: "push", outcome: "completed" },
            { movementId: "plank", pattern: "core", outcome: "completed" },
          ],
        },
      ],
    },
    ledgerEvents: [
      { type: "session", points: 10, date: "2026-08-31" },
      {
        type: "skillUnlock",
        points: 25,
        date: "2026-08-31",
        pattern: "push",
        movementId: "full-push-up",
      },
    ],
    unlockedSkills: [{ pattern: "push", tier: 4, movementName: "Full Push-Up" }],
  };
}

/**
 * An apply result whose history entry carries the given outcomes and
 * whose ledger is empty — the shape the engine returns for a session
 * with nothing completed (skipped or struggled blocks earn nothing).
 * The close reads the history entry (ADR-0023), so tests of the
 * nothing-done and "Hard today" paths seed it here, not the ledger.
 */
export function fixtureApplyResultOutcomes(
  outcomes: readonly BlockOutcome[],
): ApplyResult {
  const base = fixtureApplyResult();
  const entry = base.history.entries[0]!;
  return {
    ...base,
    history: {
      entries: [
        {
          ...entry,
          blocks: entry.blocks.map((block, index) => ({
            ...block,
            outcome: outcomes[index] ?? "skipped",
          })),
        },
      ],
    },
    ledgerEvents: [],
    unlockedSkills: [],
  };
}
