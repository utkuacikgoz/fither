import { describe, expect, it } from "vitest";
import type {
  BlockOutcome,
  Pattern,
  Profile,
  Session,
  SessionBlock,
  Tier,
} from "../src/index.js";
import {
  applySessionResult,
  createInitialProfile,
  milestoneMovement,
  POINTS,
  SKILL_MILESTONE_TIERS,
} from "../src/index.js";
import { emptyHistory, profileAtTier, realLibrary } from "./helpers.js";

function block(
  movementId: string,
  pattern: Pattern,
  atNewTier = false,
): SessionBlock {
  return {
    movementId,
    pattern,
    sets: 3,
    amount: 8,
    restSeconds: 45,
    estimatedSeconds: 200,
    atNewTier,
  };
}

function session(blocks: SessionBlock[], minutes: 10 | 20 | 30 = 20): Session {
  return {
    date: "2026-02-02",
    minutes,
    blocks,
    estimatedTotalSeconds: blocks.reduce((a, b) => a + b.estimatedSeconds, 0),
    seed: 1,
    adaptations: [],
  };
}

/** A one-pattern push session at the profile's current push tier. */
function pushSession(profile: Profile, atNewTier = false): Session {
  const tier = profile.patterns.push.tier;
  const m = realLibrary.movements.find(
    (mv) => mv.pattern === "push" && mv.tier === tier,
  );
  if (!m) throw new Error(`no push movement at tier ${tier}`);
  return session([block(m.id, "push", atNewTier)]);
}

function apply(profile: Profile, s: Session, outcomes: BlockOutcome[]) {
  return applySessionResult(realLibrary, profile, emptyHistory, {
    session: s,
    outcomes,
  });
}

describe("applySessionResult — advancement", () => {
  it("advances a tier after 3 clean sessions, not before", () => {
    let profile = createInitialProfile();
    for (let i = 0; i < 2; i++) {
      profile = apply(profile, pushSession(profile), ["completed"]).profile;
      expect(profile.patterns.push.tier).toBe(1);
      expect(profile.patterns.push.cleanStreak).toBe(i + 1);
    }
    profile = apply(profile, pushSession(profile), ["completed"]).profile;
    expect(profile.patterns.push.tier).toBe(2);
    expect(profile.patterns.push.cleanStreak).toBe(0);
  });

  it("a struggled block resets the clean streak", () => {
    let profile = createInitialProfile();
    profile = apply(profile, pushSession(profile), ["completed"]).profile;
    profile = apply(profile, pushSession(profile), ["completed"]).profile;
    profile = apply(profile, pushSession(profile), ["struggled"]).profile;
    expect(profile.patterns.push.cleanStreak).toBe(0);
    expect(profile.patterns.push.tier).toBe(1);
    expect(profile.patterns.push.struggledStreak).toBe(1);
  });

  it("unlocks a named skill at milestone tiers", () => {
    const profile = profileAtTier(3);
    profile.patterns.push.cleanStreak = 2; // next clean session advances to 4
    const result = apply(profile, pushSession(profile), ["completed"]);
    expect(result.profile.patterns.push.tier).toBe(4);
    expect(SKILL_MILESTONE_TIERS).toContain(4);
    const milestone = milestoneMovement(realLibrary, "push", 4);
    expect(result.unlockedSkills).toStrictEqual([
      { pattern: "push", tier: 4, movementName: milestone?.name },
    ]);
    expect(result.unlockedSkills[0]?.movementName).toBe("Full Push-Up");
    const unlockEvents = result.ledgerEvents.filter(
      (e) => e.type === "skillUnlock",
    );
    expect(unlockEvents).toHaveLength(1);
    expect(unlockEvents[0]?.points).toBe(POINTS.perSkillUnlock);
  });
});

