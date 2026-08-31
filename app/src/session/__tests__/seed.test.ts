import { deriveSeed } from "../seed";

describe("deriveSeed", () => {
  it("is deterministic for the same date and salt", () => {
    expect(deriveSeed("2026-08-31", 12345)).toBe(deriveSeed("2026-08-31", 12345));
  });

  it("changes with the date", () => {
    expect(deriveSeed("2026-08-31", 12345)).not.toBe(deriveSeed("2026-09-01", 12345));
  });

  it("changes with the salt (different users, different sessions)", () => {
    expect(deriveSeed("2026-08-31", 1)).not.toBe(deriveSeed("2026-08-31", 2));
  });

  it("returns an unsigned 32-bit integer", () => {
    const seed = deriveSeed("2026-08-31", 987654321);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});
