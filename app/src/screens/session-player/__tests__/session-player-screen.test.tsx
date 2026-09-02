import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { createPlayer } from "../../../session/player-machine";
import { useSessionStore } from "../../../state/session-store";
import {
  fixturePlayerBlocks,
  fixtureSession,
} from "../../../test-utils/fixtures";
import {
  SessionPlayerScreen,
  SKIP_REVEAL_DELAY_MS,
} from "../session-player-screen";

function seedStore() {
  useSessionStore.setState({
    session: fixtureSession,
    player: createPlayer(fixturePlayerBlocks),
    finish: null,
    saveFailed: false,
  });
}

/** The intro's quiet exit only appears after its reveal delay. */
function revealIntroSkip() {
  act(() => {
    jest.advanceTimersByTime(SKIP_REVEAL_DELAY_MS);
  });
}

/** Skip the current block from its intro, through the calm confirm. */
function skipCurrentBlockFromIntro(screen: ReturnType<typeof render>) {
  revealIntroSkip();
  fireEvent.press(screen.getByTestId("player-skip"));
  fireEvent.press(screen.getByTestId("player-skip-confirm"));
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
    expect(screen.getByText("Push through your palms.")).toBeTruthy();
    expect(screen.getByText("Keep your body in one line.")).toBeTruthy();
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

  it("hold work counts itself down and finishes the session", () => {
    const onFinished = jest.fn();
    const screen = render(<SessionPlayerScreen onFinished={onFinished} />);

    // Skip the rep block quietly, then run the 20s hold.
    skipCurrentBlockFromIntro(screen);
    fireEvent.press(screen.getByTestId("player-begin"));
    expect(screen.getByText("20")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(20000);
    });
    fireEvent.press(screen.getByTestId("feedback-good"));

    expect(onFinished).toHaveBeenCalled();
    expect(useSessionStore.getState().player?.outcomes).toEqual([
      "skipped",
      "completed",
    ]);
  });

  it("guides both sides of a unilateral hold before asking for feedback", () => {
    useSessionStore.setState({
      player: createPlayer([
        { ...fixturePlayerBlocks[1]!, unilateral: true, amount: 5 },
      ]),
    });
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);

    expect(
      screen.getByText(strings.player.blockPlan(1, 5, true, true)),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId("player-begin"));
    expect(screen.getByText(strings.player.sides.left)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByText(strings.player.sides.switchTitle)).toBeTruthy();
    fireEvent.press(screen.getByTestId("player-start-right"));
    expect(screen.getByText(strings.player.sides.right)).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByText(strings.player.feedback.question)).toBeTruthy();
  });

  describe("post-block feedback: three answers, two engine outcomes", () => {
    function reachFeedback(screen: ReturnType<typeof render>) {
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-set-done"));
      fireEvent.press(screen.getByTestId("player-end-rest"));
      fireEvent.press(screen.getByTestId("player-set-done"));
      expect(screen.getByText(strings.player.feedback.question)).toBeTruthy();
    }

    it("offers exactly the three options", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      reachFeedback(screen);
      expect(
        screen.getByText(strings.player.feedback.options.feltStrong),
      ).toBeTruthy();
      expect(screen.getByText(strings.player.feedback.options.good)).toBeTruthy();
      expect(screen.getByText(strings.player.feedback.options.hard)).toBeTruthy();
    });

    it('"Felt strong" records the engine outcome "completed"', () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      reachFeedback(screen);
      fireEvent.press(screen.getByTestId("feedback-felt-strong"));
      expect(useSessionStore.getState().player?.outcomes).toEqual(["completed"]);
    });

    it('"Good" records the engine outcome "completed" too — the affective split is UI-only', () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      reachFeedback(screen);
      fireEvent.press(screen.getByTestId("feedback-good"));
      expect(useSessionStore.getState().player?.outcomes).toEqual(["completed"]);
    });

    it('"That was hard" records the engine outcome "struggled"', () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      reachFeedback(screen);
      fireEvent.press(screen.getByTestId("feedback-hard"));
      expect(useSessionStore.getState().player?.outcomes).toEqual(["struggled"]);
      // Next block intro (the hold block).
      expect(screen.getByText("Plank")).toBeTruthy();
    });
  });

  describe("the quiet exit on block intros", () => {
    it("shows the movement first: no skip until the reveal delay passes", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(screen.queryByTestId("player-skip")).toBeNull();

      act(() => {
        jest.advanceTimersByTime(SKIP_REVEAL_DELAY_MS - 1000);
      });
      expect(screen.queryByTestId("player-skip")).toBeNull();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId("player-skip")).toBeTruthy();
    });

    it("hides the exit again on the next block's intro until its own delay passes", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      skipCurrentBlockFromIntro(screen);

      // Second block intro: the movement gets its 8 seconds too.
      expect(screen.getByText("Plank")).toBeTruthy();
      expect(screen.queryByTestId("player-skip")).toBeNull();
      revealIntroSkip();
      expect(screen.getByTestId("player-skip")).toBeTruthy();
    });

    it("asks one calm confirm; 'Keep going' returns to the intro with nothing recorded", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));

      expect(
        screen.getByText(strings.player.skipConfirm.title("Wall Push-Up")),
      ).toBeTruthy();
      expect(screen.getByText(strings.player.skipConfirm.body)).toBeTruthy();

      fireEvent.press(screen.getByTestId("player-skip-keep"));
      expect(screen.getByTestId("player-begin")).toBeTruthy();
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
    });

    it("'Skip it' records skipped and moves on — and it is never mentioned again", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));
      fireEvent.press(screen.getByTestId("player-skip-confirm"));

      expect(useSessionStore.getState().player?.outcomes).toEqual(["skipped"]);
      expect(screen.getByText("Plank")).toBeTruthy();
      // No trace of the skip on the next intro.
      expect(
        screen.queryByText(strings.player.skipConfirm.title("Wall Push-Up")),
      ).toBeNull();
    });

    it("confirms a skip during work before recording it", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));

      expect(screen.getByTestId("player-skip")).toBeTruthy();
      fireEvent.press(screen.getByTestId("player-skip"));
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
      expect(screen.getByText(strings.player.skipConfirm.body)).toBeTruthy();
      fireEvent.press(screen.getByTestId("player-skip-confirm"));
      expect(useSessionStore.getState().player?.outcomes).toEqual(["skipped"]);
    });

    it("confirms that the rest action skips the exercise, not only the rest", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-set-done"));

      expect(screen.getByText(strings.player.rest)).toBeTruthy();
      fireEvent.press(screen.getByTestId("player-skip"));
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
      expect(
        screen.getByText(strings.player.skipConfirm.title("Wall Push-Up")),
      ).toBeTruthy();
      fireEvent.press(screen.getByTestId("player-skip-confirm"));
      expect(useSessionStore.getState().player?.outcomes).toEqual(["skipped"]);
      expect(screen.getByText("Plank")).toBeTruthy();
    });

    it("skip confirm copy passes the no-guilt filter", () => {
      const copy = [
        strings.player.skipConfirm.title("Wall Push-Up"),
        strings.player.skipConfirm.body,
        strings.player.skipConfirm.keepGoing,
        strings.player.skipConfirm.skipIt,
      ].join(" ");

      // No lectures, no cost framing, no forbidden-list language, no
      // "are you sure" interrogation (fither-voice: no guilt, ever).
      const guiltPatterns = [
        /are you sure/i,
        /\bsure\?/i,
        /\bdon'?t\b/i,
        /\bmiss(ed|ing)?\b/i,
        /\blos(e|t|ing)\b/i,
        /\bprogress\b/i,
        /\bstreak\b/i,
        /\bexcuse/i,
        /\bquit(ting)?\b/i,
        /give up/i,
        /\bshame|guilt/i,
        /\bweight|calorie|burn\b/i,
        /\bcost\b/i,
      ];
      for (const pattern of guiltPatterns) {
        expect(copy).not.toMatch(pattern);
      }
    });
  });
});
