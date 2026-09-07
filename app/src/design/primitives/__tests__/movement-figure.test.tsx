import { render } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";

import { loadLibrary } from "../../../session/load-library";
import {
  movementFigure,
  movementFigureFrames,
} from "../../../session/movement-figures";
import { useReducedMotion } from "../../../lib/use-reduced-motion";
import { MovementFigure } from "../movement-figure";

jest.mock("../../../lib/use-reduced-motion", () => ({
  useReducedMotion: jest.fn(() => false),
}));
const mockedReduceMotion = jest.mocked(useReducedMotion);

beforeEach(() => {
  mockedReduceMotion.mockReturnValue(false);
});

const hidden = { includeHiddenElements: true } as const;

describe("movement figures (ADR-0019)", () => {
  it("every library movement has both keyframes", () => {
    const library = loadLibrary();
    if (!library) throw new Error("bundled movement library missing in test env");
    for (const movement of library.movements) {
      expect(movementFigure(movement.id)).not.toBeNull();
      expect(movementFigureFrames(movement.id)).not.toBeNull();
    }
    expect(movementFigureFrames("no-such-movement")).toBeNull();
  });

  it("stands still by default: one image, frame A", () => {
    const screen = render(<MovementFigure movementId="wall-push-up" testID="fig" />);
    const images = screen.getByTestId("fig", hidden).findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual(movementFigure("wall-push-up"));
  });

  it("breathes between both frames when asked to animate", () => {
    const screen = render(
      <MovementFigure movementId="wall-push-up" animate testID="fig" />,
    );
    const frames = movementFigureFrames("wall-push-up");
    expect(screen.getByTestId("fig-frame-a", hidden).props.source).toEqual(frames?.[0]);
    expect(screen.getByTestId("fig-frame-b", hidden).props.source).toEqual(frames?.[1]);
  });

  it("holds frame A under Reduce Motion: one still image, no loop", () => {
    mockedReduceMotion.mockReturnValue(true);
    const screen = render(
      <MovementFigure movementId="wall-push-up" animate testID="fig" />,
    );
    const images = screen.getByTestId("fig", hidden).findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual(movementFigure("wall-push-up"));
    expect(screen.queryByTestId("fig-frame-b", hidden)).toBeNull();
  });
});
