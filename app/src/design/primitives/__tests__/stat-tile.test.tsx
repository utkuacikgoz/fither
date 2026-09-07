import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import { darkColors, numeralMaxFontScale, typeScale } from "../../tokens";
import { StatTile } from "../stat-tile";

// A hero number on a tile: the numeral's face at the display size, soft
// lines beneath, spoken as one sentence.

it("sets the value and every line beneath it", () => {
  const screen = render(
    <StatTile
      value="3"
      lines={["first line", "second line"]}
      reduceMotion
      accessibilityLabel="three, first line, second line"
    />,
  );
  expect(screen.getByText("3")).toBeTruthy();
  expect(screen.getByText("first line")).toBeTruthy();
  expect(screen.getByText("second line")).toBeTruthy();
});

it("is one accessible element carrying the caller's sentence", () => {
  const screen = render(
    <StatTile
      value="85"
      lines={["points"]}
      reduceMotion
      accessibilityLabel="85 points earned"
      testID="stat"
    />,
  );
  const tile = screen.getByTestId("stat");
  expect(tile.props.accessible).toBe(true);
  expect(tile.props.accessibilityLabel).toBe("85 points earned");
});

it("colours the numeral with the green only when the tile leads", () => {
  const lead = render(
    <StatTile value="3" lines={[]} tone="accent" reduceMotion accessibilityLabel="a" testID="lead" />,
  );
  const rest = render(
    <StatTile value="85" lines={[]} reduceMotion accessibilityLabel="b" testID="rest" />,
  );
  expect(StyleSheet.flatten(lead.getByTestId("lead-value").props.style).color).toBe(
    darkColors.accent,
  );
  expect(StyleSheet.flatten(rest.getByTestId("rest-value").props.style).color).toBe(
    darkColors.ink,
  );
});

it("sets the numeral at the display token and keeps its Dynamic Type cap", () => {
  const screen = render(
    <StatTile value="120" lines={[]} reduceMotion accessibilityLabel="c" testID="stat" />,
  );
  const value = screen.getByTestId("stat-value");
  const style = StyleSheet.flatten(value.props.style);
  expect(style.fontSize).toBe(typeScale.display);
  expect(style.fontVariant).toEqual(["tabular-nums"]);
  // Two of these sit side by side: the numeral variant's cap is what
  // keeps a three-digit total on-screen at accessibility sizes.
  expect(value.props.maxFontSizeMultiplier).toBe(numeralMaxFontScale);
});
