import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import {
  createInitialProfile,
  MAX_TIER,
  milestoneMovement,
  type Pattern,
  type Profile,
  type Tier,
} from "@fither/engine";

import { strings } from "../../../copy/strings";
import { skillLabel } from "../../../session/skill-name";
import { glyph } from "../../../design/tokens";
import { loadLibrary } from "../../../session/load-library";
import {
  createPlayer,
  finishEarly,
  reduce,
} from "../../../session/player-machine";
import { useProfileStore } from "../../../state/profile-store";
import { useSessionStore } from "../../../state/session-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import {
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../../test-utils/fixtures";
import { todayIso } from "../../../lib/dates";
import { HomeScreen } from "../home-screen";

// The hub in its three states, plus the two glances. Every value on this
// screen comes from a store or the engine — the tests seed stores and
// assert what the screen reads back, never a literal the screen invented.

const library = loadLibrary();
if (!library) throw new Error("bundled movement library missing in test env");

/** The canonical movement at (pattern, tier) — the engine's own lookup. */
function ladderName(pattern: Pattern, tier: Tier): string {
  const movement = milestoneMovement(library!, pattern, tier);
  if (!movement) throw new Error(`no movement at ${pattern} tier ${tier}`);
  return movement.name;
}

function todayEntry(
  minutes: 10 | 20 | 30,
  outcomes: Array<"completed" | "struggled" | "skipped">,
  date = todayIso(),
) {
  return {
    date,
    minutes,
    blocks: outcomes.map((outcome, index) => ({
      movementId: `movement-${index}`,
      pattern: "push" as const,
      outcome,
    })),
  };
}

