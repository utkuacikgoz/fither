import { act, fireEvent, render, within } from "@testing-library/react-native";
import React from "react";
import { AccessibilityInfo } from "react-native";

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
import { speakCue, stopVoice } from "../../../session/voice";
import { useSettingsStore } from "../../../state/settings-store";

jest.mock("../../../session/voice", () => ({
  speakCue: jest.fn(async () => true),
  stopVoice: jest.fn(),
}));

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
  describe("the spoken voice", () => {
    beforeEach(() => {
      useSettingsStore.setState({ voice: true });
      useSessionStore.setState({
        prompt: { minutes: 10, energy: "okay", quiet: false, avoid: [], date: "2026-09-04", equipment: ["none", "chair", "wall"] },
      });
    });

    it("speaks the cue she is looking at, once per work set, never per tick", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(speakCue).not.toHaveBeenCalled(); // the intro is read, not spoken
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(speakCue).toHaveBeenCalledTimes(1);
      expect(speakCue).toHaveBeenCalledWith("Push through your palms.");
      // Reps-based: no ticks run here; the per-tick claim is proved on
      // the timed block below, where ticks re-render under the same key.
      expect(speakCue).toHaveBeenCalledTimes(1);
      // The next set shows (and speaks) the next cue.
      fireEvent.press(screen.getByTestId("player-set-done"));
      fireEvent.press(screen.getByTestId("player-end-rest"));
      expect(speakCue).toHaveBeenCalledTimes(2);
      expect(speakCue).toHaveBeenLastCalledWith("Keep your body in one line.");
    });

    it("a timed set ticks every second and speaks exactly once", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      // Through the reps block to the timed one (fixture block 2).
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-set-done"));
      fireEvent.press(screen.getByTestId("player-end-rest"));
      fireEvent.press(screen.getByTestId("player-set-done"));
      fireEvent.press(screen.getByTestId("feedback-good"));
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(speakCue).toHaveBeenCalledTimes(3);
      expect(speakCue).toHaveBeenLastCalledWith("Squeeze your glutes.");
      act(() => {
        jest.advanceTimersByTime(5000); // five ticks, same machine key
      });
      expect(speakCue).toHaveBeenCalledTimes(3);
    });

    it("skipping a block stops the voice so it cannot talk over the next intro", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-skip"));
      fireEvent.press(screen.getByTestId("player-skip-confirm"));
      expect(stopVoice).toHaveBeenCalled();
    });

    it("stays silent for the whole session on a day she answered quiet", () => {
      useSessionStore.setState({
        prompt: { minutes: 10, energy: "okay", quiet: true, avoid: [], date: "2026-09-04", equipment: ["none", "chair", "wall"] },
      });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(speakCue).not.toHaveBeenCalled();
    });

    it("stays silent when she has not turned it on — off is the default", () => {
      useSettingsStore.setState({ voice: false });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(speakCue).not.toHaveBeenCalled();
    });
  });

  it("shows the block intro: movement name and plan, one call to action", () => {
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    expect(screen.getAllByText("Wall Push-Up")[0]).toBeTruthy();
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

  it("the rest is the calmest screen: no figure, the count in green, the name kept in the caption", () => {
    // Owner-approved 2026-09-06 (ADR-0017): the rest carries only the
    // word, the count and the exhale line; the movement stays named in
    // the caption row so the exhale is never a blank between screens.
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    fireEvent.press(screen.getByTestId("player-begin"));
    fireEvent.press(screen.getByTestId("player-set-done"));
    expect(screen.getByText(strings.player.rest)).toBeTruthy();
    expect(screen.getByText(strings.player.restNote)).toBeTruthy();
    expect(
      screen.queryByTestId("player-figure-rest", { includeHiddenElements: true }),
    ).toBeNull();
    expect(
      within(screen.getByTestId("player-caption-row")).getByText("Wall Push-Up"),
    ).toBeTruthy();
  });

  it("the feedback rows enter staggered but answer on their first frame", () => {
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    fireEvent.press(screen.getByTestId("player-begin"));
    fireEvent.press(screen.getByTestId("player-set-done"));
    fireEvent.press(screen.getByTestId("player-end-rest"));
    fireEvent.press(screen.getByTestId("player-set-done"));
    expect(screen.getByText(strings.player.feedback.question)).toBeTruthy();
    // No timers advanced: the press lands mid-entrance, as a hand that
    // knows the flow would tap.
    fireEvent.press(screen.getByTestId("feedback-hard"));
    expect(useSessionStore.getState().player?.outcomes).toEqual(["struggled"]);
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
      expect(screen.getAllByText("Plank")[0]).toBeTruthy();
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
      expect(screen.getAllByText("Plank")[0]).toBeTruthy();
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
      expect(screen.getAllByText("Plank")[0]).toBeTruthy();
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
      expect(screen.getAllByText("Plank")[0]).toBeTruthy();
    });

    it("announces nothing while the confirm is open, and never re-announces on Keep going", () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(1); // the first intro

      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));
      expect(announce).toHaveBeenCalledTimes(1); // confirm open: silence

      fireEvent.press(screen.getByTestId("player-skip-keep"));
      expect(announce).toHaveBeenCalledTimes(1); // same intro: no repeat

      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));
      fireEvent.press(screen.getByTestId("player-skip-confirm"));
      // A confirmed skip lands on the NEXT block's intro — one announcement.
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith(
        expect.stringContaining("Plank"),
      );
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

  describe("VoiceOver phase announcements (one per transition, none per tick)", () => {
    let announce: jest.SpyInstance;

    beforeEach(() => {
      announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    });

    it("announces the block intro once — name and prescription — and stays silent on re-render", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        `Wall Push-Up. ${strings.player.blockPlan(2, 8, false, false)}`,
      );

      screen.rerender(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(1);
    });

    it("announces work start with the cue, rest with its seconds — and each exactly once", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith("Push through your palms.");

      fireEvent.press(screen.getByTestId("player-set-done"));
      expect(announce).toHaveBeenCalledTimes(3);
      expect(announce).toHaveBeenLastCalledWith(
        `${strings.player.rest}. 30 ${strings.player.holdLabel}`,
      );

      // Rest ticks: the count moves, VoiceOver stays quiet.
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByText("25")).toBeTruthy();
      expect(announce).toHaveBeenCalledTimes(3);

      // Second set: its own single work announcement, next cue in sequence.
      fireEvent.press(screen.getByTestId("player-end-rest"));
      expect(announce).toHaveBeenCalledTimes(4);
      expect(announce).toHaveBeenLastCalledWith("Keep your body in one line.");
    });

    it("hold work announces once at start and stays silent through the countdown", () => {
      useSessionStore.setState({
        player: createPlayer([fixturePlayerBlocks[1]!]),
      });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(1); // intro

      fireEvent.press(screen.getByTestId("player-begin"));
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith("Squeeze your glutes.");

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByText("15")).toBeTruthy();
      expect(announce).toHaveBeenCalledTimes(2);
    });

    it("announces the side switch instruction, then the second side's cue", () => {
      useSessionStore.setState({
        player: createPlayer([
          { ...fixturePlayerBlocks[1]!, unilateral: true, amount: 5 },
        ]),
      });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(announce).toHaveBeenLastCalledWith(
        `${strings.player.sides.left}. Squeeze your glutes.`,
      );

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(announce).toHaveBeenCalledTimes(3);
      expect(announce).toHaveBeenLastCalledWith(
        `${strings.player.sides.switchTitle}. ${strings.player.sides.switchBody}`,
      );

      fireEvent.press(screen.getByTestId("player-start-right"));
      expect(announce).toHaveBeenCalledTimes(4);
      expect(announce).toHaveBeenLastCalledWith(
        `${strings.player.sides.right}. Breathe steadily.`,
      );
    });

    it("feedback and done are silent here — the finish screen owns the close announcement", () => {
      useSessionStore.setState({
        player: createPlayer([fixturePlayerBlocks[1]!]),
      });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(announce).toHaveBeenCalledTimes(2);

      act(() => {
        jest.advanceTimersByTime(20000);
      });
      // Landed on feedback: no announcement for it.
      expect(screen.getByText(strings.player.feedback.question)).toBeTruthy();
      expect(announce).toHaveBeenCalledTimes(2);

      // Done stays silent in the player: the finish screen announces the
      // HONEST close reason once it is known (a generic "Session
      // complete" here could contradict "Today didn't fit").
      fireEvent.press(screen.getByTestId("feedback-good"));
      expect(announce).toHaveBeenCalledTimes(2);
    });
  });
});
