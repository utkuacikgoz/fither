// The free-sessions experiment (ADR-0025): one qualifying free session
// before the gate (today's policy, "control") against three ("three").
// App-layer commercial policy like entitlement.ts — never the engine's
// business — and evaluated fully offline: the variant is a persisted
// assignment read from the experiment store, so airplane mode changes
// nothing about what she is allowed to do.
//
// Activation is build configuration, not a remote flag:
//   EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS = "off" (default) | "on"
// "off": everyone is control and nothing is recorded — the production
// default until the owner switches it on explicitly. "on": a 50/50
// assignment is made once from the store's persisted seed, recorded,
// and stays put across launches.
import { useEffect } from "react";

import { useExperimentStore } from "../state/experiment-store";

export const FREE_SESSIONS_EXPERIMENT = {
  id: "free_sessions_v1",
  /** Variant → how many qualifying sessions are free before the gate. */
  variants: { control: 1, three: 3 },
} as const;

export type FreeSessionsVariant = keyof typeof FREE_SESSIONS_EXPERIMENT.variants;

const VARIANTS = Object.keys(FREE_SESSIONS_EXPERIMENT.variants) as readonly FreeSessionsVariant[];

export type ExperimentActivation = "off" | "on";

/** The build's switch. Anything but the literal "on" is off. */
export function freeSessionsActivation(): ExperimentActivation {
  return process.env.EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS === "on" ? "on" : "off";
}

function isVariant(value: string | null | undefined): value is FreeSessionsVariant {
  return VARIANTS.some((variant) => variant === value);
}

/**
 * The variant the current store state resolves to, without writing.
 * The dev override wins in a dev build only; "off" is always control;
 * an unhydrated store is control (never assign before the disk has
 * spoken — a write now could shadow a recorded assignment); otherwise
 * the recorded variant, or control until one is recorded.
 */
function resolveVariant(state: {
  hydrated: boolean;
  assignments: Readonly<Record<string, string>>;
  forceVariant: string | null;
}): FreeSessionsVariant {
  if (__DEV__ && isVariant(state.forceVariant)) return state.forceVariant;
  if (freeSessionsActivation() !== "on") return "control";
  if (!state.hydrated) return "control";
  const recorded = state.assignments[FREE_SESSIONS_EXPERIMENT.id];
  return isVariant(recorded) ? recorded : "control";
}

/**
 * Her variant. When the experiment is on and the store has hydrated,
 * the first read assigns and records; every later read returns the
 * recorded variant. Off records nothing.
 */
export function experimentAssignment(): FreeSessionsVariant {
  const state = useExperimentStore.getState();
  const forced = __DEV__ && isVariant(state.forceVariant);
  if (
    !forced &&
    freeSessionsActivation() === "on" &&
    state.hydrated &&
    !isVariant(state.assignments[FREE_SESSIONS_EXPERIMENT.id])
  ) {
    state.assign(FREE_SESSIONS_EXPERIMENT.id, VARIANTS);
  }
  return resolveVariant(useExperimentStore.getState());
}

/** How many qualifying sessions are free before the gate, for her variant. */
export function freeSessionsAllowance(): number {
  return FREE_SESSIONS_EXPERIMENT.variants[experimentAssignment()];
}

/**
 * The same allowance as a subscription, for screens: re-renders when
 * the store hydrates or the dev override changes. Assignment (a write)
 * happens in an effect, never during render.
 */
export function useFreeSessionsAllowance(): number {
  const hydrated = useExperimentStore((s) => s.hydrated);
  const assignments = useExperimentStore((s) => s.assignments);
  const forceVariant = useExperimentStore((s) => s.forceVariant);
  useEffect(() => {
    if (hydrated) experimentAssignment();
  }, [hydrated]);
  return FREE_SESSIONS_EXPERIMENT.variants[
    resolveVariant({ hydrated, assignments, forceVariant })
  ];
}
