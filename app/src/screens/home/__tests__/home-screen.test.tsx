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
      session: fixtureSession,
      player: reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }),
    });
    const screen = render(<HomeScreen />);

    expect(screen.getByText(strings.resume.headline)).toBeTruthy();
    expect(screen.queryByTestId("home-start")).toBeNull();

    fireEvent.press(screen.getByTestId("home-keep-going"));
    expect(router.push).toHaveBeenCalledWith("/session");
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
    for (let step = 1; step <= 4; step += 1) {
      expect(screen.getByTestId(`home-pattern-push-filled-${step}`)).toBeTruthy();
    }
    expect(screen.queryByTestId("home-pattern-push-filled-5")).toBeNull();
    expect(screen.getByTestId("home-pattern-pull-filled-1")).toBeTruthy();
    expect(screen.queryByTestId("home-pattern-pull-filled-2")).toBeNull();
    expect(
      screen.queryByTestId(`home-pattern-push-filled-${MAX_TIER + 1}`),
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

  it("names the skill she has earned from the movement library", () => {
    const profile = createInitialProfile();
    profile.unlockedMilestones = [{ pattern: "push", tier: 4 }];
    seedProfile(profile);
    const screen = render(<HomeScreen />);

    expect(screen.getByText(ladderName("push", 4))).toBeTruthy();
    expect(screen.queryByTestId("home-skills-empty")).toBeNull();

    fireEvent.press(screen.getByTestId("home-skills"));
    expect(router.push).toHaveBeenCalledWith("/progress");
  });

  it("shows the forward-looking empty line before the first skill", () => {
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-skills-empty")).toBeTruthy();
    expect(screen.getByText(strings.home.skills.empty)).toBeTruthy();
  });

  it("tolerates a profile persisted before milestones existed", () => {
    const profile = createInitialProfile();
    delete profile.unlockedMilestones;
    seedProfile(profile);
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-skills-empty")).toBeTruthy();
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
    // Library-sourced (a movement name), not copy.
    allowed.add(ladderName("push", 4));
    // A decorative glyph token, not copy (same allowance as progress).
    allowed.add(glyph.check);
    const screen = render(<HomeScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
