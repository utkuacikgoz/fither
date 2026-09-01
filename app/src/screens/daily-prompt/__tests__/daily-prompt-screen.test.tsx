import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { createSession } from "../../../session/create-session";
import { useSessionStore } from "../../../state/session-store";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";
import {
  fixturePlayerBlocks,
  fixtureSession,
} from "../../../test-utils/fixtures";
import {
  DEV_TIMING_TITLE,
} from "../../dev-timing/first-movement-readout";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useFirstMovementStore } from "../../../state/first-movement-store";
import { DailyPromptScreen } from "../daily-prompt-screen";

jest.mock("../../../session/create-session", () => ({ createSession: jest.fn() }));
const mockedCreate = jest.mocked(createSession);

beforeEach(() => {
  useLedgerStore.setState({ hydrated: true, hydrationFailed: false });
  useProfileStore.setState({ hydrated: true, hydrationFailed: false });
  useSettingsStore.setState({
    hydrated: true,
    hydrationFailed: false,
    alwaysAvoid: [],
  });
  useActiveSessionStore.setState({
    snapshot: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useCareNoteStore.setState({
    entries: [],
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.getState().resetSession();
  mockedCreate.mockReturnValue({
    ok: true,
    value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks },
  });
});

describe("DailyPromptScreen", () => {
  it("asks the four decided questions, one at a time", () => {
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();

    fireEvent.press(screen.getByTestId("time-10"));
    expect(screen.getByText(strings.prompt.energy.question)).toBeTruthy();

    fireEvent.press(screen.getByTestId("energy-low"));
    expect(screen.getByText(strings.prompt.quiet.question)).toBeTruthy();

    fireEvent.press(screen.getByTestId("quiet-yes"));
    expect(screen.getByText(strings.prompt.soreness.question)).toBeTruthy();
  });

  it("completes in four taps with the one-tap 'All good' default", () => {
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(onSessionReady).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        minutes: 10,
        energy: "low",
        quiet: true,
        avoid: [],
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        equipment: expect.arrayContaining(["none"]),
      }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
    expect(useSessionStore.getState().session).toEqual(fixtureSession);
  });

  it("passes picked sore areas through to the prompt", () => {
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-20"));
    fireEvent.press(screen.getByTestId("energy-strong"));
    fireEvent.press(screen.getByTestId("quiet-no"));
    fireEvent.press(screen.getByTestId("soreness-wrists"));
    fireEvent.press(screen.getByTestId("soreness-knees"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));

    expect(onSessionReady).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        minutes: 20,
        energy: "strong",
        quiet: false,
        avoid: ["wrists", "knees"],
      }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
  });

  it("shows a calm error and can start over when generation is unavailable", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noLibrary" });
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(onSessionReady).not.toHaveBeenCalled();
    expect(screen.getByText(strings.errors.sessionUnavailable)).toBeTruthy();

    fireEvent.press(screen.getByTestId("prompt-try-again"));
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
  });

  it("keeps an impossible set of answers out of the player flow", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(onSessionReady).not.toHaveBeenCalled();
    expect(screen.getByText(strings.errors.noSession)).toBeTruthy();
    expect(screen.getByTestId("prompt-adjust-answers")).toBeTruthy();
  });

  it("merges the persistent avoid-list into every prompt, even on 'All good'", () => {
    useSettingsStore.setState({ alwaysAvoid: ["knees"] });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ avoid: ["knees"] }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
  });

  it("deduplicates persistent and daily picks into one avoid list", () => {
    useSettingsStore.setState({ alwaysAvoid: ["knees", "back"] });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-knees"));
    fireEvent.press(screen.getByTestId("soreness-wrists"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));

    expect(mockedCreate).toHaveBeenCalledWith(
      // Stable presentation order, each area once.
      expect.objectContaining({ avoid: ["wrists", "back", "knees"] }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
  });

  it("shows selection affordances on soreness picks: checkmark and live count", () => {
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-no"));

    // Nothing selected yet: no checks, no count cue.
    expect(screen.queryByTestId("soreness-wrists-check")).toBeNull();
    expect(screen.queryByTestId("soreness-count")).toBeNull();

    fireEvent.press(screen.getByTestId("soreness-wrists"));
    expect(screen.getByTestId("soreness-wrists-check")).toBeTruthy();
    expect(screen.getByText(strings.prompt.soreness.areasNoted(1))).toBeTruthy();

    fireEvent.press(screen.getByTestId("soreness-knees"));
    expect(screen.getByTestId("soreness-knees-check")).toBeTruthy();
    expect(screen.getByText(strings.prompt.soreness.areasNoted(2))).toBeTruthy();

    // Deselecting removes the check and updates the count.
    fireEvent.press(screen.getByTestId("soreness-knees"));
    expect(screen.queryByTestId("soreness-knees-check")).toBeNull();
    expect(screen.getByText(strings.prompt.soreness.areasNoted(1))).toBeTruthy();
  });

  it("leads the can't-build state with care when sore areas caused it", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-back"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));

    // The acknowledgment leads; the plain line and the way out stay.
    expect(screen.getByTestId("care-acknowledgment")).toBeTruthy();
    expect(screen.getByText(strings.care.acknowledgment)).toBeTruthy();
    expect(screen.getByText(strings.errors.noSession)).toBeTruthy();
    expect(screen.getByText(strings.care.notePrompt)).toBeTruthy();
    expect(screen.getByText(strings.care.notePrivacy)).toBeTruthy();
    expect(screen.getByTestId("prompt-adjust-answers")).toBeTruthy();
  });

  it("keeps the plain can't-build state when no body areas were involved", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(screen.getByText(strings.errors.noSession)).toBeTruthy();
    expect(screen.queryByTestId("care-acknowledgment")).toBeNull();
    expect(screen.queryByTestId("care-note")).toBeNull();
  });

  it("saves an optional note to the local store when she writes one, skippable otherwise", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-back"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));

    fireEvent.changeText(screen.getByTestId("care-note"), "  long day  ");
    fireEvent.press(screen.getByTestId("prompt-adjust-answers"));

    expect(useCareNoteStore.getState().entries).toEqual([
      {
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as unknown as string,
        text: "long day",
      },
    ]);
    // And she is back at the start, with the moment behind her.
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();

    // Leaving the field empty saves nothing — completely skippable.
    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-back"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));
    fireEvent.press(screen.getByTestId("prompt-adjust-answers"));
    expect(useCareNoteStore.getState().entries).toHaveLength(1);
  });

  it("dev-only timing readout: long-press entry, prompt state survives", () => {
    // Jest runs with __DEV__ true, so the invisible long-press target on
    // the day label is rendered here — in release it does not exist.
    useFirstMovementStore.setState({
      runs: [],
      hydrated: true,
      hydrationFailed: false,
    });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    // A plain tap does nothing — only a long-press opens the readout.
    fireEvent.press(screen.getByTestId("dev-timing-entry"));
    expect(screen.queryByText(DEV_TIMING_TITLE)).toBeNull();

    // Answer one question first: the overlay must not lose her place.
    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent(screen.getByTestId("dev-timing-entry"), "longPress");
    expect(screen.getByText(DEV_TIMING_TITLE)).toBeTruthy();
    expect(screen.queryByText(strings.prompt.energy.question)).toBeNull();

    fireEvent.press(screen.getByTestId("dev-timing-close"));
    expect(screen.queryByText(DEV_TIMING_TITLE)).toBeNull();
    expect(screen.getByText(strings.prompt.energy.question)).toBeTruthy();
  });

  it("shows the onboarding handoff atop the first question only", () => {
    const screen = render(
      <DailyPromptScreen onSessionReady={jest.fn()} showHandoff />,
    );
    expect(screen.getByText(strings.onboarding.handoff.eyebrow)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.handoff.line)).toBeTruthy();
    expect(screen.queryByText(strings.prompt.dayLabel)).toBeNull();

    fireEvent.press(screen.getByTestId("time-10"));
    expect(screen.queryByText(strings.onboarding.handoff.eyebrow)).toBeNull();
    expect(screen.queryByText(strings.onboarding.handoff.line)).toBeNull();
    expect(screen.getByText(strings.prompt.dayLabel)).toBeTruthy();
  });
});
