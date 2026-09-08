import { describe, expect, it } from "vitest";
import type {
  Adaptation,
  BlockOutcome,
  Energy,
  History,
  Movement,
  Pattern,
  Profile,
  Session,
  SessionMinutes,
} from "../src/index.js";
import {
  applySessionResult,
  CALIBRATION_MAX_SESSIONS,
  CALIBRATION_MAX_TIER,
  createInitialProfile,
  generateSession,
  PATTERNS,
  TARGET_UTILIZATION,
} from "../src/index.js";
import {
  emptyHistory,
  historyWithPatterns,
  profileAtTier,
  prompt,
  realLibrary,
  settledHistory,
} from "./helpers.js";

// Starting-level calibration, ADR-0026. Sessions one and two only, any
// energy: one set of the next tier after each pattern's first block. A
// completed taste raises where that pattern STARTS next session by one
// tier, capped at CALIBRATION_MAX_TIER. Struggled or skipped changes
// nothing. The taste itself never touches progression or points.

const movementById = new Map(realLibrary.movements.map((m) => [m.id, m]));

function tastes(session: Session): Array<Adaptation & { kind: "calibrationTaste" }> {
  return session.adaptations.filter(
    (a): a is Adaptation & { kind: "calibrationTaste" } =>
      a.kind === "calibrationTaste",
  );
}

function tasteBlockIndex(session: Session, movementId: string): number {
  return session.blocks.findIndex(
    (b) => b.movementId === movementId && b.sets === 1,
  );
}

/** One history entry per session already trained (only the count matters). */
function historyOf(sessions: number): History {
  return historyWithPatterns(
    Array.from({ length: sessions }, () => [...PATTERNS]),
  );
}

/** Outcomes marking every calibration taste `outcome`, everything else completed. */
function outcomesWith(session: Session, outcome: BlockOutcome): BlockOutcome[] {
  const tasteIds = new Set(tastes(session).map((t) => t.movementId));
  return session.blocks.map((b) =>
    b.sets === 1 && tasteIds.has(b.movementId) ? outcome : "completed",
  );
}

describe("calibration — what the first two sessions offer", () => {
  it("offers one taste per trained pattern at every energy, one set of exactly the next tier", () => {
    for (const energy of ["low", "okay", "strong"] as Energy[]) {
      const session = generateSession(
        realLibrary,
        createInitialProfile(),
        emptyHistory,
        prompt({ minutes: 30, energy }),
        11,
      );
      const trained = new Set(
        session.blocks.filter((b) => b.sets > 1).map((b) => b.pattern),
      );
      expect(tastes(session).map((t) => t.pattern).sort()).toEqual(
        [...trained].sort(),
      );
      for (const taste of tastes(session)) {
        const index = tasteBlockIndex(session, taste.movementId);
        const block = session.blocks[index];
        const movement = movementById.get(taste.movementId) as Movement;
        expect(block?.sets).toBe(1);
        expect(block?.pattern).toBe(taste.pattern);
        // A question, not a promotion: never flagged as a new tier, so it
        // can never earn the new-tier bonus.
        expect(block?.atNewTier).toBe(false);
        expect(movement.tier).toBe(1 + 1);
        // Directly after that pattern's first block, while she is fresh.
        const previous = session.blocks[index - 1];
        expect(previous?.pattern).toBe(taste.pattern);
        expect(previous?.sets).toBeGreaterThan(1);
        expect(
          session.blocks.findIndex((b) => b.pattern === taste.pattern),
        ).toBe(index - 1);
      }
    }
  });

  it("offers tastes in session two as well, and never in session three", () => {
    const two = generateSession(
      realLibrary,
      createInitialProfile(),
      historyOf(CALIBRATION_MAX_SESSIONS - 1),
      prompt({ minutes: 30 }),
      12,
    );
    expect(tastes(two).length).toBeGreaterThan(0);

    const three = generateSession(
      realLibrary,
      createInitialProfile(),
      historyOf(CALIBRATION_MAX_SESSIONS),
      prompt({ minutes: 30 }),
      12,
    );
    expect(tastes(three)).toEqual([]);
    expect(three.blocks.every((b) => b.sets > 1)).toBe(true);
  });

  it("offers nothing to a pattern already at the calibration cap", () => {
    const session = generateSession(
      realLibrary,
      profileAtTier(CALIBRATION_MAX_TIER),
      emptyHistory,
      prompt({ minutes: 30 }),
      13,
    );
    expect(tastes(session)).toEqual([]);
  });

  it("is deterministic: same inputs and seed, identical session", () => {
    const p = prompt({ minutes: 10, energy: "strong" });
    const a = generateSession(realLibrary, createInitialProfile(), emptyHistory, p, 99);
    const b = generateSession(realLibrary, createInitialProfile(), emptyHistory, p, 99);
    expect(a).toStrictEqual(b);
    expect(tastes(a).length).toBeGreaterThan(0);
  });
});

