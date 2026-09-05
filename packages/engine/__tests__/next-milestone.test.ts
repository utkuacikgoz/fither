import { describe, expect, it } from "vitest";

import { createInitialProfile, nextMilestone, tiersToMilestone } from "../src";
import type { Profile, Tier } from "../src/types";

// What the app points at next (ADR-0013). The rule lives here, never in
// the UI: "already earned" and the legacy-profile case are engine truths.

function profileAt(tiers: Partial<Record<
  "push" | "pull" | "squat" | "hinge" | "core",
  Tier
>>, unlocked: Profile["unlockedMilestones"] = []): Profile {
  const base = createInitialProfile();
  for (const [pattern, tier] of Object.entries(tiers)) {
    base.patterns[pattern as keyof typeof base.patterns].tier = tier as Tier;
  }
  return { ...base, unlockedMilestones: unlocked };
}

describe("nextMilestone", () => {
  it("a fresh profile is pointed at the first milestone, three tiers away", () => {
    const next = nextMilestone(createInitialProfile());
    expect(next).toEqual({ pattern: "push", tier: 4 });
    expect(tiersToMilestone(createInitialProfile(), next!)).toBe(3);
  });

  it("picks the pattern nearest its milestone, not the first in order", () => {
    // Core sits one tier away; push is three. Core wins.
    expect(nextMilestone(profileAt({ core: 3 }))).toEqual({
      pattern: "core",
      tier: 4,
    });
  });

  it("skips a milestone she has already been awarded", () => {
    const profile = profileAt({ push: 4 }, [{ pattern: "push", tier: 4 }]);
    // Tier 4 is behind her and awarded, so push points at 6 — and from
    // tier 4 that is only 2 away, nearer than the other patterns' 3.
    expect(nextMilestone(profile)).toEqual({ pattern: "push", tier: 6 });
  });

  it("never promises a skill a legacy profile already holds", () => {
    // Trained past tier 4 before unlockedMilestones existed: the field is
    // ABSENT (not undefined — exactOptionalPropertyTypes means those are
    // different shapes, and absent is what a v0 profile actually
    // deserialises to), but the tier proves she has it.
    const { unlockedMilestones: _omitted, ...legacy } = profileAt({ push: 5 });
    expect("unlockedMilestones" in legacy).toBe(false);
    // Tier 4 is behind her, so the next is push's tier 6 (1 away) — a
    // negative assertion here would pass for null or any other pattern.
    expect(nextMilestone(legacy)).toEqual({ pattern: "push", tier: 6 });
    expect(tiersToMilestone(legacy, { pattern: "push", tier: 6 })).toBe(1);
  });

  it("a regressed pattern keeps its earned milestone and points past it", () => {
    // Earned push 4, then regressed to 3: 4 is not promised again (it is
    // hers for life), so push points at 6 — 3 away, tied with the other
    // patterns' 3 to their tier 4, and PATTERNS order keeps push first.
    const profile = profileAt({ push: 3 }, [{ pattern: "push", tier: 4 }]);
    expect(nextMilestone(profile)).toEqual({ pattern: "push", tier: 6 });
    expect(tiersToMilestone(profile, { pattern: "push", tier: 6 })).toBe(3);
  });

  it("a legacy profile at tier 6 everywhere has nothing left to reach", () => {
    const { unlockedMilestones: _omitted, ...legacy } = profileAt({
      push: 6, pull: 6, squat: 6, hinge: 6, core: 6,
    });
    expect(nextMilestone(legacy)).toBeNull();
  });

  it("returns null once every milestone is behind her", () => {
    const all: Profile["unlockedMilestones"] = [];
    const maxed = profileAt(
      { push: 6, pull: 6, squat: 6, hinge: 6, core: 6 },
      all,
    );
    expect(nextMilestone(maxed)).toBeNull();
  });

  it("is deterministic when two patterns are equally close", () => {
    const profile = profileAt({ push: 3, pull: 3 });
    // PATTERNS order breaks the tie, every time.
    expect(nextMilestone(profile)).toEqual({ pattern: "push", tier: 4 });
    expect(nextMilestone(profile)).toEqual({ pattern: "push", tier: 4 });
  });
});
