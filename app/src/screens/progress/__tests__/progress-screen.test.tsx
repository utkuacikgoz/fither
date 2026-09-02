import { render } from "@testing-library/react-native";
import React from "react";
import {
  MAX_TIER,
  createInitialProfile,
  milestoneMovement,
  PATTERNS,
  type LedgerEvent,
  type Pattern,
  type Profile,
  type Tier,
} from "@fither/engine";

import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { loadLibrary } from "../../../session/load-library";
import { useLedgerStore } from "../../../state/ledger-store";
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

/** Expected row label: the canonical movement at (pattern, tier). */
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
    cleanStreak: 0,
    struggledStreak: 0,
    volumeReduced: false,
  };
  profile.unlockedMilestones = [{ pattern: "push", tier: 4 }];
  return profile;
}

beforeEach(() => {
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
  useLedgerStore.setState({
    events: [],
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("ProgressScreen", () => {
  it("renders all five pattern ladders with tiers read from the profile store", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    const screen = render(<ProgressScreen />);

    expect(screen.getByText(strings.profile.title)).toBeTruthy();
    expect(screen.getByText(strings.profile.patterns.title)).toBeTruthy();

    // Five rows, one per engine pattern — never fewer, never invented.
    for (const pattern of PATTERNS) {
      expect(screen.getByTestId(`pattern-${pattern}`)).toBeTruthy();
    }

    // Tier strings come from strings.profile.tier over store state, the
    // ladder length from the engine's MAX_TIER: push sits at 4, the
    // other four ladders at 1.
    expect(screen.getByText(strings.profile.tier(4, MAX_TIER))).toBeTruthy();
    expect(screen.getAllByText(strings.profile.tier(1, MAX_TIER))).toHaveLength(
      PATTERNS.length - 1,
    );

    // Ladder rows carry the pattern nouns from strings.ts; the movement
    // name appears exactly once, on the earned skill row — never doubled
    // as a ladder label.
    for (const pattern of PATTERNS) {
      expect(
        screen.getByText(strings.profile.patterns.names[pattern]),
      ).toBeTruthy();
    }
    expect(screen.getAllByText(ladderName("push", 4))).toHaveLength(1);
  });

  it("fills the tier track to the current tier, length from MAX_TIER", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    const screen = render(<ProgressScreen />);
    // The track is decorative and hidden from accessibility (the tier
    // line beside it is the accessible reading), so queries opt in.
    const hidden = { includeHiddenElements: true } as const;

    // Push at tier 4: steps 1..4 filled, nothing past it — and nothing
    // past the engine's MAX_TIER exists at all.
    for (let step = 1; step <= 4; step += 1) {
      expect(
        screen.getByTestId(`tier-track-push-filled-${step}`, hidden),
      ).toBeTruthy();
    }
    for (let step = 5; step <= MAX_TIER; step += 1) {
      expect(
        screen.queryByTestId(`tier-track-push-filled-${step}`, hidden),
      ).toBeNull();
    }
    expect(
      screen.getByTestId("tier-track-push", hidden).children.length,
    ).toBe(MAX_TIER);

    // A fresh ladder shows exactly one reached step.
    expect(screen.getByTestId("tier-track-core-filled-1", hidden)).toBeTruthy();
    expect(screen.queryByTestId("tier-track-core-filled-2", hidden)).toBeNull();
  });

  it("resolves unlocked skills to their library names", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    const screen = render(<ProgressScreen />);

    expect(screen.getByText(strings.profile.skills.title)).toBeTruthy();
    expect(screen.getByTestId("skill-push-4")).toBeTruthy();
    // The tier-4 push milestone is the capability namesake ("Full
    // Push-Up" in the real library) — resolved, not re-typed. It appears
    // twice: the ladder row at her current tier and the skill row.
    expect(screen.getAllByText(ladderName("push", 4)).length).toBeGreaterThan(0);
    expect(screen.queryByText(strings.profile.skills.empty)).toBeNull();
  });

  it("shows the calm empty state before any skill lands", () => {
    const screen = render(<ProgressScreen />);
    expect(screen.getByText(strings.profile.skills.empty)).toBeTruthy();
    expect(screen.getByTestId("skills-empty")).toBeTruthy();
  });

  it("totals the ledger through the ledger module's own sum", () => {
    const events: LedgerEvent[] = [
      { type: "session", points: 20, date: "2026-08-30" },
      { type: "session", points: 25, date: "2026-08-31" },
      {
        type: "skillUnlock",
        points: 25,
        date: "2026-08-31",
        pattern: "push",
        movementId: "full-push-up",
      },
    ];
    useLedgerStore.setState({ events });
    const screen = render(<ProgressScreen />);
    expect(screen.getByText(strings.profile.points.total(70))).toBeTruthy();
  });

  it("renders zero points honestly for a brand-new profile", () => {
    const screen = render(<ProgressScreen />);
    expect(screen.getByText(strings.profile.points.total(0))).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts (plus library data)", () => {
    useProfileStore.setState({ profile: tier4Profile() });
    useLedgerStore.setState({
      events: [{ type: "session", points: 20, date: "2026-08-31" }],
    });

    const allowed = collectStringValues(strings);
    // Parameterised strings.ts values, explicitly enumerated.
    for (let tier = 1; tier <= MAX_TIER; tier += 1) {
      allowed.add(strings.profile.tier(tier, MAX_TIER));
    }
    allowed.add(strings.profile.points.total(20));
    // Library-sourced movement names are data, like the player's.
    for (const movement of library!.movements) {
      allowed.add(movement.name);
    }
    // Decorative glyph token (hidden from accessibility), not copy —
    // same standing as RowButton's selection check.
    allowed.add(glyph.check);

    const screen = render(<ProgressScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
