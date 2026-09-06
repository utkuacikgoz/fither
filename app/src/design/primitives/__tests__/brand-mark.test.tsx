import { render } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";

import { darkColors } from "../../tokens";
import { BrandMark } from "../brand-mark";

// The drawn mark, as the app renders it: one white asset, tinted to the
// theme's accent — the movement figures' own mechanism.

const hidden = { includeHiddenElements: true } as const;

it("tints the one asset to the accent rather than shipping a colour per theme", () => {
  const screen = render(<BrandMark testID="mark" />);
  const image = screen.getByTestId("mark", hidden).findByType(Image);
  const style = Object.assign({}, ...[image.props.style].flat());
  expect(style.tintColor).toBe(darkColors.accent);
});

it("is decorative — the headline beside it carries the brand words", () => {
  const screen = render(<BrandMark testID="mark" />);
  const frame = screen.getByTestId("mark", hidden);
  expect(frame.props.accessibilityElementsHidden).toBe(true);
  expect(frame.props.importantForAccessibility).toBe("no-hide-descendants");
});
