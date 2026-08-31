// Seed = hash(date + per-user salt). Deterministic for a given user and
// day, different across users. This is app-side plumbing, not engine
// logic: the engine takes the seed as an input (contract types.ts).

/** FNV-1a 32-bit over the salted date string. Returns an unsigned int. */
export function deriveSeed(dateIso: string, salt: number): number {
  const input = `${salt}:${dateIso}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
