import { render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { ProgressLine } from "../progress-line";

// The session's one piece of chrome fills as a movement now (ADR-0013 §3),
// and Reduce Motion puts it at its value with no sweep.

function fillScale(screen: ReturnType<typeof render>): number {
  const style = screen.getByTestId("line-fill").props.style;
  const flat = Object.assign({}, ...[style].flat());
  return flat.transform[0].scaleX;
}

it("sits at its value at once under Reduce Motion", () => {
  const screen = render(
    <ProgressLine fraction={0.5} reduceMotion testID="line" />,
  );
  expect(fillScale(screen)).toBe(0.5);
});

it("otherwise sweeps in from empty to its value", () => {
  const screen = render(
    <ProgressLine fraction={0.5} reduceMotion={false} testID="line" />,
  );
  expect(fillScale(screen)).toBe(0);
});

it("clamps the fraction and keeps the honest sets-based reading", () => {
  const screen = render(
    <ProgressLine
      fraction={1.7}
      completed={3}
      total={4}
      reduceMotion
      testID="line"
    />,
  );
  expect(fillScale(screen)).toBe(1);
  const bar = screen.getByTestId("line");
  expect(bar.props.accessibilityRole).toBe("progressbar");
  expect(bar.props.accessibilityLabel).toBe(strings.player.sessionProgress);
  expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 3 });
});
