import { act, fireEvent, render, within } from "@testing-library/react-native";
import React from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { strings } from "../../../copy/strings";
import {
  countFloorMaxFontScale,
  darkColors,
  fontFamily,
  motion,
  radius,
  spacing,
  tracking,
  typeScale,
} from "../../../design/tokens";
import { createPlayer } from "../../../session/player-machine";
import { useSessionStore } from "../../../state/session-store";
import {
  fixturePlayerBlocks,
  fixtureSession,
} from "../../../test-utils/fixtures";
import {
  SessionPlayerScreen,
  SKIP_ARM_TIMEOUT_MS,
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

/**
 * Skip the current block from its intro: the quiet exit is a two-tap
 * control in place (owner decision 2026-09-12), so the skip is one tap to
 * arm and one to go.
 */
function skipCurrentBlockFromIntro(screen: ReturnType<typeof render>) {
  revealIntroSkip();
  fireEvent.press(screen.getByTestId("player-skip"));
  fireEvent.press(screen.getByTestId("player-skip"));
}

/**
 * The rest has no controls at all (owner decision 2026-09-12): it counts
 * itself out and starts the next set. The fixture's rest is 30 seconds.
 */
function waitOutRest(seconds = 30) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000);
  });
}

/** Let the toast finish leaving, so no animation outlives the test. */
function settleToast() {
  act(() => {
    jest.advanceTimersByTime(motion.fadeMs + motion.toastMs + motion.fadeMs + 50);
  });
}

