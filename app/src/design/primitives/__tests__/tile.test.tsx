import { render } from "@testing-library/react-native";
import React from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { motion, spacing } from "../../tokens";
import { Tile } from "../tile";

// The grouped-list tile: Card's skin with the tighter inset the ledger
// asks for once captions move outside. Motion is the default and Reduce
// Motion is honoured absolutely (ADR-0013).

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
    <Tile reduceMotion order={2}>
      <Text>tile</Text>
    </Tile>,
  );
  const style = entranceStyle(screen.toJSON());
  expect(style.opacity).toBe(1);
  expect(style.transform).toEqual([{ translateY: 0 }]);
  expect(screen.getByText("tile")).toBeTruthy();
});

it("otherwise enters from below, staggered by its order", () => {
  const timing = jest.spyOn(Animated, "timing");
  const screen = render(
    <Tile reduceMotion={false} order={3}>
      <Text>tile</Text>
    </Tile>,
  );
  const style = entranceStyle(screen.toJSON());
  expect(style.opacity).toBe(0);
  expect(style.transform).toEqual([{ translateY: motion.riseDistance }]);
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ delay: 3 * motion.staggerMs, duration: motion.fadeMs, toValue: 1 }),
  );
  timing.mockRestore();
});

it("a list tile drops its vertical inset so rows carry their own height", () => {
  const content = render(
    <Tile reduceMotion testID="content">
      <Text>a</Text>
    </Tile>,
  );
  const list = render(
    <Tile reduceMotion inset="list" testID="list">
      <Text>b</Text>
    </Tile>,
  );
  const contentStyle = StyleSheet.flatten(content.getByTestId("content").props.style);
  const listStyle = StyleSheet.flatten(list.getByTestId("list").props.style);
  expect(contentStyle.paddingVertical).toBe(spacing.md);
  expect(listStyle.paddingVertical).toBe(0);
  // One horizontal gap value, shared by both insets.
  expect(listStyle.paddingHorizontal).toBe(contentStyle.paddingHorizontal);
});

it("can be one accessible element with the caller's sentence", () => {
  const screen = render(
    <Tile reduceMotion accessible accessibilityLabel="read as one" testID="stat">
      <Text>3</Text>
    </Tile>,
  );
  const tile = screen.getByTestId("stat");
  expect(tile.props.accessible).toBe(true);
  expect(tile.props.accessibilityLabel).toBe("read as one");
});
