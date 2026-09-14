import { render } from "@testing-library/react-native";
import React from "react";
import {
  MAX_TIER,
  PATTERNS,
  SKILL_MILESTONE_TIERS,
  createInitialProfile,
  milestoneMovement,
  type Pattern,
  type Profile,
  type Tier,
} from "@fither/engine";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { loadLibrary } from "../../../session/load-library";
import { useProfileStore } from "../../../state/profile-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { LadderScreen, parseLadderPattern } from "../ladder-screen";

// The ladder page (owner decision 2026-09-14, design A2): six rungs from
// the engine's own lookup, hers marked, the milestone marked, the
// distance to the next skill only when it is on this ladder.

const library = loadLibrary();
if (!library) throw new Error("bundled movement library missing in test env");

const hidden = { includeHiddenElements: true } as const;

function rungName(pattern: Pattern, tier: Tier): string {
  const movement = milestoneMovement(library!, pattern, tier);
  if (!movement) throw new Error(`no movement at ${pattern} tier ${tier}`);
  return movement.name;
}

function profileAt(pattern: Pattern, tier: Tier): Profile {
  const profile = createInitialProfile();
  profile.patterns[pattern] = { tier, cleanCount: 0, struggleCount: 0, volumeReduced: false };
  return profile;
}

beforeEach(() => {
  clearRecordedEvents();
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("LadderScreen", () => {
  it("names the movement she is on, with the pattern and the tier line over it", () => {
    useProfileStore.setState({ profile: profileAt("push", 2) });
    const screen = render(<LadderScreen pattern="push" />);
    expect(screen.getByTestId("ladder-current")).toHaveTextContent(rungName("push", 2));
    expect(
      screen.getByText(
        strings.profile.ladder.header(strings.profile.patterns.names.push, strings.profile.tier(2, MAX_TIER)),
      ),
    ).toBeTruthy();
  });

  it("draws every rung in order from the engine's lookup: behind her checked, hers Now, ahead numbered", () => {
    useProfileStore.setState({ profile: profileAt("squat", 3) });
    const screen = render(<LadderScreen pattern="squat" />);
    for (let tier = 1; tier <= MAX_TIER; tier += 1) {
      expect(screen.getByTestId(`ladder-rung-${tier}-name`)).toHaveTextContent(rungName("squat", tier as Tier));
    }
    expect(screen.getByTestId("ladder-rung-1-done")).toBeTruthy();
    expect(screen.getByTestId("ladder-rung-2-done")).toBeTruthy();
    expect(screen.queryByTestId("ladder-rung-3-done")).toBeNull();
    expect(screen.getByTestId("ladder-now")).toBeTruthy();
    expect(screen.getByTestId("ladder-rung-3").props.accessibilityLabel).toContain(strings.profile.ladder.now);
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText(String(MAX_TIER))).toBeTruthy();
    // Order is the ladder's order, top to bottom.
    const leaves = renderedTextLeaves(screen.toJSON());
    expect(leaves.indexOf(rungName("squat", 1))).toBeLessThan(leaves.indexOf(rungName("squat", 6)));
  });

  it("marks the engine's milestone rungs Skill, and no others", () => {
    const screen = render(<LadderScreen pattern="pull" />);
    for (let tier = 1; tier <= MAX_TIER; tier += 1) {
      const label = screen.getByTestId(`ladder-rung-${tier}`).props.accessibilityLabel as string;
      expect(label.includes(strings.profile.ladder.skill)).toBe(SKILL_MILESTONE_TIERS.includes(tier as Tier));
    }
    expect(screen.getAllByText(strings.profile.ladder.skill, hidden)).toHaveLength(SKILL_MILESTONE_TIERS.length);
  });

  it("says how far the next skill is only when it sits on this ladder", () => {
    // A fresh profile: every pattern at tier 1, the nearest milestone
    // is push tier 4 (PATTERNS order breaks the tie), three tiers away.
    const push = render(<LadderScreen pattern="push" />);
    expect(push.getByTestId("ladder-to-skill")).toHaveTextContent(
      strings.profile.ladder.toSkill(rungName("push", 4), 3),
    );
    push.unmount();
    const hinge = render(<LadderScreen pattern="hinge" />);
    expect(hinge.queryByTestId("ladder-to-skill")).toBeNull();
  });

  it("closes with the rule the climb is made of, and reports the view once", () => {
    const screen = render(<LadderScreen pattern="core" />);
    expect(screen.getByTestId("ladder-rule")).toHaveTextContent(strings.profile.skills.empty);
    expect(recordedEvents().filter((e) => e.name === "ladder_view")).toEqual([
      { name: "ladder_view", properties: { pattern: "core" } },
    ]);
  });

  it("renders no user-facing text outside strings.ts (movement names are library data)", () => {
    useProfileStore.setState({ profile: profileAt("push", 4) });
    const allowed = collectStringValues(strings);
    for (const movement of library!.movements) allowed.add(movement.name);
    for (let tier = 1; tier <= MAX_TIER; tier += 1) allowed.add(String(tier));
    allowed.add(glyph.check); // the earned mark, owned by the design layer
    allowed.add(
      strings.profile.ladder.header(strings.profile.patterns.names.push, strings.profile.tier(4, MAX_TIER)),
    );
    allowed.add(strings.profile.ladder.toSkill(rungName("push", 6), 2));
    const screen = render(<LadderScreen pattern="push" />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf) ? null : leaf).toBeNull();
    }
  });
});

describe("parseLadderPattern", () => {
  it("accepts each of the five ladders and falls back to the first for anything else", () => {
    for (const pattern of PATTERNS) expect(parseLadderPattern(pattern)).toBe(pattern);
    expect(parseLadderPattern(["pull", "push"])).toBe("pull");
    expect(parseLadderPattern("weight")).toBe(PATTERNS[0]);
    expect(parseLadderPattern(undefined)).toBe(PATTERNS[0]);
  });
});
