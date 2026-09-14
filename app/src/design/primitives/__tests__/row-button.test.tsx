import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { clearRecordedHaptics, recordedHaptics } from "../../../test-utils/haptics";
import { RowButton } from "../row-button";

// The daily-prompt answer unit. An answer is a choice she made; the
// phone registers it before the screen moves on (ADR-0030).

it("an answer is felt: one selection tap, then the handler", () => {
  clearRecordedHaptics();
  const onPress = jest.fn();
  const screen = render(<RowButton label="20 minutes" onPress={onPress} testID="time-20" />);
  fireEvent.press(screen.getByTestId("time-20"));
  expect(recordedHaptics()).toEqual(["tap"]);
  expect(onPress).toHaveBeenCalledTimes(1);
});
