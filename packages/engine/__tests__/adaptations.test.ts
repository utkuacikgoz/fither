// "Show the adaptation" (ADR-0006): every kind is emitted when and only
// when its condition actually changed today's session.

import { describe, expect, it } from "vitest";
import type { Profile, Session } from "../src/index.js";
import {
  createInitialProfile,
  generateSession,
  PATTERNS,
  STALE_FOCUS_MIN_TRAINING_DAYS,
} from "../src/index.js";
import {
  emptyHistory,
  historyWithPatterns,
  profileAtTier,
  prompt,
  realLibrary,
  syntheticLibrary,
} from "./helpers.js";

function kinds(session: Session): string[] {
  return session.adaptations.map((a) => a.kind);
}

function volumeReducedProfile(patterns: readonly string[]): Profile {
  const p = profileAtTier(2);
  for (const pattern of PATTERNS) {
    if (patterns.includes(pattern)) p.patterns[pattern].volumeReduced = true;
  }
  return p;
}

describe("adaptations — baseline", () => {
  it("an unconstrained okay-energy session emits no adaptations", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt(),
      42,
    );
    expect(session.adaptations).toEqual([]);
  });
});

describe("adaptations — soreness", () => {
  it("emits soreness with the avoided areas when the filter excluded movements", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ avoid: ["shoulders"] }),
      7,
    );
    expect(session.adaptations).toContainEqual({
      kind: "soreness",
      areas: ["shoulders"],
    });
  });

  it("emits nothing when the avoided area excluded no otherwise-eligible movement", () => {
    // In the synthetic library only the chair movements load shoulders, and
    // without a chair they are already gone — avoiding shoulders changes nothing.
    const session = generateSession(
      syntheticLibrary(),
      createInitialProfile(),
      emptyHistory,
      prompt({ avoid: ["shoulders"], equipment: [] }),
      7,
    );
    expect(session.blocks.length).toBeGreaterThan(0);
    expect(kinds(session)).not.toContain("soreness");
  });
});

describe("adaptations — quiet", () => {
  it("emits quiet when the filter excluded at least one loud movement", () => {
    const session = generateSession(
      syntheticLibrary(),
      createInitialProfile(),
      emptyHistory,
      prompt({ quiet: true }),
      3,
    );
    expect(kinds(session)).toContain("quiet");
  });

  it("emits nothing when the remaining pool was already all-silent", () => {
    // The current real library is entirely silent, so a quiet request
    // excludes no movement and honestly changes nothing.
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ quiet: true }),
      3,
    );
    expect(kinds(session)).not.toContain("quiet");
  });
});

describe("adaptations — energy and soft landing", () => {
  it("low energy emits lowEnergy when it reduced a block's sets", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ energy: "low" }),
      21,
    );
    expect(session.adaptations).toContainEqual({ kind: "lowEnergy" });
  });

  it("does not emit lowEnergy when the time budget already forces two sets", () => {
    const constrained = syntheticLibrary();
    for (const movement of constrained.movements) {
      movement.timing = {
        type: "seconds",
        defaultValue: 245,
      };
    }
    const okay = generateSession(
      constrained,
      createInitialProfile(),
      emptyHistory,
      prompt({ energy: "okay", minutes: 10 }),
      21,
    );
    const low = generateSession(
      constrained,
      createInitialProfile(),
      emptyHistory,
      prompt({ energy: "low", minutes: 10 }),
      21,
    );

    expect(okay.blocks).toHaveLength(1);
    expect(okay.blocks[0]?.sets).toBe(2);
    expect(low.blocks.map(({ movementId, sets }) => ({ movementId, sets }))).toEqual(
      okay.blocks.map(({ movementId, sets }) => ({ movementId, sets })),
    );
    expect(kinds(low)).not.toContain("lowEnergy");
  });

  it("does not emit lowEnergy when every block was already volume-reduced", () => {
    const session = generateSession(
      realLibrary,
      volumeReducedProfile(PATTERNS),
      emptyHistory,
      prompt({ energy: "low" }),
      21,
    );
    expect(kinds(session)).not.toContain("lowEnergy");
    expect(kinds(session)).toContain("softLanding");
  });

  it("emits softLanding per volume-reduced pattern that got a block", () => {
    const session = generateSession(
      realLibrary,
      volumeReducedProfile(["push"]),
      emptyHistory,
      prompt({ minutes: 20 }),
      13,
    );
    expect(session.adaptations).toContainEqual({
      kind: "softLanding",
      pattern: "push",
    });
    // Other patterns are not soft-landing; okay energy is not lowEnergy.
    expect(kinds(session).filter((k) => k === "softLanding")).toHaveLength(1);
    expect(kinds(session)).not.toContain("lowEnergy");
  });
});