describe("calibration — the time budget still rules", () => {
  it("never exceeds the budget, still fills 90%, and still offers a taste at 10 minutes", () => {
    let offeredAtTen = 0;
    let seed = 1;
    for (const minutes of [10, 20, 30] as SessionMinutes[]) {
      for (const energy of ["low", "okay", "strong"] as Energy[]) {
        for (const sessions of [0, 1]) {
          for (const trial of [0, 1, 2, 3]) {
            const session = generateSession(
              realLibrary,
              createInitialProfile(),
              historyOf(sessions),
              prompt({ minutes, energy }),
              seed++ + trial,
            );
            const budget = minutes * 60;
            expect(session.estimatedTotalSeconds).toBeLessThanOrEqual(budget);
            expect(session.estimatedTotalSeconds).toBeGreaterThanOrEqual(
              Math.floor(budget * TARGET_UTILIZATION),
            );
            const sum = session.blocks.reduce(
              (a, b) => a + b.estimatedSeconds,
              0,
            );
            expect(sum).toBe(session.estimatedTotalSeconds);
            if (minutes === 10) offeredAtTen += tastes(session).length;
          }
        }
      }
    }
    // Owner answer 4: offered on all session lengths, 10 minutes included.
    expect(offeredAtTen).toBeGreaterThan(0);
  });

  it("only offers a taste that fits: a session whose pairs do not fit still trains", () => {
    // Every movement is a 200-second hold: one 2-set block is 445s, so a
    // block-plus-taste pair (665s) cannot fit a 10-minute budget.
    const heavy = {
      version: 1,
      movements: realLibrary.movements.map((m) => ({
        ...m,
        timing: { type: "seconds" as const, defaultValue: 200 },
      })),
    };
    const session = generateSession(
      heavy,
      createInitialProfile(),
      emptyHistory,
      prompt({ minutes: 10 }),
      5,
    );
    expect(session.blocks.length).toBeGreaterThan(0);
    expect(tastes(session)).toEqual([]);
    expect(session.estimatedTotalSeconds).toBeLessThanOrEqual(600);
  });
});

