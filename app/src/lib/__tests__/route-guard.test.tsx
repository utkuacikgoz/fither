import { act, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { View } from "react-native";
import { createInitialProfile } from "@fither/engine";

import FinishRoute from "../../../app/finish";
import PreviewRoute from "../../../app/preview";
import ProgressRoute from "../../../app/progress";
import SessionRoute from "../../../app/session";
import SettingsRoute from "../../../app/settings";
import SignInRoute from "../../../app/sign-in";
import UnlockRoute from "../../../app/unlock";
import { useDevAuthSessionStore } from "../../auth/dev-auth";
import { strings } from "../../copy/strings";
import { useDevReceiptStore } from "../../monetization/dev-billing";
import {
  createPlayer,
  finishEarly,
  reduce,
} from "../../session/player-machine";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useIdentityStore } from "../../state/identity-store";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { useSessionStore } from "../../state/session-store";
import { useSettingsStore } from "../../state/settings-store";
import {
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../test-utils/fixtures";
import { RouteGuard } from "../route-guard";

// The corrupted/absent-state route matrix (audit P0 #8): every public
// route cold-opened against empty or invalid stores must land somewhere
// valid — a calm redirect to "/" — never a blank screen, never a
// success claim over nothing. Plus the guard's own contract: wait for
// the hydration set, decide once at entry, honest storage failure.

function Sentinel() {
  return <View testID="guarded-child" />;
}

function seedGeneratedSession() {
  useSessionStore.setState({
    prompt: fixturePrompt,
    sessionId: "test:session",
    session: fixtureSession,
    player: createPlayer(fixturePlayerBlocks),
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
  useSettingsStore.setState({
    hydrated: true,
    hydrationFailed: false,
    onboardingCompleted: true,
    alwaysAvoid: [],
    equipment: ["none", "chair", "wall"],
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
  useDevReceiptStore.setState({
    receipt: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useIdentityStore.setState({
    identity: { kind: "guest", date: "2026-08-01" },
    hydrated: true,
    hydrationFailed: false,
  });
  useDevAuthSessionStore.setState({
    session: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.setState({
    prompt: null,
    sessionId: null,
    session: null,
    player: null,
    countdownEndsAt: null,
    finish: null,
    saveFailed: false,
    saving: false,
  });
});

describe("cold open with empty stores lands on a valid destination", () => {
  it("/preview redirects home instead of an empty plan", async () => {
    const screen = render(<PreviewRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(strings.preview.start)).toBeNull();
    // Never blank while replacing — the calm holding line renders.
    expect(screen.getByText(strings.errors.preparing)).toBeTruthy();
  });

  it("/session redirects home instead of a playerless player", async () => {
    const screen = render(<SessionRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(strings.player.begin)).toBeNull();
  });

  it("/finish redirects home and never claims completion over nothing", async () => {
    const screen = render(<FinishRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(strings.finish.headline)).toBeNull();
    expect(screen.queryByText(strings.finish.savingHeadline)).toBeNull();
  });

  it("/unlock redirects home and never celebrates an empty unlock", async () => {
    const screen = render(<UnlockRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(strings.unlock.heading)).toBeNull();
  });

  it("/progress renders her record — always a valid destination", () => {
    const screen = render(<ProgressRoute />);
    expect(screen.getByText(strings.profile.title)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("/settings renders — always a valid destination", () => {
    const screen = render(<SettingsRoute />);
    expect(screen.getByText(strings.settings.title)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("/sign-in renders — always a valid destination", () => {
    const screen = render(<SignInRoute />);
    expect(screen.getByText(strings.auth.guest)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("hydration gating", () => {
  it("decides nothing until the hydration set settles, then redirects", async () => {
    useSettingsStore.setState({ hydrated: false });
    const screen = render(<FinishRoute />);
    expect(screen.getByText(strings.errors.preparing)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    act(() => {
      useSettingsStore.setState({ hydrated: true });
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("a failed store shows the honest storage state, not a spinner forever", () => {
    useProfileStore.setState({ hydrated: false, hydrationFailed: true });
    const screen = render(<ProgressRoute />);
    expect(screen.getByText(strings.errors.storageUnavailable)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("validity requirements", () => {
  it("generatedSession allows a route once a session exists", () => {
    seedGeneratedSession();
    const screen = render(
      <RouteGuard requires="generatedSession">
        <Sentinel />
      </RouteGuard>,
    );
    expect(screen.getByTestId("guarded-child")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("finishedSession accepts a finished-but-unapplied player", () => {
    seedGeneratedSession();
    useSessionStore.setState({
      player: finishEarly(createPlayer(fixturePlayerBlocks)),
    });
    const screen = render(
      <RouteGuard requires="finishedSession">
        <Sentinel />
      </RouteGuard>,
    );
    expect(screen.getByTestId("guarded-child")).toBeTruthy();
  });

  it("finishedSession accepts an applied summary", () => {
    useSessionStore.setState({ finish: { pointsEarned: 10, unlockedSkills: [] } });
    const screen = render(
      <RouteGuard requires="finishedSession">
        <Sentinel />
      </RouteGuard>,
    );
    expect(screen.getByTestId("guarded-child")).toBeTruthy();
  });

  it("finishedSession rejects a session still in progress", async () => {
    seedGeneratedSession();
    useSessionStore.setState({
      player: reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }),
    });
    const screen = render(
      <RouteGuard requires="finishedSession">
        <Sentinel />
      </RouteGuard>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("guarded-child")).toBeNull();
  });

  it("pendingUnlock requires an actually unlocked skill", async () => {
    useSessionStore.setState({ finish: { pointsEarned: 10, unlockedSkills: [] } });
    const screen = render(
      <RouteGuard requires="pendingUnlock">
        <Sentinel />
      </RouteGuard>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("guarded-child")).toBeNull();
  });

  it("pendingUnlock allows when a skill unlocked this session", () => {
    useSessionStore.setState({
      finish: {
        pointsEarned: 35,
        unlockedSkills: [
          { pattern: "push", tier: 4, movementName: "Full Push-Up" },
        ],
      },
    });
    const screen = render(
      <RouteGuard requires="pendingUnlock">
        <Sentinel />
      </RouteGuard>,
    );
    expect(screen.getByTestId("guarded-child")).toBeTruthy();
  });

  it("decides once at entry — in-flow state changes never eject the screen", () => {
    seedGeneratedSession();
    const screen = render(
      <RouteGuard requires="generatedSession">
        <Sentinel />
      </RouteGuard>,
    );
    expect(screen.getByTestId("guarded-child")).toBeTruthy();
    act(() => {
      useSessionStore.setState({ session: null, player: null });
    });
    expect(screen.getByTestId("guarded-child")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
