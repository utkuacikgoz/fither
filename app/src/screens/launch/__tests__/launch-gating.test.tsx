import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { useDevAuthSessionStore } from "../../../auth/dev-auth";
import { strings } from "../../../copy/strings";
import { todayIso } from "../../../lib/dates";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useIdentityStore } from "../../../state/identity-store";
import { createPlayer, reduce } from "../../../session/player-machine";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
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

// Identity, onboarding + entitlement gating around the launch surface
// (ADR-0009; owner brief 2026-09-07). The resume decision always wins;
// an install with no identity becomes a guest on its own, never a
// sign-in screen; onboarding runs once for a fresh profile; only an
// expired unpurchased trial swaps the prompt for the paywall — and never
// touches history, points or an in-flight session.

function callbacks() {
  return {
    onHome: jest.fn(),
    onPromptHandoff: jest.fn(),
    onResumeSession: jest.fn(),
    onResumeFinished: jest.fn(),
  };
}

/**
 * Render the launch surface with its handoff callbacks reachable: the
 * surface no longer RENDERS the day (ADR-0013 §4), it hands off to the
 * hub, so "she reached her normal day" is now an assertion on onHome.
 */
function renderLaunch() {
  const cbs = callbacks();
  return { ...render(<LaunchScreen {...cbs} />), cbs };
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return todayIso(d);
}

function seedTodaySnapshot() {
  const date = todayIso();
  useActiveSessionStore.setState({
    snapshot: {
      prompt: { ...fixturePrompt, date },
      session: { ...fixtureSession, date },
      player: reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }),
    },
  });
}

function seedHistoryEntry() {
  useProfileStore.setState({
    history: {
      entries: [
        {
          date: "2026-08-01",
          minutes: 10,
          blocks: [
            { movementId: "plank", pattern: "core", outcome: "completed" },
          ],
        },
      ],
    },
  });
}

beforeEach(() => {
  clearRecordedEvents();
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
    onboardingCompleted: false,
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
  useSessionStore.setState({
    prompt: null,
    session: null,
    player: null,
    finish: null,
    saveFailed: false,
  });
  // Most tests exercise gates BEYOND identity, so one is seeded; the
  // guest-by-default suite below clears it per test.
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
});