/** An ISO day `delta` days from today (negative = past), UTC-safe. */
function shiftDays(delta: number): string {
  const [y, m, d] = todayIso().split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

function seedProfile(profile: Profile) {
  useProfileStore.setState({ profile });
}

function seedHistory(entries: Array<ReturnType<typeof todayEntry>>) {
  useProfileStore.setState({ history: { entries } });
}

beforeEach(() => {
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.setState({
    prompt: null,
    sessionId: null,
    session: null,
    player: null,
    finish: null,
  });
});

describe("the day's card", () => {
  it("nothing today: one warm line and one primary action into the questions", () => {
    const screen = render(<HomeScreen />);

    expect(screen.getByText(strings.prompt.dayLabel)).toBeTruthy();
    expect(screen.getByText(strings.home.today.line)).toBeTruthy();
    // No done-state claim over a day with nothing in it.
    expect(
      screen.queryByText(strings.prompt.completedToday.headline),
    ).toBeNull();
    expect(screen.queryByText(strings.resume.headline)).toBeNull();

    fireEvent.press(screen.getByTestId("home-start"));
    expect(router.push).toHaveBeenCalledWith("/prompt");
  });

  it("in flight: 'Keep going' back into the player, never a second start", () => {
    useSessionStore.setState({
      prompt: fixturePrompt,
      sessionId: "test:session",
      // Dated today: a session dated another day is, by rule, not today's.
      session: { ...fixtureSession, date: todayIso() },
      player: reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }),
    });
    const screen = render(<HomeScreen />);

    expect(screen.getByText(strings.resume.headline)).toBeTruthy();
    expect(screen.queryByTestId("home-start")).toBeNull();

    fireEvent.press(screen.getByTestId("home-keep-going"));
    expect(router.push).toHaveBeenCalledWith("/session");
  });

  it("built but never begun is NOT in flight: the card goes to the preview, not the player", () => {
    // Reviewer blocker: back-chevron out of the prompt after "Change
    // today's answers" left a fresh player in memory, and Home offered
    // "Keep going" (false) straight into the player, skipping the
    // preview's adaptation line.
    useSessionStore.setState({
      session: { ...fixtureSession, date: todayIso() },
      player: createPlayer(fixturePlayerBlocks),
    });
    const screen = render(<HomeScreen />);
    expect(screen.queryByTestId("home-keep-going")).toBeNull();
    expect(screen.queryByText(strings.resume.headline)).toBeNull();
    fireEvent.press(screen.getByTestId("home-start"));
    expect(router.push).toHaveBeenCalledWith("/preview");
  });

  it("a session dated another day, left in memory overnight, does not claim today", () => {
    useSessionStore.setState({
      session: { ...fixtureSession, date: "2026-08-30" },
      player: reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }),
    });
    const screen = render(<HomeScreen />);
    expect(screen.queryByTestId("home-keep-going")).toBeNull();
    fireEvent.press(screen.getByTestId("home-start"));
    expect(router.push).toHaveBeenCalledWith("/prompt");
  });

  it("a finished session is not 'in flight' — the day's card moves on", () => {
    // The player reached done; /finish owns it. The hub must not offer to
    // keep going into a session that has nothing left to play.
    useSessionStore.setState({
      prompt: fixturePrompt,
      sessionId: "test:session",
      session: fixtureSession,
      player: finishEarly(createPlayer(fixturePlayerBlocks)),
    });
    const screen = render(<HomeScreen />);

    expect(screen.queryByText(strings.resume.headline)).toBeNull();
    expect(screen.getByTestId("home-start")).toBeTruthy();
  });

  it("done: the calm state, the true minutes, and one quiet 'Another session'", () => {
    seedHistory([todayEntry(20, ["completed", "completed"])]);
    const screen = render(<HomeScreen />);

    expect(
      screen.getByText(strings.prompt.completedToday.headline),
    ).toBeTruthy();
    expect(screen.getByText(strings.prompt.completedToday.line(20))).toBeTruthy();
    // Nothing pushes her to train again; the action is quiet, not primary.
    expect(screen.queryByTestId("home-start")).toBeNull();

    fireEvent.press(screen.getByTestId("home-another-session"));
    expect(router.push).toHaveBeenCalledWith("/prompt");
  });

  it("done, but partial: no minutes are claimed", () => {
    seedHistory([todayEntry(20, ["completed", "skipped", "skipped"])]);
    const screen = render(<HomeScreen />);

    expect(screen.getByText(strings.prompt.completedToday.lineSome)).toBeTruthy();
    expect(
      screen.queryByText(strings.prompt.completedToday.line(20)),
    ).toBeNull();
  });

  it("an all-skipped session is not training: the day is still open", () => {
    seedHistory([todayEntry(10, ["skipped", "skipped"])]);
    const screen = render(<HomeScreen />);

    expect(screen.getByTestId("home-start")).toBeTruthy();
    expect(
      screen.queryByText(strings.prompt.completedToday.headline),
    ).toBeNull();
  });

  it("names the run she is on under the open day, and what today does for it (ADR-0018)", () => {
    seedHistory([
      todayEntry(10, ["completed"], shiftDays(-2)),
      todayEntry(10, ["completed"], shiftDays(-1)),
    ]);
    const screen = render(<HomeScreen />);

    expect(screen.getByTestId("home-streak")).toBeTruthy();
    expect(screen.getByText(strings.streak.label(2))).toBeTruthy();
    expect(screen.getByText(strings.streak.atRiskToday)).toBeTruthy();
    expect(screen.queryByText(strings.streak.best(2))).toBeNull();
  });

  it("counts today once trained, and names a longer best when there is one", () => {
    seedHistory([
      todayEntry(10, ["completed"], shiftDays(-9)),
      todayEntry(10, ["completed"], shiftDays(-8)),
      todayEntry(10, ["completed"], shiftDays(-7)),
      todayEntry(10, ["completed"], shiftDays(-1)),
      todayEntry(20, ["completed", "completed"]),
    ]);
    const screen = render(<HomeScreen />);

    expect(screen.getByText(strings.streak.label(2))).toBeTruthy();
    expect(screen.getByText(strings.streak.best(3))).toBeTruthy();
    // Trained: nothing is at stake today, so nothing says so.
    expect(screen.queryByText(strings.streak.atRiskToday)).toBeNull();
  });

  it("shows no streak line at all with no run alive: the hub never shows a zero", () => {
    const screen = render(<HomeScreen />);
    expect(screen.queryByTestId("home-streak")).toBeNull();

    // A skipped-through day is not training and starts nothing.
    seedHistory([todayEntry(10, ["skipped", "skipped"], shiftDays(-1))]);
    const again = render(<HomeScreen />);
    expect(again.queryByTestId("home-streak")).toBeNull();
  });

  it("yesterday's completed session never claims today", () => {
    seedHistory([todayEntry(30, ["completed"], "2026-08-01")]);
    const screen = render(<HomeScreen />);

    expect(screen.getByTestId("home-start")).toBeTruthy();
    expect(
      screen.queryByText(strings.prompt.completedToday.headline),
    ).toBeNull();
  });
});

