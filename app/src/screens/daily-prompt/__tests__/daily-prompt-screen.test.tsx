import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { createSession } from "../../../session/create-session";
import { useSessionStore } from "../../../state/session-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";
import {
  fixturePlayerBlocks,
  fixtureSession,
} from "../../../test-utils/fixtures";
import { DailyPromptScreen } from "../daily-prompt-screen";

jest.mock("../../../session/create-session", () => ({ createSession: jest.fn() }));
const mockedCreate = jest.mocked(createSession);

beforeEach(() => {
  useLedgerStore.setState({ hydrated: true, hydrationFailed: false });
  useProfileStore.setState({ hydrated: true, hydrationFailed: false });
  useSettingsStore.setState({ hydrated: true, hydrationFailed: false });
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
});
