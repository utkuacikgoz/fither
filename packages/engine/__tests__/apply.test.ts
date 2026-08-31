import { describe, expect, it } from "vitest";
import type {
  BlockOutcome,
  Pattern,
  Profile,
  Session,
  SessionBlock,
} from "../src/index.js";
import {
  applySessionResult,
  calendarDaysBetween,
  createInitialProfile,
  DAYS_AT_TIER_TO_ADVANCE,
  milestoneMovement,
  POINTS,
  SKILL_MILESTONE_TIERS,
} from "../src/index.js";
import { emptyHistory, profileAtTier, realLibrary } from "./helpers.js";

/** Base test date; dayIso(n) = n calendar days later (pure UTC math). */
const BASE_UTC = Date.UTC(2026, 1, 2); // 2026-02-02
function dayIso(n: number): string {
  return new Date(BASE_UTC + n * 86_400_000).toISOString().slice(0, 10);
}

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

function session(
  blocks: SessionBlock[],
  minutes: 10 | 20 | 30 = 20,
  date = dayIso(0),
): Session {
  return {
    date,
    minutes,
    blocks,
    estimatedTotalSeconds: blocks.reduce((a, b) => a + b.estimatedSeconds, 0),
    seed: 1,
    adaptations: [],
  };
}

/** A one-pattern push session at the profile's current push tier. */
function pushSession(
  profile: Profile,
  date = dayIso(0),
  atNewTier = false,
): Session {
  const tier = profile.patterns.push.tier;
  const m = realLibrary.movements.find(
    (mv) => mv.pattern === "push" && mv.tier === tier,
  );
  if (!m) throw new Error(`no push movement at tier ${tier}`);
  return session([block(m.id, "push", atNewTier)], 20, date);
}

function apply(profile: Profile, s: Session, outcomes: BlockOutcome[]) {
  return applySessionResult(realLibrary, profile, emptyHistory, {
    session: s,
    outcomes,
  });
}

/** Clean push session on day n; returns the next profile. */
function cleanOn(profile: Profile, day: number): Profile {
  return apply(profile, pushSession(profile, dayIso(day)), ["completed"])
    .profile;
}