describe("applySessionResult — struggle and regression", () => {
  it("reduces volume after 2 consecutive struggled sessions, regresses after 3", () => {
    let profile = profileAtTier(3);

    profile = apply(profile, pushSession(profile), ["struggled"]).profile;
    expect(profile.patterns.push).toMatchObject({
      tier: 3,
      struggledStreak: 1,
      volumeReduced: false,
    });

    profile = apply(profile, pushSession(profile), ["struggled"]).profile;
    expect(profile.patterns.push).toMatchObject({
      tier: 3,
      struggledStreak: 2,
      volumeReduced: true,
    });

    profile = apply(profile, pushSession(profile), ["struggled"]).profile;
    expect(profile.patterns.push).toMatchObject({
      tier: 2,
      struggledStreak: 0,
      cleanStreak: 0,
      volumeReduced: true, // soft landing at the lower tier
    });
  });

  it("skipped counts like struggled", () => {
    let profile = profileAtTier(3);
    profile = apply(profile, pushSession(profile), ["skipped"]).profile;
    expect(profile.patterns.push.struggledStreak).toBe(1);
  });

  it("any clean session resets the struggled streak and volume reduction", () => {
    let profile = profileAtTier(3);
    profile.patterns.push.struggledStreak = 2;
    profile.patterns.push.volumeReduced = true;
    profile = apply(profile, pushSession(profile), ["completed"]).profile;
    expect(profile.patterns.push).toMatchObject({
      tier: 3,
      struggledStreak: 0,
      volumeReduced: false,
      cleanStreak: 1,
    });
  });

  it("absence NEVER regresses: untouched patterns keep their exact state", () => {
    const profile = profileAtTier(3);
    profile.patterns.pull.struggledStreak = 2;
    profile.patterns.pull.volumeReduced = true;
    // Session contains only push — pull is absent, one struggle away from
    // regression, and must stay exactly where it is.
    const result = apply(profile, pushSession(profile), ["completed"]);
    expect(result.profile.patterns.pull).toStrictEqual({
      tier: 3,
      cleanStreak: 0,
      struggledStreak: 2,
      volumeReduced: true,
    });
  });

  it("never regresses below tier 1", () => {
    let profile = createInitialProfile();
    for (let i = 0; i < 6; i++) {
      profile = apply(profile, pushSession(profile), ["struggled"]).profile;
    }
    expect(profile.patterns.push.tier).toBe(1);
  });

  it("a struggled next-tier taste block does not touch progression state", () => {
    const profile = profileAtTier(2);
    profile.patterns.push.cleanStreak = 2;
    const incline = block("incline-push-up", "push"); // tier 2 = current
    const taste = block("kneeling-push-up", "push", true); // tier 3 taste
    const result = apply(profile, session([incline, taste]), [
      "completed",
      "struggled",
    ]);
    // Clean at current tier despite the struggled taste: advances to 3.
    expect(result.profile.patterns.push.tier).toBe(3);
    expect(result.profile.patterns.push.struggledStreak).toBe(0);
  });

  it("fallback work below the current tier is progression-neutral", () => {
    const profile = profileAtTier(3);
    profile.patterns.push.cleanStreak = 2;
    profile.patterns.push.struggledStreak = 1;

    const completed = apply(
      profile,
      session([block("wall-push-up", "push", true)]),
      ["completed"],
    );
    const struggled = apply(
      profile,
      session([block("wall-push-up", "push")]),
      ["struggled"],
    );

    expect(completed.profile.patterns.push).toStrictEqual(
      profile.patterns.push,
    );
    expect(struggled.profile.patterns.push).toStrictEqual(
      profile.patterns.push,
    );
    expect(
      completed.ledgerEvents.filter((event) => event.type === "newTierBlock"),
    ).toHaveLength(0);
  });
});

describe("applySessionResult — tier 6 is terminal", () => {
  it("stays at 6 through repeated clean sessions, no repeat unlocks", () => {
    let profile = profileAtTier(6);
    for (let i = 0; i < 5; i++) {
      const result = apply(profile, pushSession(profile), ["completed"]);
      profile = result.profile;
      expect(profile.patterns.push.tier).toBe(6);
      expect(result.unlockedSkills).toHaveLength(0);
    }
    expect(profile.patterns.push.cleanStreak).toBe(5);
  });
});

