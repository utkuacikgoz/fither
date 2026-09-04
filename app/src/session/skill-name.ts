import {
  milestoneMovement,
  type MovementLibrary,
  type Pattern,
  type Tier,
} from "@fither/engine";

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
  if (!library) return pattern;
  return milestoneMovement(library, pattern, tier)?.name ?? pattern;
}
