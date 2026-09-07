import {
  MAX_TIER,
  milestoneMovement,
  type MovementLibrary,
  type Pattern,
  type Tier,
} from "@fither/engine";

import { strings } from "../copy/strings";

/**
 * The canonical ladder-step name at (pattern, tier) — how an earned skill
 * is named on every surface (progress, home). Resolution is the engine's
 * milestoneMovement, the same lookup ApplyResult uses for the unlock
 * moment; nothing here decides which tiers are milestones.
 *
 * Fallback mirrors toPlayerBlocks' movementId fallback: a build without
 * the library is already a degraded state everywhere; raw pattern data
 * beats an invented (forbidden) literal.
 */
export function skillLabel(
  library: MovementLibrary | null,
  pattern: Pattern,
  tier: Tier,
): string {
  // A degraded build (library absent, or a milestone the library no
  // longer names) still says the ladder and the rung in her own words,
  // never a raw pattern id.
  const name = library ? milestoneMovement(library, pattern, tier)?.name : undefined;
  return (
    name ??
    strings.profile.skills.unnamed(
      strings.profile.patterns.names[pattern],
      strings.profile.tier(tier, MAX_TIER),
    )
  );
}

/**
 * The movement id behind a milestone, for its figure — the same
 * resolution as skillLabel, so a skill is never named by one movement
 * and drawn as another. "" when the library is absent (the figure
 * primitive renders nothing for an unknown id).
 */
export function skillFigureId(
  library: MovementLibrary | null,
  pattern: Pattern,
  tier: Tier,
): string {
  if (!library) return "";
  return milestoneMovement(library, pattern, tier)?.id ?? "";
}
