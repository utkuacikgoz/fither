import { render } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";
import {
  MAX_TIER,
  createInitialProfile,
  milestoneMovement,
  PATTERNS,
  type HistoryEntry,
  type Pattern,
  type Profile,
  type Tier,
} from "@fither/engine";

import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { todayIso } from "../../../lib/dates";
import { loadLibrary } from "../../../session/load-library";
import { movementFigure } from "../../../session/movement-figures";
import { useProfileStore } from "../../../state/profile-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { ProgressScreen } from "../progress-screen";

// The real bundled library — the same data the screen resolves against,
// so expected names come from milestoneMovement (the engine's canonical
// ladder-step lookup), never re-typed here.
const library = loadLibrary();
if (!library) throw new Error("bundled movement library missing in test env");

const hidden = { includeHiddenElements: true } as const;

/** Expected movement name at (pattern, tier). */
function ladderName(pattern: Pattern, tier: Tier): string {
  const movement = milestoneMovement(library!, pattern, tier);
  if (!movement) throw new Error(`no movement at ${pattern} tier ${tier}`);
  return movement.name;
}

/** A profile seeded per the tier-4 fixture conventions (fixtures.ts). */
function tier4Profile(): Profile {
  const profile = createInitialProfile();
  profile.patterns.push = {
    tier: 4,
    cleanCount: 0,
    struggleCount: 0,
    volumeReduced: false,
  };
  profile.unlockedMilestones = [{ pattern: "push", tier: 4 }];
  return profile;
}

/** Every ladder at the top, every skill behind her. */
function summitProfile(): Profile {
  const profile = createInitialProfile();
  for (const pattern of PATTERNS) {
    profile.patterns[pattern] = {
      tier: MAX_TIER as Tier,
      cleanCount: 0,
      struggleCount: 0,
      volumeReduced: false,
    };
  }
  return profile;
}

/** Local calendar date `n` days before today (same clock the screen reads). */
function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return todayIso(date);
}

/** A trained day: one completed block is what the streak counts. */
function trained(date: string): HistoryEntry {
  return {
    date,
    minutes: 10,
    blocks: [{ movementId: "wall-push-up", pattern: "push", outcome: "completed" }],
  };
}

beforeEach(() => {
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("ProgressScreen — patterns", () => {
  it("lists all five patterns with the tier and current movement from the store", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    const screen = render(<ProgressScreen />);

    expect(screen.getByText(strings.profile.title)).toBeTruthy();
    // The section caption sits outside the tile it names.
    expect(screen.getByText(strings.profile.patterns.title)).toBeTruthy();
    expect(
      screen.getByTestId("progress-patterns").findAllByProps({ children: strings.profile.patterns.title }),
    ).toHaveLength(0);

    for (const pattern of PATTERNS) {
      const row = screen.getByTestId(`pattern-${pattern}`);
      const tier = pattern === "push" ? 4 : 1;
      expect(screen.getByText(strings.profile.patterns.names[pattern])).toBeTruthy();
      // The visible tier is the short numeral; the row speaks the full
      // strings.profile.tier line and the movement she is on now.
      expect(screen.getByTestId(`pattern-${pattern}-tier`).props.children).toBe(String(tier));
      expect(row.props.accessible).toBe(true);
      expect(row.props.accessibilityLabel).toContain(strings.profile.tier(tier, MAX_TIER));
      expect(row.props.accessibilityLabel).toContain(ladderName(pattern, tier as Tier));
      expect(screen.getByTestId(`pattern-${pattern}-movement`).props.children).toBe(
        ladderName(pattern, tier as Tier),
      );
    }
  });

  it("draws the figure of her current movement on every row", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    const screen = render(<ProgressScreen />);
    const images = screen.getByTestId("pattern-push", hidden).findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual(
      movementFigure(milestoneMovement(library!, "push", 4)!.id),
    );
  });

  it("fills the tier track to the current tier, length from MAX_TIER", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    const screen = render(<ProgressScreen />);

    for (let step = 1; step <= 4; step += 1) {
      expect(screen.getByTestId(`tier-track-push-filled-${step}`, hidden)).toBeTruthy();
    }
    for (let step = 5; step <= MAX_TIER; step += 1) {
      expect(screen.queryByTestId(`tier-track-push-filled-${step}`, hidden)).toBeNull();
    }
    expect(screen.getByTestId("tier-track-push", hidden).children.length).toBe(MAX_TIER);

    // A fresh ladder shows exactly one reached step.
    expect(screen.getByTestId("tier-track-core-filled-1", hidden)).toBeTruthy();
    expect(screen.queryByTestId("tier-track-core-filled-2", hidden)).toBeNull();
  });
});