describe("adaptations — stale focus", () => {
  it("emits staleFocus for a pattern absent >= the threshold of training days", () => {
    const history = historyWithPatterns([
      ["pull"],
      ["push", "squat", "hinge", "core"],
      ["push", "squat", "hinge", "core"],
      ["push", "squat", "hinge", "core"],
    ]);
    const session = generateSession(
      realLibrary,
      createInitialProfile(),
      history,
      prompt({ minutes: 20 }),
      9,
    );
    expect(session.adaptations).toEqual([
      { kind: "staleFocus", pattern: "pull" },
    ]);
  });

  it("emits nothing below the threshold", () => {
    const belowThreshold = STALE_FOCUS_MIN_TRAINING_DAYS - 1;
    const entries: ("pull" | "push" | "squat" | "hinge" | "core")[][] = [
      ["pull"],
    ];
    for (let i = 0; i < belowThreshold; i++) {
      entries.push(["push", "squat", "hinge", "core"]);
    }
    const session = generateSession(
      realLibrary,
      createInitialProfile(),
      historyWithPatterns(entries),
      prompt({ minutes: 20 }),
      9,
    );
    expect(kinds(session)).not.toContain("staleFocus");
  });

  it("emits nothing for a brand-new user (nothing to be stale against)", () => {
    const session = generateSession(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      prompt({ minutes: 10 }),
      9,
    );
    expect(kinds(session)).not.toContain("staleFocus");
  });
});

describe("adaptations — taste block", () => {
  it("emits tasteBlock matching the appended taste block", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ energy: "strong", minutes: 30 }),
      31,
    );
    const last = session.blocks[session.blocks.length - 1];
    expect(session.adaptations).toContainEqual({
      kind: "tasteBlock",
      pattern: last?.pattern,
      movementId: last?.movementId,
    });
  });

  it("emits nothing without a taste block", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(2),
      emptyHistory,
      prompt({ energy: "okay", minutes: 30 }),
      31,
    );
    expect(kinds(session)).not.toContain("tasteBlock");
  });
});

describe("adaptations — ordering and determinism", () => {
  it("orders by importance: soreness, quiet, energy, softLanding", () => {
    const session = generateSession(
      syntheticLibrary(),
      volumeReducedProfile(["push"]),
      emptyHistory,
      prompt({ quiet: true, avoid: ["shoulders"], energy: "low" }),
      17,
    );
    expect(session.adaptations).toEqual([
      { kind: "soreness", areas: ["shoulders"] },
      { kind: "quiet" },
      { kind: "lowEnergy" },
      { kind: "softLanding", pattern: "push" },
    ]);
  });

  it("is deterministic like the rest of the session", () => {
    const p = prompt({ quiet: true, avoid: ["shoulders"], energy: "low" });
    const a = generateSession(
      syntheticLibrary(),
      volumeReducedProfile(["push"]),
      emptyHistory,
      p,
      17,
    );
    const b = generateSession(
      syntheticLibrary(),
      volumeReducedProfile(["push"]),
      emptyHistory,
      p,
      17,
    );
    expect(a.adaptations).toStrictEqual(b.adaptations);
  });
});
