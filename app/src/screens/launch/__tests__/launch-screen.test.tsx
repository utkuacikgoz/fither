import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { todayIso } from "../../../lib/dates";
import { createPlayer, reduce } from "../../../session/player-machine";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useProfileStore } from "../../../state/profile-store";
import { useSessionStore } from "../../../state/session-store";
import { useSettingsStore } from "../../../state/settings-store";
import {
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../../test-utils/fixtures";
import { LaunchScreen } from "../launch-screen";

function callbacks() {
  return {
    onSessionReady: jest.fn(),
    onResumeSession: jest.fn(),
    onResumeFinished: jest.fn(),
  };
}

function seedSnapshot(date: string, player = createPlayer(fixturePlayerBlocks)) {
  useActiveSessionStore.setState({
    snapshot: {
      prompt: { ...fixturePrompt, date },
      session: { ...fixtureSession, date },
      player,
    },
  });
}

beforeEach(() => {
  useLedgerStore.setState({ events: [], hydrated: true, hydrationFailed: false });
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
  useSettingsStore.setState({ hydrated: true, hydrationFailed: false });
  useActiveSessionStore.setState({
    snapshot: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.setState({
    prompt: null,
    session: null,
    player: null,
    finish: null,
    saveFailed: false,
  });
});

describe("LaunchScreen", () => {
  it("opens straight into the daily prompt when nothing is persisted", () => {
    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(screen.queryByText(strings.resume.headline)).toBeNull();
    expect(cbs.onResumeFinished).not.toHaveBeenCalled();
  });

  it("offers the one calm resume decision for today's in-progress session", () => {
    seedSnapshot(
      todayIso(),
      reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }),
    );
    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);

    expect(screen.getByText(strings.resume.headline)).toBeTruthy();
    expect(screen.getByText(strings.resume.line)).toBeTruthy();

    fireEvent.press(screen.getByTestId("resume-continue"));
    expect(cbs.onResumeSession).toHaveBeenCalledTimes(1);
    // The restored player is exactly where she stopped.
    expect(useSessionStore.getState().player?.phase.kind).toBe("work");
  });

  it("'Finish here' applies the captured outcomes — never a discard", () => {
    // Block 0 concluded as completed; interrupted at block 1's intro.
    let player = createPlayer(fixturePlayerBlocks);
    player = reduce(player, { type: "begin" });
    player = reduce(player, { type: "advance" });
    player = reduce(player, { type: "advance" });
    player = reduce(player, { type: "advance" });
    player = reduce(player, { type: "feedback", outcome: "completed" });
    seedSnapshot(todayIso(), player);

    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);
    fireEvent.press(screen.getByTestId("resume-finish-here"));

    expect(cbs.onResumeFinished).toHaveBeenCalledTimes(1);
    const restored = useSessionStore.getState().player;
    expect(restored?.phase).toEqual({ kind: "done" });
    expect(restored?.outcomes).toEqual(["completed", "skipped"]);
    // The finish route's completeSession will apply exactly these.
  });

  it("silently discards a previous day's session and shows the prompt", () => {
    seedSnapshot("2000-01-01");
    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);

    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(screen.queryByText(strings.resume.headline)).toBeNull();
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
    expect(cbs.onResumeSession).not.toHaveBeenCalled();
    expect(cbs.onResumeFinished).not.toHaveBeenCalled();
  });

  it("routes a finished-but-unsaved session straight to the finish screen", () => {
    let player = createPlayer(fixturePlayerBlocks);
    player = reduce(player, { type: "skipBlock" });
    player = reduce(player, { type: "skipBlock" });
    seedSnapshot(todayIso(), player);

    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);

    expect(cbs.onResumeFinished).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(strings.resume.headline)).toBeNull();
    expect(useSessionStore.getState().session?.date).toBe(todayIso());
  });
});
