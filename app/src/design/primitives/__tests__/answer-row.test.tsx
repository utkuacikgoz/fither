import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Pressable, Text } from "react-native";

import { motion } from "../../tokens";
import { AnswerRow } from "../answer-row";

// Rows enter staggered (ADR-0013) but never gate a press: a user who
// knows the flow taps ahead of the fade and still lands.

function entrance(tree: unknown): { opacity: number } {
  return (tree as { props: { style: { opacity: number } } }).props.style;
}

it("staggers by its index inside the shared envelope", () => {
  const first = render(
    <AnswerRow index={0} reduceMotion={false}>
      <Text>a</Text>
    </AnswerRow>,
  );
  expect(entrance(first.toJSON()).opacity).toBe(0);
  // Three rows finish inside one breath: the last starts at 2 × stagger.
  expect(2 * motion.staggerMs + motion.fadeMs).toBeLessThan(500);
});

it("is pressable on its first frame, before the fade lands", () => {
  const onPress = jest.fn();
  const screen = render(
    <AnswerRow index={2} reduceMotion={false}>
      <Pressable testID="row" onPress={onPress}>
        <Text>tap</Text>
      </Pressable>
    </AnswerRow>,
  );
  expect(entrance(screen.toJSON()).opacity).toBe(0);
  fireEvent.press(screen.getByTestId("row"));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("lands in its final state at once under Reduce Motion", () => {
  const screen = render(
    <AnswerRow index={2} reduceMotion>
      <Text>a</Text>
    </AnswerRow>,
  );
  expect(entrance(screen.toJSON()).opacity).toBe(1);
});
