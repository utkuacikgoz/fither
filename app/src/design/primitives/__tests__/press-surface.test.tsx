import { fireEvent, render } from "@testing-library/react-native";
import { Animated, Text } from "react-native";

import { motion } from "../../tokens";
import { PressSurface } from "../press-surface";
import { PrimaryButton } from "../primary-button";

it("answers a press immediately while native feedback is running", () => {
  const timing = jest.spyOn(Animated, "timing");
  const onPress = jest.fn();
  const screen = render(<PressSurface testID="control" reduceMotion={false} onPress={onPress}><Text>Continue</Text></PressSurface>);
  fireEvent(screen.getByTestId("control"), "pressIn", {});
  fireEvent.press(screen.getByTestId("control"));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: motion.pressInMs, useNativeDriver: true }));
  fireEvent(screen.getByTestId("control"), "pressOut", {});
  expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: motion.pressOutMs, toValue: 0 }));
  screen.unmount();
  timing.mockRestore();
});

it("does not animate a press under Reduce Motion", () => {
  const timing = jest.spyOn(Animated, "timing");
  const onPress = jest.fn();
  const screen = render(<PressSurface testID="control" reduceMotion onPress={onPress}><Text>Continue</Text></PressSurface>);
  fireEvent(screen.getByTestId("control"), "pressIn", {});
  fireEvent.press(screen.getByTestId("control"));
  expect(timing).not.toHaveBeenCalled();
  expect(onPress).toHaveBeenCalledTimes(1);
  timing.mockRestore();
});

it("stops motion when the preference changes during a press", () => {
  const stop = jest.spyOn(Animated.Value.prototype, "stopAnimation");
  const screen = render(<PressSurface testID="control" reduceMotion={false}><Text>Continue</Text></PressSurface>);
  fireEvent(screen.getByTestId("control"), "pressIn", {});
  stop.mockClear();
  screen.rerender(<PressSurface testID="control" reduceMotion><Text>Continue</Text></PressSurface>);
  expect(stop).toHaveBeenCalled();
  stop.mockRestore();
});

it("announces pending checkout and blocks duplicate submissions", () => {
  const onPress = jest.fn();
  const screen = render(<PrimaryButton testID="checkout" label="Opening secure checkout…" busy onPress={onPress} />);
  expect(screen.getByRole("button", { busy: true, disabled: true })).toBeTruthy();
  fireEvent.press(screen.getByTestId("checkout"));
  expect(onPress).not.toHaveBeenCalled();
});
