import type { Movement, MovementLibrary } from "@fither/engine";

// data/movements.json is authored by the movement-author agent and may not
// exist yet in this build. We load it defensively so typecheck and tests
// never depend on its presence (brief-sanctioned try/require pattern).
// The library is data passed INTO the engine; the engine never reads files.

declare function require(moduleId: string): unknown;

let cached: MovementLibrary | null | undefined;

function isLibrary(value: unknown): value is MovementLibrary {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { version?: unknown; movements?: unknown };
  return (
    typeof candidate.version === "number" && Array.isArray(candidate.movements)
  );
}

/** Returns the movement library, or null when it is not bundled/valid. */
export function loadLibrary(): MovementLibrary | null {
  if (cached !== undefined) return cached;
  try {
    const raw = require("../../../data/movements.json");
    cached = isLibrary(raw) ? raw : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Simple id lookup for display info (name, cues). No rules live here. */
export function findMovement(
  library: MovementLibrary,
  movementId: string,
): Movement | null {
  return library.movements.find((m) => m.id === movementId) ?? null;
}

/** Test hook: clear the module cache. */
export function resetLibraryCache(): void {
  cached = undefined;
}
