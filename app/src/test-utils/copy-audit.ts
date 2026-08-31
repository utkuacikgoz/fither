// Helpers for the "no hardcoded user-facing text" audit: every text leaf
// a screen renders must come from strings.ts (or an explicitly allowed
// dynamic/dev-only value). Keeps the copy-writer's single surface honest.

/** Every literal string value reachable in the strings object (functions skipped). */
export function collectStringValues(
  node: unknown,
  out: Set<string> = new Set(),
): Set<string> {
  if (typeof node === "string") {
    out.add(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectStringValues(item, out);
  } else if (node !== null && typeof node === "object") {
    for (const value of Object.values(node)) collectStringValues(value, out);
  }
  return out;
}

/**
 * Every string leaf in a rendered test tree (`screen.toJSON()`) — i.e.
 * everything on screen. Structural typing avoids depending on
 * react-test-renderer's (untyped) exports.
 */
export function renderedTextLeaves(tree: unknown, out: string[] = []): string[] {
  if (tree === null || tree === undefined) return out;
  if (typeof tree === "string") {
    out.push(tree);
    return out;
  }
  if (Array.isArray(tree)) {
    for (const item of tree) renderedTextLeaves(item, out);
    return out;
  }
  if (typeof tree === "object" && "children" in tree) {
    renderedTextLeaves((tree as { children: unknown }).children, out);
  }
  return out;
}