describe("guest by default (owner brief 2026-09-07)", () => {
  it("a fresh install becomes a guest on its own and lands on onboarding — never a sign-in screen", async () => {
    useIdentityStore.setState({ identity: null });
    const screen = renderLaunch();
    // Nothing is decided while the guest lands: the calm holding line,
    // and no sign-in option anywhere.
    expect(screen.queryByText(strings.auth.guest)).toBeNull();
    expect(screen.queryByText(strings.auth.apple)).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy(),
    );
    expect(useIdentityStore.getState().identity?.kind).toBe("guest");
    expect(screen.queryByText(strings.auth.guest)).toBeNull();
    expect(screen.queryByText(strings.auth.apple)).toBeNull();
    expect(screen.cbs.onHome).not.toHaveBeenCalled();
    // first_use_entry (ADR-0024): once, with nothing attached.
    expect(recordedEvents().filter((e) => e.name === "first_use_entry")).toEqual([
      { name: "first_use_entry", properties: {} },
    ]);
  });

  it("a returning install never reports first_use_entry", async () => {
    clearRecordedEvents();
    useSettingsStore.setState({ onboardingCompleted: true });
    renderLaunch();
    await waitFor(() => expect(useIdentityStore.getState().identity).not.toBeNull());
    expect(recordedEvents().filter((e) => e.name === "first_use_entry")).toEqual([]);
  });

  it("asks for the guest identity exactly once, even across re-renders while it lands", async () => {
    useIdentityStore.setState({ identity: null });
    const { getAuth } = jest.requireActual<typeof import("../../../auth/auth")>("../../../auth/auth");
    const spy = jest.spyOn(getAuth(), "continueAsGuest");
    const screen = renderLaunch();
    screen.rerender(<LaunchScreen {...callbacks()} />);
    screen.rerender(<LaunchScreen {...callbacks()} />);
    await waitFor(() =>
      expect(useIdentityStore.getState().identity?.kind).toBe("guest"),
    );
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("an existing Apple identity is preserved across relaunch — never replaced by a guest", async () => {
    const { getAuth } = jest.requireActual<typeof import("../../../auth/auth")>("../../../auth/auth");
    const spy = jest.spyOn(getAuth(), "continueAsGuest");
    useIdentityStore.setState({
      identity: { kind: "apple", date: "2026-08-01", providerUserId: "apple-user-1" },
    });
    const first = renderLaunch();
    expect(first.getByText(strings.onboarding.welcome.headline)).toBeTruthy();
    first.unmount();

    // Simulated relaunch: the identity is exactly what was persisted.
    const relaunch = renderLaunch();
    expect(relaunch.getByText(strings.onboarding.welcome.headline)).toBeTruthy();
    await waitFor(() => expect(relaunch.getByText(strings.onboarding.welcome.headline)).toBeTruthy());
    expect(useIdentityStore.getState().identity).toEqual({
      kind: "apple",
      date: "2026-08-01",
      providerUserId: "apple-user-1",
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("an existing guest identity is kept as it is, not recreated", async () => {
    const { getAuth } = jest.requireActual<typeof import("../../../auth/auth")>("../../../auth/auth");
    const spy = jest.spyOn(getAuth(), "continueAsGuest");
    renderLaunch();
    await waitFor(() =>
      expect(useIdentityStore.getState().identity).toEqual({ kind: "guest", date: "2026-08-01" }),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("an install that trained before identity existed becomes a guest without losing its history", async () => {
    useIdentityStore.setState({ identity: null });
    useSettingsStore.setState({ onboardingCompleted: true });
    seedHistoryEntry();
    const screen = renderLaunch();
    await waitFor(() => expect(screen.cbs.onHome).toHaveBeenCalledTimes(1));
    expect(useIdentityStore.getState().identity?.kind).toBe("guest");
    expect(useProfileStore.getState().history.entries).toHaveLength(1);
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
    expect(screen.queryByText(strings.onboarding.welcome.headline)).toBeNull();
    expect(screen.queryByText(strings.auth.guest)).toBeNull();
  });

  it("decides nothing until hydration — no guest is created against unhydrated state", async () => {
    useIdentityStore.setState({ identity: null, hydrated: false });
    const { getAuth } = jest.requireActual<typeof import("../../../auth/auth")>("../../../auth/auth");
    const spy = jest.spyOn(getAuth(), "continueAsGuest");
    const screen = renderLaunch();
    expect(screen.getByText(strings.errors.preparing)).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    // Hydration lands with the identity the disk held: an Apple identity
    // is what she keeps.
    act(() => {
      useIdentityStore.setState({
        identity: { kind: "apple", date: "2026-08-01" },
        hydrated: true,
      });
    });
    await waitFor(() =>
      expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy(),
    );
    expect(spy).not.toHaveBeenCalled();
    expect(useIdentityStore.getState().identity?.kind).toBe("apple");
    spy.mockRestore();
  });

  it("the resume decision wins over the guest assignment", async () => {
    useIdentityStore.setState({ identity: null });
    seedTodaySnapshot();
    const screen = renderLaunch();
    expect(screen.getByText(strings.resume.continueLabel)).toBeTruthy();
    expect(screen.queryByText(strings.auth.guest)).toBeNull();
    expect(screen.cbs.onHome).not.toHaveBeenCalled();
    // The guest still lands in the background; the offer stays put.
    await waitFor(() =>
      expect(useIdentityStore.getState().identity?.kind).toBe("guest"),
    );
    expect(screen.getByText(strings.resume.continueLabel)).toBeTruthy();
  });
});

describe("onboarding placement", () => {
  it("a fresh profile opens into onboarding, not the hub — the promise atop the equipment question", () => {
    const screen = renderLaunch();
    expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.equipment.lead)).toBeTruthy();
    expect(screen.cbs.onHome).not.toHaveBeenCalled();
  });

  it("completing onboarding — one tap — goes straight to the questions, handoff and all, once", () => {
    const screen = renderLaunch();
    fireEvent.press(screen.getByTestId("onboarding-chair"));

    // Her first run never spends the hub's extra tap: the four questions
    // come next, carrying the drafted handoff eyebrow (ADR-0013 §5).
    expect(screen.cbs.onPromptHandoff).toHaveBeenCalledTimes(1);
    expect(screen.cbs.onHome).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);

    // Simulated relaunch: a fresh mount skips onboarding AND the handoff.
    screen.unmount();
    const relaunch = renderLaunch();
    expect(relaunch.cbs.onHome).toHaveBeenCalledTimes(1);
    expect(relaunch.cbs.onPromptHandoff).not.toHaveBeenCalled();
    expect(relaunch.queryByText(strings.onboarding.welcome.headline)).toBeNull();
  });

  it("a profile with history is never onboarded, even without the flag", () => {
    seedHistoryEntry();
    const screen = renderLaunch();
    expect(screen.cbs.onHome).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(strings.onboarding.welcome.headline)).toBeNull();
  });

  it("the resume offer wins over onboarding", () => {
    seedTodaySnapshot();
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.resume.headline)).toBeTruthy();
    expect(screen.queryByText(strings.onboarding.welcome.headline)).toBeNull();
  });
});

describe("entitlement gating (ADR-0009 §3)", () => {
  beforeEach(() => {
    useSettingsStore.setState({ onboardingCompleted: true });
    seedHistoryEntry();
  });

  it("the first session is never gated: no entitlement, no completed session, straight to the hub", () => {
    useEntitlementStore.setState({ trialStartDate: null, purchase: null, trialUsed: false });
    const screen = renderLaunch();
    expect(screen.cbs.onHome).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
  });

  it("after the first completed session, without a trial, the day is gated with the free week AHEAD", () => {
    // ADR-0014 §6: the free week is the store's, started from this letter.
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(1), purchase: null, trialUsed: false });
    const screen = renderLaunch();
    expect(screen.getByText(strings.paywall.headline)).toBeTruthy();
    expect(screen.getByText(strings.paywall.cta)).toBeTruthy();
    expect(screen.queryByText(strings.paywall.expired.headline)).toBeNull();
    expect(screen.cbs.onHome).not.toHaveBeenCalled();
  });

  it("a store trial in progress generates sessions as normal", () => {
    useEntitlementStore.setState({
      trialStartDate: isoDaysAgo(6),
      purchase: { plan: "annual", date: isoDaysAgo(5), trial: true },
      trialUsed: true,
    });
    const screen = renderLaunch();
    expect(screen.cbs.onHome).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.headline)).toBeNull();
  });

  it("a lapsed trial swaps new-session generation for the paywall, in its expired voice", () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8), purchase: null, trialUsed: true });
    const screen = renderLaunch();
    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();
    // Never the pre-trial "free week ahead" letter once the week is spent.
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.cta)).toBeNull();
    // And never a handoff to the hub: the gated day IS her day.
    expect(screen.cbs.onHome).not.toHaveBeenCalled();
    // Her record is untouched — gating blocks nothing already earned.
    expect(useProfileStore.getState().history.entries).toHaveLength(1);
  });

  it("the gated day keeps the day's frame and says what stays hers (P0 #7)", () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    const screen = render(<LaunchScreen {...callbacks()} />);
    // The day's frame survives expiry: same label as every other morning,
    // the boundary stated plainly — only new-session generation gates.
    // Progress and Settings are the tab bar's, so no corner pills here
    // (ADR-0017: one way to a place, not two).
    expect(screen.getByText(strings.prompt.dayLabel)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.recordNote)).toBeTruthy();
    expect(screen.queryByTestId("open-progress")).toBeNull();
    expect(screen.queryByTestId("open-settings")).toBeNull();
    // Restore is always available from the gated day (ADR-0009 §3).
    expect(screen.getByTestId("paywall-restore")).toBeTruthy();
  });

  it("restoring a purchase from the gated day opens the hub", async () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    useDevReceiptStore.setState({
      receipt: { plan: "annual", date: isoDaysAgo(10) },
    });
    const screen = renderLaunch();
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() => expect(screen.cbs.onHome).toHaveBeenCalledTimes(1));
  });

  it("an empty restore leaves the gated day standing — frame intact, honest message", async () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    const screen = render(<LaunchScreen {...callbacks()} />);
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() =>
      expect(screen.getByTestId("paywall-restore-empty")).toBeTruthy(),
    );
    expect(screen.getByText(strings.prompt.dayLabel)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.recordNote)).toBeTruthy();
  });

  it("a purchase entitles her even with the trial long expired", () => {
    useEntitlementStore.setState({
      trialStartDate: isoDaysAgo(30),
      purchase: { plan: "annual", date: isoDaysAgo(10) },
    });
    const screen = renderLaunch();
    expect(screen.cbs.onHome).toHaveBeenCalledTimes(1);
  });

  it("the resume offer wins over the paywall — a session in flight is never interrupted", () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    seedTodaySnapshot();
    const cbs = callbacks();
    const screen = render(<LaunchScreen {...cbs} />);
    expect(screen.getByText(strings.resume.headline)).toBeTruthy();
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.headline)).toBeNull();
    fireEvent.press(screen.getByTestId("resume-continue"));
    expect(cbs.onResumeSession).toHaveBeenCalledTimes(1);
  });

  it("buying on the paywall unlocks for real: the prompt appears and the grant persists", async () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    const screen = renderLaunch();
    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();

    fireEvent.press(screen.getByTestId("paywall-purchase"));
    await waitFor(() => expect(screen.cbs.onHome).toHaveBeenCalledTimes(1));
    expect(useEntitlementStore.getState().purchase).toMatchObject({
      plan: "annual",
    });
  });

  it("waits for the entitlement store to hydrate before deciding anything", () => {
    useEntitlementStore.setState({ hydrated: false });
    const screen = renderLaunch();
    expect(screen.getByText(strings.errors.preparing)).toBeTruthy();
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.onboarding.welcome.headline)).toBeNull();
    expect(screen.cbs.onHome).not.toHaveBeenCalled();
  });
});
