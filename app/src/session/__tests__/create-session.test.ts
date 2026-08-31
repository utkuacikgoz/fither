import { createInitialProfile } from "@fither/engine";

import { createSession, toPlayerBlocks } from "../create-session";
import { findMovement, loadLibrary, resetLibraryCache } from "../load-library";
import {
  fixtureLibrary,
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../test-utils/fixtures";

// Real integration: the engine implementation and data/movements.json have
// landed, so the boundary is exercised end-to-end here. Everything runs
// on device — this path IS the airplane-mode path.

describe("createSession boundary (integration)", () => {
  beforeEach(() => resetLibraryCache());

  it("generates a session that fits its time budget", () => {
    const result = createSession(fixturePrompt, createInitialProfile(), { entries: [] }, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { session, playerBlocks } = result.value;
    expect(session.blocks.length).toBeGreaterThan(0);
    expect(session.estimatedTotalSeconds).toBeLessThanOrEqual(session.minutes * 60);
    expect(playerBlocks).toHaveLength(session.blocks.length);
  });

  it("is deterministic for the same date and salt", () => {
    const profile = createInitialProfile();
    const a = createSession(fixturePrompt, profile, { entries: [] }, 7);
    const b = createSession(fixturePrompt, profile, { entries: [] }, 7);
    expect(a).toEqual(b);
  });

  it("varies with the salt (different users, different sessions)", () => {
    const profile = createInitialProfile();
    const a = createSession(fixturePrompt, profile, { entries: [] }, 7);
    const b = createSession(fixturePrompt, profile, { entries: [] }, 8);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.session.seed).not.toBe(b.value.session.seed);
  });

  it("resolves every generated block against the movement library", () => {
    const result = createSession(fixturePrompt, createInitialProfile(), { entries: [] }, 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const library = loadLibrary();
    expect(library).not.toBeNull();
    for (const block of result.value.playerBlocks) {
      const movement = findMovement(library!, block.movementId);
      expect(movement).not.toBeNull();
      expect(block.name).toBe(movement!.name);
      expect(block.cue).toBe(movement!.cues[0]);
      expect(block.timingType).toBe(movement!.timing.type);
    }
  });
});

describe("toPlayerBlocks", () => {
  it("joins session blocks with library display data", () => {
    expect(toPlayerBlocks(fixtureSession, fixtureLibrary)).toEqual(fixturePlayerBlocks);
  });

  it("falls back gracefully when a movement id is missing", () => {
    const session = {
      ...fixtureSession,
      blocks: [{ ...fixtureSession.blocks[0]!, movementId: "ghost" }],
    };
    const [block] = toPlayerBlocks(session, fixtureLibrary);
    expect(block).toMatchObject({ movementId: "ghost", name: "ghost", cue: "" });
  });
});
