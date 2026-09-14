import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { glyph } from "../../tokens";
import { clearRecordedHaptics, recordedHaptics } from "../../../test-utils/haptics";
import { OptionRow } from "../option-row";

// The settings unit (ADR-0013). Norman: a preference she set months ago
// must be readable at a glance (signifiers), and a row that acts must
// look different from a row that holds a state (affordance).

const hidden = { includeHiddenElements: true } as const;

it("a selected option shows the check and announces the state", () => {
  const screen = render(
    <OptionRow label="Wrists" selected onPress={jest.fn()} testID="avoid-wrists" />,
  );
  expect(screen.getByTestId("avoid-wrists-check", hidden)).toBeTruthy();
  expect(screen.getByTestId("avoid-wrists").props.accessibilityState).toEqual(
    expect.objectContaining({ selected: true }),
  );
});

it("an unselected option shows no check at all", () => {
  const screen = render(
    <OptionRow label="Wrists" onPress={jest.fn()} testID="avoid-wrists" />,
  );
  expect(screen.queryByTestId("avoid-wrists-check", hidden)).toBeNull();
  expect(screen.getByTestId("avoid-wrists").props.accessibilityState).toEqual(
    expect.objectContaining({ selected: false }),
  );
});

it("the check is decorative — the selected state is the accessible reading", () => {
  const screen = render(
    <OptionRow label="Wrists" selected onPress={jest.fn()} testID="row" />,
  );
  const check = screen.getByTestId("row-check", hidden);
  expect(check.props.children).toBe(glyph.check);
  expect(check.props.accessibilityElementsHidden).toBe(true);
});

it("presses through to its handler", () => {
  const onPress = jest.fn();
  const screen = render(
    <OptionRow label="Restore" onPress={onPress} testID="restore" />,
  );
  fireEvent.press(screen.getByTestId("restore"));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("a group's last row drops its hairline so the card closes cleanly", () => {
  const withRule = render(
    <OptionRow label="A" onPress={jest.fn()} testID="a" />,
  );
  const noRule = render(
    <OptionRow label="B" divider={false} onPress={jest.fn()} testID="b" />,
  );
  const widths = (screen: ReturnType<typeof render>, testID: string) =>
    (screen.getByTestId(testID).props.style as Array<Record<string, unknown>>)
      .filter((entry) => entry && "borderBottomWidth" in entry)
      .map((entry) => entry.borderBottomWidth);
  expect(widths(withRule, "a")).toHaveLength(1);
  expect(widths(noRule, "b")).toHaveLength(0);
});

it("an action row announces no selection state — a verb is not a choice", () => {
  const screen = render(
    <OptionRow label="Restore" emphasis="action" onPress={jest.fn()} testID="act" />,
  );
  // Pressable normalises the state object; what matters is that no
  // selected flag is announced either way.
  expect(screen.getByTestId("act").props.accessibilityState?.selected).toBeUndefined();
});

it("a preference set is felt: one selection tap, then the handler (ADR-0030)", () => {
  clearRecordedHaptics();
  const onPress = jest.fn();
  const screen = render(<OptionRow label="Wrists" onPress={onPress} testID="avoid-wrists" />);
  fireEvent.press(screen.getByTestId("avoid-wrists"));
  expect(recordedHaptics()).toEqual(["tap"]);
  expect(onPress).toHaveBeenCalledTimes(1);
});
