import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import {
  createInitialProfile,
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
import { useIntentionStore } from "../../../state/intention-store";
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

// The hub in its three states, plus the week and the skill glance. Every
// value on this screen comes from a store or the engine — the tests seed
// stores and assert what the screen reads back, never a literal the
// screen invented.

// The hub's reactive today, pinned per test: the week tests need a known
// weekday (2026-09-07 is a Monday); everything else runs on the real date.
const mockToday = { iso: "" };
jest.mock("../../../lib/use-today", () => ({
  useTodayIso: () => mockToday.iso,
}));

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
  mockToday.iso = todayIso();
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
  useIntentionStore.setState({
    target: null,
    asked: false,
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

  it("names the run she is on under the open day — the count alone, nothing about what today does for it (wave 2)", () => {
    seedHistory([
      todayEntry(10, ["completed"], shiftDays(-2)),
      todayEntry(10, ["completed"], shiftDays(-1)),
    ]);
    const screen = render(<HomeScreen />);

    expect(screen.getByTestId("home-streak")).toBeTruthy();
    expect(screen.getByText(strings.streak.label(2))).toBeTruthy();
    // Streak pressure is out of Home: no "keeps it going" caption.
    expect(screen.queryByText(strings.streak.atRiskToday)).toBeNull();
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
    // Nothing about what today does for the run, trained or not.
    expect(screen.queryByText(strings.streak.atRiskToday)).toBeNull();
  });

  it("shows no streak line at all with no run alive: the hub never shows a zero", () => {
    const screen = render(<HomeScreen />);
    expect(screen.queryByTestId("home-streak")).toBeNull();
    screen.unmount();

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

describe("this week", () => {
  // 2026-09-07 is a Monday; the week runs to Sunday the 13th.
  const MON = "2026-09-07";
  const WED = "2026-09-09";
  const FRI = "2026-09-11";
  const SUN = "2026-09-13";

  /**
   * The day's drawn state, as the shared WeekRow marks it: a filled disc
   * for a trained day, the ring for today, a hairline for the rest.
   */
  function dot(screen: ReturnType<typeof render>, index: number) {
    const id = `home-week-day-${index}`;
    const filled = screen.queryByTestId(`${id}-trained`) !== null;
    const today = screen.queryByTestId(`${id}-today`) !== null;
    return { filled, ringed: filled || today };
  }

  it("a Mon/Wed/Fri user against three sees the week met on Friday, and still on Sunday", () => {
    useIntentionStore.setState({ target: 3, asked: true });
    seedHistory([
      todayEntry(10, ["completed"], MON),
      todayEntry(10, ["completed"], WED),
      todayEntry(10, ["completed"], FRI),
    ]);
    for (const today of [FRI, SUN]) {
      mockToday.iso = today;
      const screen = render(<HomeScreen />);
      expect(screen.getByText(strings.week.title)).toBeTruthy();
      expect(screen.getByTestId("home-week-line").props.children).toBe(strings.week.met(3));
      // Three filled dots — Monday, Wednesday, Friday — and no others.
      expect([0, 1, 2, 3, 4, 5, 6].map((i) => dot(screen, i).filled)).toEqual([
        true, false, true, false, true, false, false,
      ]);
      // Days she did not train are not named anywhere.
      expect(screen.queryByText(new RegExp(strings.week.nextLine("Saturday")))).toBeNull();
      screen.unmount();
    }
  });

  it("mid-week with a target remaining: the count, the next day's name, today ringed", () => {
    useIntentionStore.setState({ target: 3, asked: true });
    seedHistory([todayEntry(10, ["completed"], MON)]);
    mockToday.iso = WED;
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-week-line").props.children).toBe(
      `${strings.week.progress(1, 3)} ${strings.week.nextLine("Wednesday")}`,
    );
    expect(dot(screen, 0)).toEqual({ filled: true, ringed: true });
    expect(dot(screen, 2)).toEqual({ filled: false, ringed: true });
    expect(dot(screen, 3)).toEqual({ filled: false, ringed: false });
  });

  it("a no-target user reads the plain count, never 'of'", () => {
    seedHistory([todayEntry(10, ["completed"], MON), todayEntry(10, ["struggled"], WED)]);
    mockToday.iso = WED;
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-week-line").props.children).toBe(
      strings.week.progressNoTarget(2),
    );
    expect(screen.queryByText(strings.week.progress(2, 2))).toBeNull();
    expect(screen.queryByText(strings.week.progress(2, 3))).toBeNull();
    expect(dot(screen, 0).filled).toBe(true);
    expect(dot(screen, 2).filled).toBe(true);
  });

  it("two sessions on one date fill one dot and count once", () => {
    useIntentionStore.setState({ target: 2, asked: true });
    seedHistory([todayEntry(10, ["completed"], MON), todayEntry(20, ["completed"], MON)]);
    mockToday.iso = MON;
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-week-line").props.children).toBe(
      `${strings.week.progress(1, 2)} ${strings.week.nextLine("Tuesday")}`,
    );
    expect([0, 1, 2, 3, 4, 5, 6].filter((i) => dot(screen, i).filled)).toEqual([0]);
  });

  it("an all-skipped day is not a trained day: no dot, nothing counted", () => {
    seedHistory([todayEntry(10, ["skipped", "skipped"], MON)]);
    mockToday.iso = MON;
    const screen = render(<HomeScreen />);
    expect(screen.getByTestId("home-week-line").props.children).toBe(
      strings.week.progressNoTarget(0),
    );
    expect(dot(screen, 0)).toEqual({ filled: false, ringed: true });
  });

  it("speaks each day by its name, trained days selected", () => {
    seedHistory([todayEntry(10, ["completed"], MON), todayEntry(10, ["completed"], FRI)]);
    mockToday.iso = FRI;
    const screen = render(<HomeScreen />);
    const day = (index: number) => screen.getByTestId(`home-week-day-${index}`).props;
    expect(day(0).accessibilityLabel).toBe(strings.week.dayNames[0]);
    expect(day(0).accessibilityState).toEqual({ selected: true });
    expect(day(2).accessibilityLabel).toBe(strings.week.dayNames[2]);
    expect(day(2).accessibilityState).toEqual({ selected: false });
    expect(day(4).accessibilityState).toEqual({ selected: true });
  });

  it("the tile is information, not a door: a press goes nowhere", () => {
    seedHistory([todayEntry(10, ["completed"], MON)]);
    mockToday.iso = MON;
    const screen = render(<HomeScreen />);
    fireEvent.press(screen.getByTestId("home-week-tile"));
    fireEvent.press(screen.getByTestId("home-week"));
    fireEvent.press(screen.getByTestId("home-week-day-0"));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("the glances", () => {
  it("the patterns tile is not on Home any more — the five ladders live on Progress", () => {
    const profile = createInitialProfile();
    profile.patterns.push = {
      tier: 4,
      cleanCount: 0,
      struggleCount: 0,
      volumeReduced: false,
    };
    seedProfile(profile);
    const screen = render(<HomeScreen />);
    expect(screen.queryByTestId("home-patterns")).toBeNull();
    expect(
      screen.queryByTestId("home-pattern-push-filled-1", { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.queryByText(strings.profile.patterns.title)).toBeNull();
    // The skill tile is still the one door to Progress.
    fireEvent.press(screen.getByTestId("home-skills"));
    expect(router.push).toHaveBeenCalledWith("/progress");
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
    // The week tile's one line, every shape it can take.
    for (let n = 0; n <= 7; n += 1) {
      allowed.add(strings.week.progressNoTarget(n));
      for (const target of [2, 3] as const) {
        allowed.add(strings.week.progress(n, target));
        for (const day of strings.week.dayNames) {
          allowed.add(`${strings.week.progress(n, target)} ${strings.week.nextLine(day)}`);
        }
      }
    }
    allowed.add(strings.week.met(2));
    allowed.add(strings.week.met(3));
    const screen = render(<HomeScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      // Name the offender on failure instead of just `false`.
      expect(allowed.has(leaf) ? true : leaf).toBe(true);
    }
  });
});
