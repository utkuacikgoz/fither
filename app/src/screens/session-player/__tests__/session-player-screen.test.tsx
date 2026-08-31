import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { createPlayer } from "../../../session/player-machine";
import { useSessionStore } from "../../../state/session-store";
import {
  fixturePlayerBlocks,
  fixtureSession,
} from "../../../test-utils/fixtures";
import { SessionPlayerScreen } from "../session-player-screen";

function seedStore() {
  useSessionStore.setState({
    session: fixtureSession,
    player: createPlayer(fixturePlayerBlocks),
    finish: null,
    saveFailed: false,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  seedStore();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SessionPlayerScreen", () => {
  it("shows the block intro: movement name and plan, one call to action", () => {
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    expect(screen.getByText("Wall Push-Up")).toBeTruthy();
    expect(screen.getByText(strings.player.blockPlan(2, 8, false))).toBeTruthy();
    expect(screen.getByTestId("player-begin")).toBeTruthy();
  });

  it("rep work shows the count, one cue, set counter and a Done button", () => {
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    fireEvent.press(screen.getByTestId("player-begin"));

    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("Push through your palms.")).toBeTruthy();
    expect(screen.getByText(strings.player.setCounter(1, 2))).toBeTruthy();
    expect(screen.getByTestId("player-set-done")).toBeTruthy();
  });

  it("rests between sets, counting down each second", () => {
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    fireEvent.press(screen.getByTestId("player-begin"));
    fireEvent.press(screen.getByTestId("player-set-done"));

    expect(screen.getByText(strings.player.rest)).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText("27")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(27000);
    });
    // Back to work, set 2.
    expect(screen.getByText(strings.player.setCounter(2, 2))).toBeTruthy();
  });

  it("lets her end rest early", () => {
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    fireEvent.press(screen.getByTestId("player-begin"));
    fireEvent.press(screen.getByTestId("player-set-done"));
    fireEvent.press(screen.getByTestId("player-end-rest"));
    expect(screen.getByText(strings.player.setCounter(2, 2))).toBeTruthy();
  });

  it("asks the one calm question after the block and moves on", () => {
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    fireEvent.press(screen.getByTestId("player-begin"));
    fireEvent.press(screen.getByTestId("player-set-done"));
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    fireEvent.press(screen.getByTestId("player-set-done"));

    expect(screen.getByText(strings.player.feedback.question)).toBeTruthy();
    fireEvent.press(screen.getByTestId("feedback-struggled"));

    // Next block intro (the hold block).
    expect(screen.getByText("Plank")).toBeTruthy();
    expect(useSessionStore.getState().player?.outcomes).toEqual(["struggled"]);
  });

  it("hold work counts itself down and finishes the session", () => {
    const onFinished = jest.fn();
    const screen = render(<SessionPlayerScreen onFinished={onFinished} />);

    // Skip the rep block quietly, then run the 20s hold.
    fireEvent.press(screen.getByTestId("player-skip"));
    fireEvent.press(screen.getByTestId("player-begin"));
    expect(screen.getByText("20")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(20000);
    });
    fireEvent.press(screen.getByTestId("feedback-completed"));

    expect(onFinished).toHaveBeenCalled();
    expect(useSessionStore.getState().player?.outcomes).toEqual([
      "skipped",
      "completed",
    ]);
  });
});
