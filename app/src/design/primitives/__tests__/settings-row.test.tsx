import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { darkColors, hairline } from "../../tokens";
import { SETTINGS_ROW_HEIGHT, SettingsRow } from "../settings-row";

// The grouped-list row. Norman: a row that navigates shows it
// (affordance), the value sits on the row it describes (mapping), and a
// plain fact is never dressed as a control.

const hidden = { includeHiddenElements: true } as const;

function flatStyle(node: { props: Record<string, unknown> }): Record<string, unknown> {
  const style = node.props.style as Array<Record<string, unknown> | null | undefined>;
  return Object.assign({}, ...(Array.isArray(style) ? style : [style]).filter(Boolean));
}

it("shows the label, the value at the right and the chevron on a navigating row", () => {
  const screen = render(
    <SettingsRow label="Equipment" value="Floor only" chevron onPress={jest.fn()} testID="row" />,
  );
  expect(screen.getByText("Equipment")).toBeTruthy();
  expect(screen.getByTestId("row-value")).toHaveTextContent("Floor only");
  expect(screen.getByTestId("row-chevron", hidden)).toBeTruthy();
  // The value is the accessible reading of the row's state.
  expect(screen.getByTestId("row").props.accessibilityValue).toEqual({ text: "Floor only" });
  expect(screen.getByTestId("row").props.accessibilityRole).toBe("button");
});

it("an action row carries no chevron and no value", () => {
  const screen = render(<SettingsRow label="Sign out" onPress={jest.fn()} testID="row" />);
  expect(screen.queryByTestId("row-chevron", hidden)).toBeNull();
  expect(screen.queryByTestId("row-value")).toBeNull();
});

it("presses through to its handler", () => {
  const onPress = jest.fn();
  const screen = render(<SettingsRow label="Restore" onPress={onPress} testID="row" />);
  fireEvent.press(screen.getByTestId("row"));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("a fact row (no onPress) is not a button", () => {
  const screen = render(<SettingsRow label="Plan" value="Yearly" testID="row" />);
  expect(screen.getByTestId("row").props.accessibilityRole).toBeUndefined();
  expect(screen.getByTestId("row").props.onPress).toBeUndefined();
  expect(screen.getByTestId("row-value")).toHaveTextContent("Yearly");
});

it("the danger tone colours the label with the danger token only", () => {
  const screen = render(
    <SettingsRow label="Erase" tone="danger" onPress={jest.fn()} testID="row" />,
  );
  expect(flatStyle(screen.getByText("Erase")).color).toBe(darkColors.danger);
  const plain = render(<SettingsRow label="Keep" onPress={jest.fn()} testID="p" />);
  expect(flatStyle(plain.getByText("Keep")).color).toBe(darkColors.ink);
});

it("sits at the 56pt row height and drops the hairline on a group's last row", () => {
  expect(SETTINGS_ROW_HEIGHT).toBe(56);
  const withRule = render(<SettingsRow label="A" onPress={jest.fn()} testID="a" />);
  const noRule = render(<SettingsRow label="B" divider={false} onPress={jest.fn()} testID="b" />);
  expect(flatStyle(withRule.getByTestId("a")).minHeight).toBe(56);
  expect(flatStyle(withRule.getByTestId("a")).borderBottomWidth).toBe(hairline);
  expect(flatStyle(noRule.getByTestId("b")).borderBottomWidth).toBeUndefined();
});
