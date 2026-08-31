import { describe, expect, it } from "vitest";
import { createRng } from "../src/index.js";

describe("createRng", () => {
  it("is deterministic: same seed, same stream", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it("different seeds give different streams", () => {
    const a = createRng(1);
    const b = createRng(2);
    const sameCount = Array.from({ length: 100 }, () => a() === b()).filter(
      Boolean,
    ).length;
    expect(sameCount).toBeLessThan(3);
  });

  it("stays in [0, 1)", () => {
    const rng = createRng(999);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
