import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Animated, Text } from "react-native";

import { motion } from "../../tokens";
import { Card } from "../card";

// Motion is the default now (ADR-0013 §3), and Reduce Motion is honoured
// absolutely: the final state, never a half-played frame.

/** The entrance wrapper's resolved style — the animated values as rendered. */
function entranceStyle(tree: unknown): {
  opacity: number;
  transform: Array<{ translateY: number }>;
} {
  const node = tree as {
    props: {
      style: { opacity: number; transform: Array<{ translateY: number }> };
    };
  };
  return node.props.style;
}

it("renders the final state immediately when Reduce Motion is on", () => {
  const screen = render(
    <Card reduceMotion order={2}>
      <Text>card</Text>
    </Card>,
  );
  const style = entranceStyle(screen.toJSON());
  expect(style.opacity).toBe(1);
  expect(style.transform).toEqual([{ translateY: 0 }]);
  expect(screen.getByText("card")).toBeTruthy();
});

it("otherwise enters from below, faded out, staggered by its order", () => {
  const screen = render(
    <Card reduceMotion={false} order={1}>
      <Text>card</Text>
    </Card>,
  );
  const style = entranceStyle(screen.toJSON());
  expect(style.opacity).toBe(0);
  expect(style.transform).toEqual([{ translateY: motion.riseDistance }]);
  // The rise is small and the envelope stays inside 250–350ms ease-out.
  expect(motion.fadeMs).toBeGreaterThanOrEqual(250);
  expect(motion.fadeMs).toBeLessThanOrEqual(350);
});

it("its order actually reaches the animation as a delay", () => {
  const timing = jest.spyOn(Animated, "timing");
  render(
    <Card reduceMotion={false} order={2}>
      <Text>card</Text>
    </Card>,
  );
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ delay: 2 * motion.staggerMs, duration: motion.fadeMs, toValue: 1 }),
  );
  timing.mockRestore();
});

it("a card that navigates says so; a card that only informs does not", () => {
  const onPress = jest.fn();
  const door = render(
    <Card reduceMotion onPress={onPress} testID="door">
      <Text>door</Text>
    </Card>,
  );
  expect(door.getByTestId("door").props.accessibilityRole).toBe("button");
  fireEvent.press(door.getByTestId("door"));
  expect(onPress).toHaveBeenCalledTimes(1);

  const plain = render(
    <Card reduceMotion testID="plain">
      <Text>plain</Text>
    </Card>,
  );
  expect(plain.getByTestId("plain").props.accessibilityRole).toBeUndefined();
});
