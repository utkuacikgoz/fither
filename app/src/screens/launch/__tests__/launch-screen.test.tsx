import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { todayIso } from "../../../lib/dates";
import { firstMovementTracker } from "../../../lib/first-movement-timer";
import { createPlayer, reduce } from "../../../session/player-machine";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useIdentityStore } from "../../../state/identity-store";
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
    onHome: jest.fn(),
    onPromptHandoff: jest.fn(),
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
  // onboardingCompleted keeps the pre-existing suites on the returning-user
  // path; the onboarding/paywall gating suite covers the fresh-install one.
  useSettingsStore.setState({
    hydrated: true,
    hydrationFailed: false,
    onboardingCompleted: true,
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
  // This suite exercises the surface past sign-in (launch-gating owns
  // the sign-in placement), so an identity is always present here.
  useIdentityStore.setState({
    identity: { kind: "guest", date: "2026-08-01" },
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
  firstMovementTracker.reset(); // each test is its own app launch
});

describe("LaunchScreen", () => {
  it("hands off to the hub when nothing is persisted", () => {
    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);
    // The launch surface renders no day content of its own now
    // (ADR-0013 §4): it gates, then hands the day to /home.
    expect(cbs.onHome).toHaveBeenCalledTimes(1);
    expect(cbs.onPromptHandoff).not.toHaveBeenCalled();
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

  it("silently discards a previous day's session and hands off to the hub", () => {
    seedSnapshot("2000-01-01");
    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);

    expect(cbs.onHome).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(strings.resume.headline)).toBeNull();
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
    expect(cbs.onResumeSession).not.toHaveBeenCalled();
    expect(cbs.onResumeFinished).not.toHaveBeenCalled();
  });

  // Gate 3 t0/first-run stamping. Observed through the tracker's public
  // capture API with injected clocks — the only real clock in play is the
  // launch screen's own Date.now at mount, which lands in t0.
  it("marks t0 at first mount and stamps a returning launch as not-first-run", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_000);
    render(<LaunchScreen {...callbacks()} />); // onboardingCompleted: true
    jest.restoreAllMocks();

    const run = firstMovementTracker.captureWorkEntry("work", () => 43_500);
    expect(run).toEqual({ t0: 1_000, t1: 43_500, deltaMs: 42_500, firstRun: false });
  });

  it("stamps a true first run when onboarding has never completed", () => {
    useSettingsStore.setState({ onboardingCompleted: false });
    jest.spyOn(Date, "now").mockReturnValue(2_000);
    const screen = render(<LaunchScreen {...callbacks()} />);
    jest.restoreAllMocks();

    // The launch surface routed to onboarding — the measured window
    // includes it, because a first-run user must cross it to move.
    expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy();
    const run = firstMovementTracker.captureWorkEntry("work", () => 60_000);
    expect(run).toEqual({ t0: 2_000, t1: 60_000, deltaMs: 58_000, firstRun: true });
  });

  it("an install that trained before the onboarding flag is not a first run", () => {
    useSettingsStore.setState({ onboardingCompleted: false });
    useProfileStore.setState({
      history: {
        entries: [{ date: "2026-08-01", minutes: 10, blocks: [] }],
      },
    });
    render(<LaunchScreen {...callbacks()} />);
    const run = firstMovementTracker.captureWorkEntry("work", () => 60_000);
    expect(run?.firstRun).toBe(false);
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
