import { render } from "@testing-library/react-native";
import React from "react";
import { MAX_TIER } from "@fither/engine";

import { motion } from "../../../design/tokens";
import { TierTrack } from "../tier-track";

// The ladder fills as a movement, not a static bar (ADR-0013 §3) — and
// Reduce Motion is honoured absolutely: the final state, never a
// half-played frame.

const hidden = { includeHiddenElements: true } as const;

/**
 * The animated fill's resolved opacity. Animated.View flattens its style
 * to a single object; the array form is handled too so this reads the
 * rendered value either way.
 */
function fillOpacity(node: { props: Record<string, unknown> }): number {
  const style = node.props.style;
  const parts = (Array.isArray(style) ? style : [style]) as Array<
    Record<string, unknown> | null
  >;
  const entry = [...parts]
    .reverse()
    .find((part) => part !== null && typeof part === "object" && "opacity" in part);
  return entry?.opacity as number;
}

it("renders reached steps at full strength immediately under Reduce Motion", () => {
  const screen = render(<TierTrack pattern="push" tier={4} reduceMotion />);
  for (let step = 1; step <= 4; step += 1) {
    expect(
      fillOpacity(screen.getByTestId(`tier-track-push-filled-${step}`, hidden)),
    ).toBe(1);
  }
});

it("otherwise the reached steps draw themselves in, left to right", () => {
  const screen = render(
    <TierTrack pattern="push" tier={4} reduceMotion={false} />,
  );
  for (let step = 1; step <= 4; step += 1) {
    expect(
      fillOpacity(screen.getByTestId(`tier-track-push-filled-${step}`, hidden)),
    ).toBe(0);
  }
  // Six steps complete inside one breath rather than crawling.
  expect(motion.fillStaggerMs * (MAX_TIER - 1) + motion.fadeMs).toBeLessThan(
    1000,
  );
});

it("draws exactly MAX_TIER steps and fills none beyond the current tier", () => {
  const screen = render(<TierTrack pattern="core" tier={1} reduceMotion />);
  expect(screen.getByTestId("tier-track-core", hidden).children).toHaveLength(
    MAX_TIER,
  );
  expect(screen.getByTestId("tier-track-core-filled-1", hidden)).toBeTruthy();
  for (let step = 2; step <= MAX_TIER; step += 1) {
    expect(
      screen.queryByTestId(`tier-track-core-filled-${step}`, hidden),
    ).toBeNull();
  }
});

it("stays out of the accessibility tree — the tier line beside it speaks", () => {
  const screen = render(<TierTrack pattern="pull" tier={2} reduceMotion />);
  const track = screen.getByTestId("tier-track-pull", hidden);
  expect(track.props.accessibilityElementsHidden).toBe(true);
  expect(track.props.importantForAccessibility).toBe("no-hide-descendants");
});