describe("calendarDaysBetween", () => {
  it("does pure string-date math, month and year boundaries included", () => {
    expect(calendarDaysBetween("2026-02-02", "2026-02-02")).toBe(0);
    expect(calendarDaysBetween("2026-02-02", "2026-02-09")).toBe(7);
    expect(calendarDaysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(calendarDaysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(calendarDaysBetween("2028-02-28", "2028-03-01")).toBe(2); // leap
  });
});

describe("applySessionResult — advancement with time floors (ADR-0008)", () => {
  it("a fresh profile carries no tierSince; the first apply stamps it", () => {
    const fresh = createInitialProfile();
    expect(fresh.patterns.push.tierSince).toBeUndefined();
    const next = cleanOn(fresh, 0);
    expect(next.patterns.push.tierSince).toBe(dayIso(0));
    // Untouched patterns are never stamped.
    expect(next.patterns.pull.tierSince).toBeUndefined();
  });

  it("the floor blocks advancement before 7 days even with 3+ clean sessions", () => {
    let profile = createInitialProfile();
    for (const day of [0, 1, 2, 3, 4]) profile = cleanOn(profile, day);
    expect(profile.patterns.push.tier).toBe(1);
    // Cleans keep banking while the floor is unmet.
    expect(profile.patterns.push.cleanStreak).toBe(5);
    expect(profile.patterns.push.tierSince).toBe(dayIso(0));
  });

  it("advancement fires on the first clean session where streak AND floor hold", () => {
    let profile = createInitialProfile();
    for (const day of [0, 1, 2, 3, 4]) profile = cleanOn(profile, day);
    // Day 6 is still < 7 days since day 0.
    profile = cleanOn(profile, 6);
    expect(profile.patterns.push.tier).toBe(1);
    // Day 7 meets DAYS_AT_TIER_TO_ADVANCE[1] = 7; banked cleans >= 3.
    profile = cleanOn(profile, 7);
    expect(profile.patterns.push.tier).toBe(2);
    expect(profile.patterns.push.cleanStreak).toBe(0);
    expect(profile.patterns.push.tierSince).toBe(dayIso(7));
  });

  it("the floor is keyed by the current tier (tier 2 needs 14 days)", () => {
    expect(DAYS_AT_TIER_TO_ADVANCE).toStrictEqual({
      1: 7,
      2: 14,
      3: 28,
      4: 42,
      5: 56,
    });
    let profile = profileAtTier(2);
    profile.patterns.push.tierSince = dayIso(0);
    for (const day of [1, 2, 3, 13]) profile = cleanOn(profile, day);
    expect(profile.patterns.push.tier).toBe(2); // 4 cleans, floor unmet
    profile = cleanOn(profile, 14);
    expect(profile.patterns.push.tier).toBe(3);
    expect(profile.patterns.push.tierSince).toBe(dayIso(14));
  });

  it("3 clean sessions alone do not advance when the floor is unmet", () => {
    const profile = profileAtTier(3);
    profile.patterns.push.tierSince = dayIso(0);
    profile.patterns.push.cleanStreak = 2;
    // 27 days at tier 3 < the 28-day floor.
    const result = apply(profile, pushSession(profile, dayIso(27)), [
      "completed",
    ]);
    expect(result.profile.patterns.push.tier).toBe(3);
    expect(result.profile.patterns.push.cleanStreak).toBe(3);
    expect(result.unlockedSkills).toHaveLength(0);
  });

  it("a struggled block resets the clean streak", () => {
    let profile = createInitialProfile();
    profile = cleanOn(profile, 0);
    profile = cleanOn(profile, 1);
    profile = apply(profile, pushSession(profile, dayIso(2)), ["struggled"])
      .profile;
    expect(profile.patterns.push.cleanStreak).toBe(0);
    expect(profile.patterns.push.tier).toBe(1);
    expect(profile.patterns.push.struggledStreak).toBe(1);
  });

  it("unlocks a named skill at milestone tiers", () => {
    const profile = profileAtTier(3);
    profile.patterns.push.tierSince = dayIso(-28); // floor met
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

describe("applySessionResult — legacy profiles without tierSince (ADR-0008)", () => {
  it("advances on the old rule once, then the stamp makes the floor real", () => {
    // A profile persisted before tierSince existed, one clean short of
    // advancing under ADR-0002 alone.
    const legacy = profileAtTier(3);
    legacy.patterns.push.cleanStreak = 2;
    expect(legacy.patterns.push.tierSince).toBeUndefined();
    const result = apply(legacy, pushSession(legacy, dayIso(0)), ["completed"]);
    expect(result.profile.patterns.push.tier).toBe(4); // old rule, once
    expect(result.profile.patterns.push.tierSince).toBe(dayIso(0));
    // From here the tier-4 floor (42 days) applies for real.
    let profile = result.profile;
    for (const day of [1, 2, 3, 41]) profile = cleanOn(profile, day);
    expect(profile.patterns.push.tier).toBe(4);
    profile = cleanOn(profile, 42);
    expect(profile.patterns.push.tier).toBe(5);
  });

  it("a legacy profile mid-streak gets stamped on its next apply even without advancing", () => {
    const legacy = profileAtTier(3);
    expect(legacy.patterns.push.tierSince).toBeUndefined();
    let profile = cleanOn(legacy, 0); // cleanStreak 1, no advance
    expect(profile.patterns.push.tier).toBe(3);
    expect(profile.patterns.push.tierSince).toBe(dayIso(0));
    // Floor now real: 3 banked cleans before day 28 do not advance.
    profile = cleanOn(profile, 1);
    profile = cleanOn(profile, 2);
    expect(profile.patterns.push.cleanStreak).toBe(3);
    expect(profile.patterns.push.tier).toBe(3);
  });

  it("stamps a legacy state on a struggled apply too", () => {
    const legacy = profileAtTier(3);
    const result = apply(legacy, pushSession(legacy, dayIso(0)), ["struggled"]);
    expect(result.profile.patterns.push.tierSince).toBe(dayIso(0));
    expect(result.profile.patterns.push.tier).toBe(3);
  });
});

describe("applySessionResult — struggle and regression", () => {
  it("reduces volume after 2 consecutive struggled sessions, regresses after 3", () => {
    let profile = profileAtTier(3);
    profile.patterns.push.tierSince = dayIso(-30);

    profile = apply(profile, pushSession(profile, dayIso(0)), ["struggled"])
      .profile;
    expect(profile.patterns.push).toMatchObject({
      tier: 3,
      struggledStreak: 1,
      volumeReduced: false,
    });

    profile = apply(profile, pushSession(profile, dayIso(1)), ["struggled"])
      .profile;
    expect(profile.patterns.push).toMatchObject({
      tier: 3,
      struggledStreak: 2,
      volumeReduced: true,
    });

    profile = apply(profile, pushSession(profile, dayIso(2)), ["struggled"])
      .profile;
    expect(profile.patterns.push).toMatchObject({
      tier: 2,
      struggledStreak: 0,
      cleanStreak: 0,
      volumeReduced: true, // soft landing at the lower tier
    });
  });

  it("a regression restamps tierSince with the session date", () => {
    let profile = profileAtTier(3);
    profile.patterns.push.tierSince = dayIso(-30);
    for (const day of [0, 1, 2]) {
      profile = apply(profile, pushSession(profile, dayIso(day)), ["struggled"])
        .profile;
    }
    expect(profile.patterns.push.tier).toBe(2);
    expect(profile.patterns.push.tierSince).toBe(dayIso(2));
  });

  it("volume reduction without regression keeps the existing tierSince", () => {
    let profile = profileAtTier(3);
    profile.patterns.push.tierSince = dayIso(-30);
    for (const day of [0, 1]) {
      profile = apply(profile, pushSession(profile, dayIso(day)), ["struggled"])
        .profile;
    }
    expect(profile.patterns.push.volumeReduced).toBe(true);
    expect(profile.patterns.push.tierSince).toBe(dayIso(-30));
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
    // regression, and must stay exactly where it is (not even a tierSince
    // stamp).
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
      profile = apply(profile, pushSession(profile, dayIso(i)), ["struggled"])
        .profile;
    }
    expect(profile.patterns.push.tier).toBe(1);
  });

  it("a struggled next-tier taste block does not touch progression state", () => {
    const profile = profileAtTier(2);
    profile.patterns.push.tierSince = dayIso(-14);
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
    profile.patterns.push.tierSince = dayIso(-365);
    for (let i = 0; i < 5; i++) {
      const result = apply(profile, pushSession(profile, dayIso(i)), [
        "completed",
      ]);
      profile = result.profile;
      expect(profile.patterns.push.tier).toBe(6);
      expect(result.unlockedSkills).toHaveLength(0);
    }
    expect(profile.patterns.push.cleanStreak).toBe(5);
  });
});

describe("applySessionResult — ledger", () => {
  it("awards flat base + duration points: 20/25/30 for 10/20/30 minutes", () => {
    for (const minutes of [10, 20, 30] as const) {
      const profile = createInitialProfile();
      const s = session([block("wall-push-up", "push")], minutes);
      const result = apply(profile, s, ["completed"]);
      const sessionEvents = result.ledgerEvents.filter(
        (e) => e.type === "session",
      );
      expect(sessionEvents).toHaveLength(1);
      expect(sessionEvents[0]?.points).toBe(
        POINTS.perSessionByMinutes[minutes],
      );
    }
    expect(POINTS.perSessionByMinutes).toStrictEqual({
      10: 20,
      20: 25,
      30: 30,
    });
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
    profile.patterns.push.tierSince = dayIso(-28); // floor met
    profile.patterns.push.cleanStreak = 2;

    const first = apply(profile, pushSession(profile, dayIso(0)), [
      "completed",
    ]);
    profile = first.profile;
    expect(first.unlockedSkills).toHaveLength(1);
    expect(profile.unlockedMilestones).toContainEqual({
      pattern: "push",
      tier: 4,
    });

    for (let i = 1; i <= 3; i++) {
      profile = apply(profile, pushSession(profile, dayIso(i)), ["struggled"])
        .profile;
    }
    expect(profile.patterns.push.tier).toBe(3);
    expect(profile.patterns.push.tierSince).toBe(dayIso(3));

    // Re-advance: 3 cleans banked, then the 28-day tier-3 floor from the
    // regression date.
    profile = cleanOn(profile, 4);
    profile = cleanOn(profile, 5);
    profile = cleanOn(profile, 6);
    expect(profile.patterns.push.tier).toBe(3); // floor unmet, cleans banked
    const final = apply(profile, pushSession(profile, dayIso(31)), [
      "completed",
    ]);

    expect(final.profile.patterns.push.tier).toBe(4);
    expect(final.unlockedSkills).toEqual([]);
    expect(
      final.ledgerEvents.filter((event) => event.type === "skillUnlock"),
    ).toHaveLength(0);
    expect(
      final.profile.unlockedMilestones?.filter(
        (milestone) => milestone.pattern === "push" && milestone.tier === 4,
      ),
    ).toHaveLength(1);
  });
});
