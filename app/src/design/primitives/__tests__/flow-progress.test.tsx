import { render } from "@testing-library/react-native";
import React from "react";

import { FlowProgress } from "../flow-progress";

// The one question a time-poor user has on entering a flow is "how long
// is this?". Four segments answer it in no words and no taps.

const hidden = { includeHiddenElements: true } as const;

function filledCount(
  screen: ReturnType<typeof render>,
  total: number,
): number {
  let count = 0;
  for (let step = 1; step <= total; step += 1) {
    if (screen.queryByTestId(`flow-filled-${step}`, hidden) !== null) {
      count += 1;
    }
  }
  return count;
}

it("fills through the step she is on — she is here, not past it", () => {
  const screen = render(
    <FlowProgress total={4} current={1} reduceMotion testID="flow" />,
  );
  expect(filledCount(screen, 4)).toBe(1);

  screen.rerender(
    <FlowProgress total={4} current={3} reduceMotion testID="flow" />,
  );
  expect(filledCount(screen, 4)).toBe(3);
});

it("carries the platform's own progress semantics, not invented copy", () => {
  const screen = render(
    <FlowProgress total={4} current={2} reduceMotion testID="flow" />,
  );
  const bar = screen.getByTestId("flow");
  expect(bar.props.accessibilityRole).toBe("progressbar");
  expect(bar.props.accessibilityValue).toEqual({ min: 1, max: 4, now: 2 });
  // No text of its own — nothing here needs the copy-writer.
  expect(screen.queryByText(/./)).toBeNull();
});

it("draws exactly as many segments as the flow has steps", () => {
  const screen = render(
    <FlowProgress total={3} current={3} reduceMotion testID="flow" />,
  );
  expect(screen.getByTestId("flow").children).toHaveLength(1);
  expect(filledCount(screen, 3)).toBe(3);
  expect(screen.queryByTestId("flow-filled-4", hidden)).toBeNull();
});