describe("ProgressScreen — next skill", () => {
  it("points at the engine's nearest milestone with its figure and distance", () => {
    // Fresh profile: every ladder at 1, so the first milestone (tier 4)
    // is three tiers ahead and ties break in PATTERNS order — push.
    const screen = render(<ProgressScreen />);

    expect(screen.getByText(strings.profile.skills.nextTitle)).toBeTruthy();
    const tile = screen.getByTestId("progress-next-skill", hidden);
    expect(screen.getByText(ladderName("push", 4))).toBeTruthy();
    expect(screen.getByText(strings.home.skills.away(3))).toBeTruthy();
    expect(screen.getByTestId("progress-current-skill")).toHaveTextContent(
      strings.profile.skills.from(ladderName("push", 1)),
    );
    const images = tile.findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual(
      movementFigure(milestoneMovement(library!, "push", 4)!.id),
    );
    // Before any skill lands, the tile says where skills come from.
    expect(screen.getByTestId("skills-empty")).toBeTruthy();
    expect(screen.getByText(strings.profile.skills.empty)).toBeTruthy();
  });

  it("lists earned skills beneath the next one, each with its own figure", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    const screen = render(<ProgressScreen />);

    // Push at 4 with the tier-4 skill earned: the next is push tier 6,
    // two ahead. The empty line is gone once a skill has landed.
    expect(screen.getByText(strings.home.skills.away(2))).toBeTruthy();
    expect(screen.getByText(ladderName("push", 6))).toBeTruthy();
    expect(screen.queryByText(strings.profile.skills.empty)).toBeNull();

    const row = screen.getByTestId("skill-push-4", hidden);
    expect(row.findAllByType(Image)).toHaveLength(1);
    expect(row.findAllByType(Image)[0]?.props.source).toEqual(
      movementFigure(milestoneMovement(library!, "push", 4)!.id),
    );
    // The earned skill's name appears on its row AND as the push
    // ladder's current movement — resolved once, through skill-name.
    expect(screen.getAllByText(ladderName("push", 4))).toHaveLength(2);
  });

  it("says so when every named skill is behind her", () => {
    useProfileStore.setState({ profile: summitProfile() });
    const screen = render(<ProgressScreen />);
    expect(screen.queryByTestId("progress-next-skill")).toBeNull();
    expect(screen.getByTestId("skills-all-reached")).toBeTruthy();
    expect(screen.getByText(strings.home.skills.empty)).toBeTruthy();
  });
});

describe("ProgressScreen — hero numerals", () => {
  it("reads the streak from the engine over the history the store holds", () => {
    // Today, a missed yesterday (the forgiven rest day), then two more:
    // a live run of 3 with the grace spent. An older run of 5 is her best.
    useProfileStore.setState({
      history: {
        entries: [0, 2, 3, 10, 11, 12, 13, 14].map((n) => trained(daysAgo(n))),
      },
    });
    const screen = render(<ProgressScreen />);

    expect(screen.getByTestId("progress-streak-value").props.children).toBe("3");
    // One caption line beside the numeral (owner, 2026-09-12), naming the
    // best only because it is higher than this run.
    expect(screen.getByText(strings.streak.tileCaption(3, 5))).toBeTruthy();
    expect(screen.queryByText(strings.streak.label(3))).toBeNull();
    // The spent rest day is retired copy: a run that used one reads
    // exactly like a run that did not.
    expect(screen.queryByText(strings.streak.restDayUsed)).toBeNull();
    // VoiceOver keeps the full sentences: StatTile speaks this label and
    // never the numeral, so the count must be in it.
    const tile = screen.getByTestId("progress-streak");
    expect(tile.props.accessibilityLabel).toContain(strings.streak.title);
    expect(tile.props.accessibilityLabel).toContain(strings.streak.label(3));
    expect(tile.props.accessibilityLabel).toContain(strings.streak.best(5));
  });

  it("never mentions the rest day, spent or not", () => {
    useProfileStore.setState({
      history: { entries: [0, 1].map((n) => trained(daysAgo(n))) },
    });
    const screen = render(<ProgressScreen />);
    expect(screen.getByTestId("progress-streak-value").props.children).toBe("2");
    // Her best IS this run: naming it beside the numeral would read as a
    // duplicate, so the caption carries the run alone.
    expect(screen.getByText(strings.streak.tileCaption(2, 2))).toBeTruthy();
    expect(screen.queryByText(strings.streak.best(2))).toBeNull();
    expect(screen.queryByText(strings.streak.restDayUsed)).toBeNull();
    expect(screen.queryByText(strings.streak.none)).toBeNull();
    expect(screen.getByTestId("progress-streak").props.accessibilityLabel).not.toContain(
      strings.streak.best(2),
    );
  });

  it("shows how a streak begins when none is alive", () => {
    const screen = render(<ProgressScreen />);
    expect(screen.getByTestId("progress-streak-value").props.children).toBe("0");
    expect(screen.getByText(strings.streak.none)).toBeTruthy();
    expect(screen.queryByText(strings.streak.label(0))).toBeNull();
  });

  it("keeps capability and consistency primary, without an unexplained points total", () => {
    const screen = render(<ProgressScreen />);
    expect(screen.getByTestId("progress-next-skill")).toBeTruthy();
    expect(screen.getByTestId("progress-streak")).toBeTruthy();
    expect(screen.queryByTestId("progress-points")).toBeNull();
  });
});

it("renders no user-facing text outside strings.ts (plus library data)", () => {
  useProfileStore.setState({
    profile: tier4Profile(),
    history: { entries: [0, 1, 3].map((n) => trained(daysAgo(n))) },
  });

  const allowed = collectStringValues(strings);
  // Parameterised strings.ts values, explicitly enumerated.
  for (let n = 0; n <= MAX_TIER; n += 1) {
    allowed.add(strings.streak.label(n));
    allowed.add(strings.streak.best(n));
    // The tile's one caption line, both shapes: with the best named and
    // without (it is named only when it is higher than the run).
    allowed.add(strings.streak.tileCaption(n, n));
    allowed.add(strings.streak.tileCaption(n, n + 1));
    allowed.add(strings.home.skills.away(n));
    // Tier numerals on the pattern rows; the sentence is spoken, not drawn.
    allowed.add(String(n));
  }
  // Library-sourced movement names are data, like the player's.
  for (const movement of library!.movements) {
    allowed.add(movement.name);
    allowed.add(strings.profile.skills.from(movement.name));
  }
  // Decorative glyph token (hidden from accessibility), not copy.
  allowed.add(glyph.check);

  const screen = render(<ProgressScreen />);
  for (const leaf of renderedTextLeaves(screen.toJSON())) {
    expect(allowed.has(leaf) ? true : leaf).toBe(true);
  }
});
