import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { BODY_AREAS } from "../../../lib/body-areas";
import { AreaGrid } from "../area-grid";

describe("AreaGrid", () => {
  it("renders every area from strings.ts and toggles through the callback", () => {
    const onToggle = jest.fn();
    const screen = render(
      <AreaGrid areas={BODY_AREAS} selected={["wrists"]} onToggle={onToggle} testIDPrefix="pick" />,
    );
    for (const area of BODY_AREAS) {
      expect(screen.getByText(strings.prompt.soreness.areas[area])).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId("pick-knees"));
    expect(onToggle).toHaveBeenCalledWith("knees");
  });

  it("tells selection by state and by the check, never by colour alone", () => {
    const screen = render(
      <AreaGrid areas={BODY_AREAS} selected={["wrists"]} onToggle={jest.fn()} testIDPrefix="pick" />,
    );
    const hidden = { includeHiddenElements: true } as const;
    expect(screen.getByTestId("pick-wrists").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId("pick-wrists-check", hidden)).toBeTruthy();
    expect(screen.getByTestId("pick-knees").props.accessibilityState).toEqual({ selected: false });
    expect(screen.queryByTestId("pick-knees-check", hidden)).toBeNull();
  });
});