/** The resolved style of a rendered element, as the phone would see it. */
function flatStyle(element: { props: { style?: unknown } }): TextStyle & ViewStyle {
  return (StyleSheet.flatten(element.props.style as StyleProp<TextStyle & ViewStyle>) ??
    {}) as TextStyle & ViewStyle;
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
      expect(speakCue).toHaveBeenCalledWith("Elbows back, not out.");
      // Reps-based: no ticks run here; the per-tick claim is proved on
      // the timed block below, where ticks re-render under the same key.
      expect(speakCue).toHaveBeenCalledTimes(1);
      // The next set shows (and speaks) the next cue. The rest runs itself
      // out: one batched stretch, so its spoken countdown never renders.
      fireEvent.press(screen.getByTestId("player-set-done"));
      waitOutRest();
      expect(speakCue).toHaveBeenCalledTimes(2);
      expect(speakCue).toHaveBeenLastCalledWith("Hips level with your shoulders.");
    });

    it("a timed set ticks every second and speaks exactly once", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      // Through the reps block to the timed one (fixture block 2).
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-set-done"));
      waitOutRest();
      fireEvent.press(screen.getByTestId("player-set-done"));
      fireEvent.press(screen.getByTestId("feedback-good"));
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(speakCue).toHaveBeenCalledTimes(3);
      expect(speakCue).toHaveBeenLastCalledWith("Ribs down, keep breathing.");
      act(() => {
        jest.advanceTimersByTime(5000); // five ticks, same machine key
      });
      expect(speakCue).toHaveBeenCalledTimes(3);
    });

    it("counts down the last five seconds of a hold and of a rest, once per second", () => {
      useSessionStore.setState({ player: createPlayer([fixturePlayerBlocks[1]!]) });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(speakCue).toHaveBeenCalledTimes(1); // the in-set cue
      act(() => {
        jest.advanceTimersByTime(14000);
      });
      expect(speakCue).toHaveBeenCalledTimes(1); // 6 left: nothing yet
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(speakCue).toHaveBeenLastCalledWith(strings.player.countdown(5));
      // One second per render, as on the phone: each tick commits its own
      // second, so each line is spoken (a single act over four ticks would
      // batch them into one render and one line).
      for (let second = 0; second < 4; second += 1) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }
      expect(speakCue).toHaveBeenCalledTimes(6);
      expect(speakCue).toHaveBeenLastCalledWith(strings.player.countdown(1));
    });

    it("counts down the last five seconds of a rest the same way", () => {
      // Fixture block 0: reps, then 30 seconds of rest.
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-set-done"));
      expect(speakCue).toHaveBeenCalledTimes(1); // the in-set cue only
      act(() => {
        jest.advanceTimersByTime(24000);
      });
      expect(speakCue).toHaveBeenCalledTimes(1); // 6 left: nothing yet
      for (let second = 0; second < 5; second += 1) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }
      expect(speakCue).toHaveBeenCalledTimes(6);
      expect(speakCue).toHaveBeenNthCalledWith(2, strings.player.countdown(5));
      expect(speakCue).toHaveBeenLastCalledWith(strings.player.countdown(1));
    });

    it("with the voice off, the countdown is silent too", () => {
      useSettingsStore.setState({ voice: false });
      useSessionStore.setState({ player: createPlayer([fixturePlayerBlocks[1]!]) });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      act(() => {
        jest.advanceTimersByTime(19000);
      });
      expect(speakCue).not.toHaveBeenCalled();
    });

    it("skipping a block stops the voice so it cannot talk over the next intro", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-skip")); // arms
      expect(stopVoice).not.toHaveBeenCalled(); // arming is not a skip
      fireEvent.press(screen.getByTestId("player-skip")); // skips
      expect(stopVoice).toHaveBeenCalled();
      settleToast();
    });

    it("speaks on a quiet day too: quiet movements and the voice are separate", () => {
      // Owner brief 2026-09-07, wave 4. The quiet answer shapes which
      // movements the engine picks; the voice setting alone decides
      // whether her coach speaks. No headphone check, nothing platform-
      // specific: she turned the voice on, she hears it.
      useSessionStore.setState({
        prompt: { minutes: 10, energy: "okay", quiet: true, avoid: [], date: "2026-09-04", equipment: ["none", "chair", "wall"] },
      });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(speakCue).toHaveBeenCalledTimes(1);
      expect(speakCue).toHaveBeenCalledWith("Elbows back, not out.");
    });

    it("a quiet day with the voice off is silent — the setting, not the day, decides", () => {
      useSettingsStore.setState({ voice: false });
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
    // The work set shows the in-set correction, not the intro's setup cue.
    expect(screen.getByText("Elbows back, not out.")).toBeTruthy();
    expect(screen.queryByText("Push through your palms.")).toBeNull();
    expect(screen.getByText(strings.player.setCounter(1, 2))).toBeTruthy();
    expect(screen.getByTestId("player-set-done")).toBeTruthy();
  });

  describe("the work phase at floor distance (owner-approved 2026-09-07, mockup player-work-floor)", () => {
    const flat = (element: { props: { style?: unknown } }) =>
      StyleSheet.flatten(element.props.style as StyleProp<TextStyle>) ?? {};

    it("sets the count on its own floor scale, tighter and semibold, capped for Dynamic Type", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      const numeral = screen.getByTestId("player-numeral");
      expect(flat(numeral)).toMatchObject({
        fontSize: typeScale.countFloor,
        fontFamily: fontFamily.semibold,
        letterSpacing: tracking.countFloor,
      });
      expect(typeScale.countFloor).toBe(132);
      expect(numeral.props.maxFontSizeMultiplier).toBe(countFloorMaxFontScale);
    });

    it("the unit at body size in soft ink, the cue at bodyLarge semibold", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(flat(screen.getByTestId("player-unit"))).toMatchObject({
        fontSize: typeScale.body,
        color: darkColors.inkSoft,
      });
      expect(flat(screen.getByText("Elbows back, not out."))).toMatchObject({
        fontSize: typeScale.bodyLarge,
        fontFamily: fontFamily.semibold,
      });
    });

    it("the caption row at body size: the name in ink, the set counter soft", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      fireEvent.press(screen.getByTestId("player-begin"));
      const row = within(screen.getByTestId("player-caption-row"));
      expect(flat(row.getByText("Wall Push-Up"))).toMatchObject({
        fontSize: typeScale.body,
        color: darkColors.ink,
      });
      expect(flat(row.getByText(strings.player.setCounter(1, 2)))).toMatchObject({
        fontSize: typeScale.body,
        color: darkColors.inkSoft,
      });
    });

    it("only the work phase changes: the intro and the rest keep the caption row as captions", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      const row = () => within(screen.getByTestId("player-caption-row"));
      expect(flat(row().getByText("Wall Push-Up"))).toMatchObject({
        fontSize: typeScale.caption,
      });
      fireEvent.press(screen.getByTestId("player-begin"));
      fireEvent.press(screen.getByTestId("player-set-done"));
      expect(screen.getByText(strings.player.rest)).toBeTruthy();
      expect(flat(row().getByText("Wall Push-Up"))).toMatchObject({
        fontSize: typeScale.caption,
      });
      expect(flat(row().getByText(strings.player.setCounter(1, 2)))).toMatchObject({
        fontSize: typeScale.caption,
      });
    });
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
    waitOutRest();
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

  it("the rest asks nothing of her: no buttons, one line, and it starts the next set itself", () => {
    // Owner decision 2026-09-12: the version with neither button. Both
    // were offering what was about to happen anyway.
    const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
    fireEvent.press(screen.getByTestId("player-begin"));
    fireEvent.press(screen.getByTestId("player-set-done"));

    expect(screen.getByText(strings.player.rest)).toBeTruthy();
    expect(screen.queryByTestId("player-end-rest")).toBeNull();
    expect(screen.queryByText(strings.player.restDone)).toBeNull();
    expect(screen.queryByTestId("player-skip")).toBeNull();
    expect(screen.queryByText(strings.player.skipBlock)).toBeNull();

    // One soft line where the buttons were — a statement, not a control.
    const line = screen.getByTestId("player-rest-auto");
    expect(line).toHaveTextContent(strings.player.restAutoStart);
    expect(line.props.accessibilityRole).toBeUndefined();
    expect(flatStyle(line)).toMatchObject({ color: darkColors.inkSoft });

    waitOutRest();
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
      waitOutRest();
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

  describe("the quiet exit: two taps, in place (owner decision 2026-09-12)", () => {
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

    it("one tap arms it: the label changes and nothing else does", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      expect(screen.getByText(strings.player.skipBlock)).toBeTruthy();

      fireEvent.press(screen.getByTestId("player-skip"));

      // The label IS the warning she gets — and, with no accessibilityLabel
      // over it, it is the button's accessibility name in both states.
      expect(screen.getByText(strings.player.skipBlockArmed)).toBeTruthy();
      expect(screen.queryByText(strings.player.skipBlock)).toBeNull();
      // Still her intro: nothing recorded, nothing on top of the session,
      // no line claiming anything happened.
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
      expect(screen.getByTestId("player-begin")).toBeTruthy();
      expect(screen.getAllByText("Wall Push-Up")[0]).toBeTruthy();
      expect(screen.queryByTestId("player-toast")).toBeNull();
    });

    it("a single tap alone never skips, however long she leaves it", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));

      act(() => {
        jest.advanceTimersByTime(SKIP_ARM_TIMEOUT_MS * 2);
      });
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
      expect(screen.queryByTestId("player-toast")).toBeNull();
    });

    it("the second tap skips, records it, and moves on", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));
      fireEvent.press(screen.getByTestId("player-skip"));

      expect(useSessionStore.getState().player?.outcomes).toEqual(["skipped"]);
      expect(screen.getAllByText("Plank")[0]).toBeTruthy();
      settleToast();
    });

    it("disarms itself when the second tap never comes", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));

      act(() => {
        jest.advanceTimersByTime(SKIP_ARM_TIMEOUT_MS - 500);
      });
      expect(screen.getByText(strings.player.skipBlockArmed)).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(screen.getByText(strings.player.skipBlock)).toBeTruthy();

      // The next tap is a first tap again: it arms, it does not skip.
      fireEvent.press(screen.getByTestId("player-skip"));
      expect(screen.getByText(strings.player.skipBlockArmed)).toBeTruthy();
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
    });

    it("disarms the moment the phase changes underneath it", () => {
      // An armed exit must never carry into the work she just started: a
      // tap meant for the intro cannot skip the set she is now in.
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip"));
      expect(screen.getByText(strings.player.skipBlockArmed)).toBeTruthy();

      fireEvent.press(screen.getByTestId("player-begin")); // intro -> work
      expect(screen.getByTestId("player-set-done")).toBeTruthy();
      expect(screen.getByText(strings.player.skipBlock)).toBeTruthy();

      fireEvent.press(screen.getByTestId("player-skip"));
      expect(screen.getByText(strings.player.skipBlockArmed)).toBeTruthy();
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
    });

    it("disarms across a hand-off too, and a tick never disarms it", () => {
      // The intro counts itself down (INTRO_SECONDS = 15) and hands off to
      // the work. Ticks keep the machine position, so the armed button
      // survives them; the hand-off changes the position, so it does not.
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip(); // three ticks gone: twelve left
      fireEvent.press(screen.getByTestId("player-skip"));
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByText(strings.player.skipBlockArmed)).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(9000); // the hand-off starts the work
      });
      expect(screen.getByTestId("player-set-done")).toBeTruthy();
      expect(screen.getByText(strings.player.skipBlock)).toBeTruthy();
      expect(useSessionStore.getState().player?.outcomes).toEqual([]);
    });

    it("the armed state reads as changed at a glance: accent fill, accent label", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      revealIntroSkip();
      expect(flatStyle(screen.getByTestId("player-skip")).backgroundColor).toBeUndefined();
      expect(flatStyle(screen.getByText(strings.player.skipBlock))).toMatchObject({
        color: darkColors.inkSoft,
      });

      fireEvent.press(screen.getByTestId("player-skip"));

      // The product's existing "chosen" fill and hairline — no new colour.
      expect(flatStyle(screen.getByTestId("player-skip"))).toMatchObject({
        backgroundColor: darkColors.accentSoft,
        borderColor: darkColors.accent,
        borderRadius: radius.pill,
      });
      expect(flatStyle(screen.getByText(strings.player.skipBlockArmed))).toMatchObject({
        color: darkColors.accent,
      });
    });

    it("the quiet exit's copy passes the no-guilt filter", () => {
      const copy = [
        strings.player.skipBlock,
        strings.player.skipBlockArmed,
        strings.player.skipped,
        strings.player.skippedLast,
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

  describe("the one line after a skip (the toast)", () => {
    it("says where she is now, then leaves on its own", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      skipCurrentBlockFromIntro(screen);

      expect(screen.getByText(strings.player.skipped)).toBeTruthy();
      expect(screen.queryByText(strings.player.skippedLast)).toBeNull();

      // Gone well inside the next block's intro (INTRO_SECONDS = 15), so it
      // is never still up when the next exercise starts.
      settleToast();
      expect(screen.queryByTestId("player-toast")).toBeNull();
      expect(screen.getAllByText("Plank")[0]).toBeTruthy();
    });

    it("the last exercise gets its own line: there is no next one", () => {
      // Which line she gets comes from the MACHINE — a skip that leaves it
      // finished was the last block. The view counts nothing.
      useSessionStore.setState({ player: createPlayer([fixturePlayerBlocks[0]!]) });
      const onFinished = jest.fn();
      const screen = render(<SessionPlayerScreen onFinished={onFinished} />);
      skipCurrentBlockFromIntro(screen);

      expect(screen.getByText(strings.player.skippedLast)).toBeTruthy();
      expect(screen.queryByText(strings.player.skipped)).toBeNull();
      expect(useSessionStore.getState().player?.outcomes).toEqual(["skipped"]);
      expect(onFinished).toHaveBeenCalled();
      settleToast();
    });

    it("never covers the bottom controls, and never takes a touch", () => {
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      skipCurrentBlockFromIntro(screen);

      // The layer stops short of the tallest bottom stack (a primary button
      // above the quiet exit), and passes every touch through.
      expect(flatStyle(screen.getByTestId("player-toast-layer")).bottom).toBe(spacing.xxl);
      expect(screen.getByTestId("player-toast-layer").props.pointerEvents).toBe("none");
      expect(screen.getByTestId("player-toast-stage").props.pointerEvents).toBe("none");

      // Begin is hers to press while the line is still up.
      fireEvent.press(screen.getByTestId("player-begin"));
      expect(screen.getByTestId("player-numeral")).toBeTruthy();
      settleToast();
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
      expect(announce).toHaveBeenLastCalledWith("Elbows back, not out.");

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
      waitOutRest(25); // the rest runs itself out from where it stands
      expect(announce).toHaveBeenCalledTimes(4);
      expect(announce).toHaveBeenLastCalledWith("Hips level with your shoulders.");
    });

    it("hold work announces once at start and stays silent through the countdown", () => {
      useSessionStore.setState({
        player: createPlayer([fixturePlayerBlocks[1]!]),
      });
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(1); // intro

      fireEvent.press(screen.getByTestId("player-begin"));
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith("Ribs down, keep breathing.");

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
        `${strings.player.sides.left}. Ribs down, keep breathing.`,
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
        `${strings.player.sides.right}. Ribs down, keep breathing.`,
      );
    });

    it("arming the quiet exit says nothing; the skip announces the next intro once", () => {
      // The deleted confirm screen used to silence announcements while it
      // was open. There is no screen any more — only a control changing
      // state, which is not a machine transition, so the rule that
      // matters is the original one (audit P0 #6): one announcement per
      // POSITION, and arming, disarming and ticking all keep the position.
      const screen = render(<SessionPlayerScreen onFinished={jest.fn()} />);
      expect(announce).toHaveBeenCalledTimes(1); // the first intro

      revealIntroSkip();
      fireEvent.press(screen.getByTestId("player-skip")); // arms
      expect(announce).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(SKIP_ARM_TIMEOUT_MS); // disarms itself
      });
      expect(announce).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByTestId("player-skip"));
      fireEvent.press(screen.getByTestId("player-skip")); // skips
      // The skip moved the machine: the NEXT block's intro, announced once.
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith(
        expect.stringContaining("Plank"),
      );
      settleToast();
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