describe("calibration — what a taste does to the profile", () => {
  const generateFirst = (minutes: SessionMinutes = 30) =>
    generateSession(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      prompt({ minutes }),
      21,
    );

  it("a completed taste starts that pattern one tier higher, with fresh counters", () => {
    const session = generateFirst();
    const applied = applySessionResult(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      { session, outcomes: outcomesWith(session, "completed") },
    );
    const raised = new Set(tastes(session).map((t) => t.pattern));
    expect(raised.size).toBeGreaterThan(0);
    for (const pattern of PATTERNS) {
      const state = applied.profile.patterns[pattern];
      if (raised.has(pattern)) {
        expect(state.tier).toBe(2);
        expect(state.cleanCount).toBe(0);
        expect(state.struggleCount).toBe(0);
        expect(state.volumeReduced).toBe(false);
        // A tier change restarts the ADR-0008 floor clock.
        expect(state.tierSince).toBe(session.date);
        // Placed, not earned: the earned mark stays where she actually
        // earned her way to, so this placement can be corrected all the
        // way back down (owner decision 2026-09-08).
        expect(state.earnedTier).toBe(1);
      } else {
        expect(state.tier).toBe(1);
      }
    }
  });

  it("a struggled taste changes nothing, and costs the pattern no clean credit", () => {
    const session = generateFirst();
    const applied = applySessionResult(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      { session, outcomes: outcomesWith(session, "struggled") },
    );
    for (const pattern of PATTERNS) {
      const state = applied.profile.patterns[pattern];
      expect(state.tier).toBe(1);
      // The main block was completed, so the pattern is clean: the taste
      // is progression-neutral in both directions.
      expect(state.struggleCount).toBe(0);
      expect(state.cleanCount).toBe(1);
    }
  });

  it("a skipped taste changes nothing", () => {
    const session = generateFirst();
    const applied = applySessionResult(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      { session, outcomes: outcomesWith(session, "skipped") },
    );
    for (const pattern of PATTERNS) {
      expect(applied.profile.patterns[pattern].tier).toBe(1);
      expect(applied.profile.patterns[pattern].cleanCount).toBe(1);
    }
  });

  it("earns no points of its own: a taste adds no ledger event", () => {
    const session = generateFirst();
    const completed = applySessionResult(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      { session, outcomes: outcomesWith(session, "completed") },
    );
    const skipped = applySessionResult(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      { session, outcomes: outcomesWith(session, "skipped") },
    );
    expect(completed.ledgerEvents).toStrictEqual(skipped.ledgerEvents);
    expect(completed.ledgerEvents.map((e) => e.type)).toEqual(["session"]);
    expect(completed.unlockedSkills).toEqual([]);
  });

  it("raises at most one tier per session, and stops at the cap", () => {
    // Session one: tier 1 -> 2 on push.
    let profile: Profile = createInitialProfile();
    let history: History = emptyHistory;
    for (let n = 0; n < CALIBRATION_MAX_SESSIONS; n++) {
      const session = generateSession(
        realLibrary,
        profile,
        history,
        prompt({ minutes: 30, date: `2026-02-0${n + 1}` }),
        31 + n,
      );
      const before = profile.patterns.push.tier;
      const applied = applySessionResult(realLibrary, profile, history, {
        session,
        outcomes: outcomesWith(session, "completed"),
      });
      profile = applied.profile;
      history = applied.history;
      expect(profile.patterns.push.tier).toBe(before + 1);
    }
    expect(profile.patterns.push.tier).toBe(CALIBRATION_MAX_TIER);

    // Session three: no taste is offered, and the tier stays put.
    const third = generateSession(
      realLibrary,
      profile,
      history,
      prompt({ minutes: 30, date: "2026-02-03" }),
      33,
    );
    expect(tastes(third)).toEqual([]);
    const after = applySessionResult(realLibrary, profile, history, {
      session: third,
      outcomes: third.blocks.map(() => "completed" as const),
    });
    expect(after.profile.patterns.push.tier).toBe(CALIBRATION_MAX_TIER);
  });

  it("ignores a calibration claim once two sessions are on record", () => {
    // The same session, applied against a history that is past
    // calibration: the claim is refused, whatever the session says.
    const session = generateFirst();
    const applied = applySessionResult(
      realLibrary,
      createInitialProfile(),
      settledHistory,
      { session, outcomes: outcomesWith(session, "completed") },
    );
    for (const pattern of PATTERNS) {
      expect(applied.profile.patterns[pattern].tier).toBe(1);
    }
  });

  it("refuses a claim above the cap, and one whose block is not the next tier", () => {
    const atCap = profileAtTier(CALIBRATION_MAX_TIER);
    const movement = realLibrary.movements.find(
      (m) => m.pattern === "push" && m.tier === CALIBRATION_MAX_TIER + 1,
    ) as Movement;
    const forged: Session = {
      date: "2026-02-02",
      minutes: 20,
      blocks: [
        {
          movementId:
            realLibrary.movements.find(
              (m) => m.pattern === "push" && m.tier === CALIBRATION_MAX_TIER,
            )?.id ?? "",
          pattern: "push",
          sets: 3,
          amount: 8,
          restSeconds: 45,
          estimatedSeconds: 200,
          atNewTier: false,
        },
        {
          movementId: movement.id,
          pattern: "push",
          sets: 1,
          amount: 8,
          restSeconds: 45,
          estimatedSeconds: 60,
          atNewTier: false,
        },
      ],
      estimatedTotalSeconds: 260,
      seed: 1,
      adaptations: [
        {
          kind: "calibrationTaste",
          pattern: "push",
          movementId: movement.id,
        },
      ],
    };
    const applied = applySessionResult(realLibrary, atCap, emptyHistory, {
      session: forged,
      outcomes: ["completed", "completed"],
    });
    expect(applied.profile.patterns.push.tier).toBe(CALIBRATION_MAX_TIER);

    // Two tiers up is not a calibration taste either.
    const twoUp = realLibrary.movements.find(
      (m) => m.pattern === "pull" && m.tier === 3,
    ) as Movement;
    const wrongStep: Session = {
      ...forged,
      blocks: [
        { ...forged.blocks[1]!, movementId: twoUp.id, pattern: "pull" },
      ],
      adaptations: [
        { kind: "calibrationTaste", pattern: "pull", movementId: twoUp.id },
      ],
    };
    const applied2 = applySessionResult(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      { session: wrongStep, outcomes: ["completed"] },
    );
    expect(applied2.profile.patterns.pull.tier).toBe(1);
  });

  it("does not start a pattern higher when she struggled at her current tier", () => {
    const session = generateFirst();
    const pattern = tastes(session)[0]?.pattern as Pattern;
    const tasteIds = new Set(tastes(session).map((t) => t.movementId));
    const outcomes: BlockOutcome[] = session.blocks.map((b) => {
      if (b.sets === 1 && tasteIds.has(b.movementId)) return "completed";
      return b.pattern === pattern ? "struggled" : "completed";
    });
    const applied = applySessionResult(
      realLibrary,
      createInitialProfile(),
      emptyHistory,
      { session, outcomes },
    );
    expect(applied.profile.patterns[pattern].tier).toBe(1);
    expect(applied.profile.patterns[pattern].struggleCount).toBe(1);
  });
});

