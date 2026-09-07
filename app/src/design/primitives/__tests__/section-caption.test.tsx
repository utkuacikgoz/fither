import { render } from "@testing-library/react-native";
import React from "react";

import { darkColors } from "../../tokens";
import { SectionCaption } from "../section-caption";

// The eyebrow outside a tile: caption scale, soft ink, a header for the
// screen reader so the page reads group by group.

it("renders the label as a soft-ink caption header", () => {
  const screen = render(<SectionCaption label="Training" testID="cap" />);
  const node = screen.getByTestId("cap");
  expect(node).toHaveTextContent("Training");
  expect(node.props.accessibilityRole).toBe("header");
  const style = Object.assign(
    {},
    ...(node.props.style as Array<Record<string, unknown>>).filter(Boolean),
  );
  expect(style.color).toBe(darkColors.inkSoft);
});