describe("the glances", () => {
  it("the tier row renders the profile's tiers, not invented ones", () => {
    const profile = createInitialProfile();
    profile.patterns.push = {
      tier: 4,
      cleanCount: 0,
      struggleCount: 0,
      volumeReduced: false,
    };
    seedProfile(profile);
    const screen = render(<HomeScreen />);

    // Four filled steps for push (its stored tier), one for a pattern
    // still at tier 1 — the track length itself is the engine's MAX_TIER.
    // The glance draws the shared Track, which is decorative and hidden
    // from accessibility (the card's label speaks), so queries opt in.
    const hidden = { includeHiddenElements: true } as const;
    for (let step = 1; step <= 4; step += 1) {
      expect(screen.getByTestId(`home-pattern-push-filled-${step}`, hidden)).toBeTruthy();
    }
    expect(screen.queryByTestId("home-pattern-push-filled-5", hidden)).toBeNull();
    expect(screen.getByTestId("home-pattern-pull-filled-1", hidden)).toBeTruthy();
    expect(screen.queryByTestId("home-pattern-pull-filled-2", hidden)).toBeNull();
    expect(
      screen.queryByTestId(`home-pattern-push-filled-${MAX_TIER + 1}`, hidden),
    ).toBeNull();

    fireEvent.press(screen.getByTestId("home-patterns"));
    expect(router.push).toHaveBeenCalledWith("/progress");
  });

  it("the tier row speaks its ladders and tiers to VoiceOver", () => {
    const profile = createInitialProfile();
    profile.patterns.push = {
      tier: 3,
      cleanCount: 0,
      struggleCount: 0,
      volumeReduced: false,
    };
    seedProfile(profile);
    const screen = render(<HomeScreen />);

    const label = screen.getByTestId("home-patterns").props.accessibilityLabel;
    expect(label).toContain(strings.profile.patterns.names.push);
    expect(label).toContain(strings.profile.tier(3, MAX_TIER));
    expect(label).toContain(strings.profile.tier(1, MAX_TIER));
  });

  it("names the NEXT skill from the library, with how far ahead it is", () => {
    // A fresh profile: every pattern at tier 1, so the nearest milestone
    // is push tier 4 — three tiers ahead. The engine picks it; the screen
    // only renders what it returns.
    const screen = render(<HomeScreen />);

    expect(screen.getByTestId("home-next-skill")).toBeTruthy();
    expect(screen.getByText(ladderName("push", 4))).toBeTruthy();
    expect(screen.getByText(strings.home.skills.away(3))).toBeTruthy();
    expect(screen.queryByTestId("home-skills-empty")).toBeNull();

    fireEvent.press(screen.getByTestId("home-skills"));
    expect(router.push).toHaveBeenCalledWith("/progress");
  });

  it("moves the card on to the next milestone once one is earned", () => {
    const profile = createInitialProfile();
    profile.patterns.push.tier = 4;
    profile.unlockedMilestones = [{ pattern: "push", tier: 4 }];
    seedProfile(profile);
    const screen = render(<HomeScreen />);

    // Push tier 6 is now nearest (2 ahead) — the earned skill is behind
    // her and belongs to Progress, not the forward-looking card.
    expect(screen.getByText(ladderName("push", 6))).toBeTruthy();
    expect(screen.getByText(strings.home.skills.away(2))).toBeTruthy();
  });

  it("never promises a legacy profile a skill it already holds", () => {
    // Trained past tier 4 before unlockedMilestones existed: the field is
    // absent, the tier proves she has it. The card must point at push's
    // tier 6, not re-promise tier 4 — the case a tier-1 profile with the
    // field deleted never exercised.
    const profile = createInitialProfile();
    profile.patterns.push = { tier: 5, cleanCount: 0, struggleCount: 0, volumeReduced: false };
    delete profile.unlockedMilestones;
    seedProfile(profile);
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-next-skill")).toBeTruthy();
    expect(screen.getByText(skillLabel(loadLibrary(), "push", 6))).toBeTruthy();
    expect(screen.queryByText(skillLabel(loadLibrary(), "push", 4))).toBeNull();
    expect(screen.getByText(strings.home.skills.away(1))).toBeTruthy();
  });

  it("says every skill is reached only when none remain", () => {
    const profile = createInitialProfile();
    for (const pattern of ["push", "pull", "squat", "hinge", "core"] as const) {
      profile.patterns[pattern].tier = 6;
    }
    seedProfile(profile);
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-skills-empty")).toBeTruthy();
    expect(screen.getByText(strings.home.skills.empty)).toBeTruthy();
  });
});

describe("copy", () => {
  it("renders no user-facing text outside strings.ts", () => {
    seedHistory([todayEntry(10, ["completed"])]);
    const profile = createInitialProfile();
    profile.unlockedMilestones = [{ pattern: "push", tier: 4 }];
    seedProfile(profile);

    const allowed = collectStringValues(strings);
    // Parameterised strings.ts values, explicitly enumerated.
    allowed.add(strings.prompt.completedToday.line(10));
    // Library-sourced movement names are DATA, not copy — the same
    // allowance the Progress screen's audit makes. Which one the card
    // names depends on the engine's nearest-milestone answer, so allow
    // the library rather than guessing.
    for (const movement of loadLibrary()?.movements ?? []) {
      allowed.add(movement.name);
    }
    // Parameterised distance caption, every value the card can render.
    for (let n = 1; n <= 5; n += 1) allowed.add(strings.home.skills.away(n));
    // A decorative glyph token, not copy (same allowance as progress).
    allowed.add(glyph.check);
    // The streak line, every count it can show.
    for (let n = 1; n <= 60; n += 1) {
      allowed.add(strings.streak.label(n));
      allowed.add(strings.streak.best(n));
    }
    const screen = render(<HomeScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      // Name the offender on failure instead of just `false`.
      expect(allowed.has(leaf) ? true : leaf).toBe(true);
    }
  });
});