// Owner decision 2026-09-08 (option 1): a tier calibration PLACED her at
// was never earned, so correcting it is not taking something away. G2 is
// re-scoped to "never regresses below an EARNED tier" — the floor the
// ordinary clean-count rule sets.
describe("calibration — a placed tier is not earned ground (G2)", () => {
  /** Two calibrating sessions, every taste completed: push ends at the cap. */
  function afterCalibration(): { profile: Profile; history: History } {
    let profile: Profile = createInitialProfile();
    let history: History = emptyHistory;
    for (let n = 0; n < CALIBRATION_MAX_SESSIONS; n++) {
      const session = generateSession(
        realLibrary,
        profile,
        history,
        prompt({ minutes: 30, date: `2026-02-0${n + 1}` }),
        41 + n,
      );
      const applied = applySessionResult(realLibrary, profile, history, {
        session,
        outcomes: outcomesWith(session, "completed"),
      });
      profile = applied.profile;
      history = applied.history;
    }
    return { profile, history };
  }

  it("leaves the earned floor at tier 1 while the tier climbs to the cap", () => {
    const { profile } = afterCalibration();
    expect(profile.patterns.push.tier).toBe(CALIBRATION_MAX_TIER);
    expect(profile.patterns.push.earnedTier).toBe(1);
  });

  it("lets repeated struggling correct the placement back down, one tier at a time", () => {
    let { profile, history } = afterCalibration();
    const start = profile.patterns.push.tier;
    // Three struggled sessions on push: the placement is corrected by one
    // tier — the same machinery ADR-0003 always used, now floored one
    // tier below what she earned (here: earned 1, so floored at 1).
    for (let day = 3; day <= 5; day++) {
      const session = generateSession(
        realLibrary,
        profile,
        history,
        prompt({ minutes: 30, date: `2026-02-0${day}` }),
        51 + day,
      );
      const applied = applySessionResult(realLibrary, profile, history, {
        session,
        outcomes: session.blocks.map((b) =>
          b.pattern === "push" ? "struggled" : "completed",
        ),
      });
      profile = applied.profile;
      history = applied.history;
    }
    expect(profile.patterns.push.tier).toBe(start - 1);
    expect(profile.patterns.push.earnedTier).toBe(1);
    expect(profile.patterns.push.volumeReduced).toBe(true);
  });
});