describe("applySessionResult — ledger", () => {
  it("awards 1 point per minute for a completed session (10/20/30)", () => {
    for (const minutes of [10, 20, 30] as const) {
      const profile = createInitialProfile();
      const s = session([block("wall-push-up", "push")], minutes);
      const result = apply(profile, s, ["completed"]);
      const sessionEvents = result.ledgerEvents.filter(
        (e) => e.type === "session",
      );
      expect(sessionEvents).toHaveLength(1);
      expect(sessionEvents[0]?.points).toBe(minutes * POINTS.perSessionMinute);
    }
  });

  it("awards +5 per completed block at a newly reached tier", () => {
    const profile = profileAtTier(2);
    const s = session([
      block("incline-push-up", "push", true),
      block("wide-incline-push-up", "push", true),
    ]);
    const result = apply(profile, s, ["completed", "struggled"]);
    const bonus = result.ledgerEvents.filter((e) => e.type === "newTierBlock");
    expect(bonus).toHaveLength(1); // struggled block earns no bonus
    expect(bonus[0]?.points).toBe(POINTS.perNewTierBlock);
  });

  it("does not award a new-tier bonus for a completed taste block", () => {
    const profile = profileAtTier(2);
    // The true engine output has atNewTier=false. Keeping true here verifies
    // apply remains safe when handed a stale pre-ADR-0007 session.
    const s = session([block("kneeling-push-up", "push", true)]);
    const result = apply(profile, s, ["completed"]);
    expect(
      result.ledgerEvents.filter((event) => event.type === "newTierBlock"),
    ).toHaveLength(0);
    expect(result.profile.patterns.push).toStrictEqual(profile.patterns.push);
  });

  it("a fully skipped session earns nothing — and loses nothing", () => {
    const profile = createInitialProfile();
    const result = apply(profile, pushSession(profile), ["skipped"]);
    expect(result.ledgerEvents).toHaveLength(0);
  });

  it("points are only ever added", () => {
    const profile = profileAtTier(3);
    const result = apply(profile, pushSession(profile), ["struggled"]);
    for (const e of result.ledgerEvents) {
      expect(e.points).toBeGreaterThan(0);
    }
  });

  it("is append-only and pure: inputs are never mutated", () => {
    const profile = profileAtTier(2);
    const profileSnapshot = JSON.parse(JSON.stringify(profile));
    const history = {
      entries: [
        {
          date: "2026-01-01",
          minutes: 20 as const,
          blocks: [],
        },
      ],
    };
    const historySnapshot = JSON.parse(JSON.stringify(history));
    const result = applySessionResult(realLibrary, profile, history, {
      session: pushSession(profile),
      outcomes: ["completed"],
    });
    expect(profile).toStrictEqual(profileSnapshot);
    expect(history).toStrictEqual(historySnapshot);
    expect(result.history.entries).toHaveLength(2);
    expect(result.history.entries[0]).toStrictEqual(history.entries[0]);
  });

  it("treats an empty generated session as a complete no-op", () => {
    const profile = profileAtTier(3);
    const history = {
      entries: [
        {
          date: "2026-01-01",
          minutes: 20 as const,
          blocks: [],
        },
      ],
    };
    const result = applySessionResult(realLibrary, profile, history, {
      session: session([]),
      outcomes: [],
    });

    expect(result.profile).toBe(profile);
    expect(result.history).toBe(history);
    expect(result.ledgerEvents).toEqual([]);
    expect(result.unlockedSkills).toEqual([]);
  });
});

describe("applySessionResult — lifetime unlock memory", () => {
  it("unlocks each pattern milestone only once across regress and re-advance", () => {
    let profile = profileAtTier(3);
    profile.patterns.push.cleanStreak = 2;

    const first = apply(profile, pushSession(profile), ["completed"]);
    profile = first.profile;
    expect(first.unlockedSkills).toHaveLength(1);
    expect(profile.unlockedMilestones).toContainEqual({
      pattern: "push",
      tier: 4,
    });

    for (let i = 0; i < 3; i++) {
      profile = apply(profile, pushSession(profile), ["struggled"]).profile;
    }
    expect(profile.patterns.push.tier).toBe(3);

    let final = apply(profile, pushSession(profile), ["completed"]);
    profile = final.profile;
    final = apply(profile, pushSession(profile), ["completed"]);
    profile = final.profile;
    final = apply(profile, pushSession(profile), ["completed"]);

    expect(final.profile.patterns.push.tier).toBe(4);
    expect(final.unlockedSkills).toEqual([]);
    expect(
      final.ledgerEvents.filter((event) => event.type === "skillUnlock"),
    ).toHaveLength(0);
    expect(
      final.profile.unlockedMilestones?.filter(
        (milestone) =>
          milestone.pattern === "push" && milestone.tier === 4,
      ),
    ).toHaveLength(1);
  });
});
