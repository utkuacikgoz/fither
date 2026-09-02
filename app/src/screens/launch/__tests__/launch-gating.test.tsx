import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";

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

// Onboarding + entitlement gating around the launch surface (ADR-0009).
// The resume decision always wins; onboarding runs once for a fresh
// profile; only an expired unpurchased trial swaps the prompt for the
// paywall — and never touches history, points or an in-flight session.

function callbacks() {
  return {
    onSessionReady: jest.fn(),
    onResumeSession: jest.fn(),
    onResumeFinished: jest.fn(),
  };
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
  // Most tests exercise gates BEYOND sign-in, so an identity is seeded;
  // the sign-in placement suite below clears it per test.
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

describe("sign-in placement (ADR-0011)", () => {
  it("no identity opens into sign-in, before onboarding", () => {
    useIdentityStore.setState({ identity: null });
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.auth.guest)).toBeTruthy();
    // auth.welcome reuses the tagline that is also onboarding's headline,
    // so onboarding's absence is asserted via its body line.
    expect(screen.queryByText(strings.onboarding.welcome.body)).toBeNull();
    expect(screen.queryByText(strings.prompt.time.question)).toBeNull();
  });

  it("guest is one tap and continues into onboarding, store-driven", async () => {
    useIdentityStore.setState({ identity: null });
    const screen = render(<LaunchScreen {...callbacks()} />);
    fireEvent.press(screen.getByTestId("sign-in-guest"));
    await waitFor(() =>
      expect(screen.getByText(strings.onboarding.welcome.body)).toBeTruthy(),
    );
    expect(useIdentityStore.getState().identity?.kind).toBe("guest");
  });

  it("an existing identity never sees sign-in again", () => {
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.queryByText(strings.auth.guest)).toBeNull();
    expect(screen.getByText(strings.onboarding.welcome.body)).toBeTruthy();
  });

  it("the resume decision wins over sign-in", () => {
    useIdentityStore.setState({ identity: null });
    seedTodaySnapshot();
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.resume.continueLabel)).toBeTruthy();
    expect(screen.queryByText(strings.auth.guest)).toBeNull();
  });
});

describe("onboarding placement", () => {
  it("a fresh profile opens into onboarding, not the prompt", () => {
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy();
    expect(screen.queryByText(strings.prompt.time.question)).toBeNull();
  });

  it("completing onboarding lands on the prompt with the handoff eyebrow, once", () => {
    const screen = render(<LaunchScreen {...callbacks()} />);
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    fireEvent.press(screen.getByTestId("onboarding-chair"));
    fireEvent.press(screen.getByTestId("onboarding-avoid-nothing"));

    // The drafted handoff: eyebrow + one line atop the first question.
    expect(screen.getByText(strings.onboarding.handoff.eyebrow)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.handoff.line)).toBeTruthy();
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);

    // Simulated relaunch: a fresh mount skips onboarding AND the handoff.
    screen.unmount();
    const relaunch = render(<LaunchScreen {...callbacks()} />);
    expect(relaunch.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(relaunch.queryByText(strings.onboarding.welcome.headline)).toBeNull();
    expect(relaunch.queryByText(strings.onboarding.handoff.eyebrow)).toBeNull();
    expect(relaunch.getByText(strings.prompt.dayLabel)).toBeTruthy();
  });

  it("a profile with history is never onboarded, even without the flag", () => {
    seedHistoryEntry();
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
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

  it("an active trial generates sessions as normal", () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(6) });
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.expired.headline)).toBeNull();
  });

  it("an expired trial swaps new-session generation for the paywall, in its expired voice", () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();
    // Never the pre-trial "free week ahead" letter once the week is spent.
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.paywall.cta)).toBeNull();
    expect(screen.queryByText(strings.prompt.time.question)).toBeNull();
    // Her record is untouched — gating blocks nothing already earned.
    expect(useProfileStore.getState().history.entries).toHaveLength(1);
  });

  it("the gated day keeps the quiet corner doors — Progress and Settings stay hers (P0 #7)", () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    const screen = render(<LaunchScreen {...callbacks()} />);
    // The day's frame survives expiry: same label, same doors, same
    // corner as every other morning — only new-session generation gates.
    expect(screen.getByText(strings.prompt.dayLabel)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();
    fireEvent.press(screen.getByTestId("open-progress"));
    expect(router.push).toHaveBeenCalledWith("/progress");
    fireEvent.press(screen.getByTestId("open-settings"));
    expect(router.push).toHaveBeenCalledWith("/settings");
    // Restore is always available from the gated day (ADR-0009 §3).
    expect(screen.getByTestId("paywall-restore")).toBeTruthy();
  });

  it("restoring a purchase from the gated day unlocks the prompt", async () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    useDevReceiptStore.setState({
      receipt: { plan: "annual", date: isoDaysAgo(10) },
    });
    const screen = render(<LaunchScreen {...callbacks()} />);
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.prompt.time.question)).toBeTruthy(),
    );
  });

  it("an empty restore leaves the gated day standing — doors intact, honest message", async () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    const screen = render(<LaunchScreen {...callbacks()} />);
    fireEvent.press(screen.getByTestId("paywall-restore"));
    await waitFor(() =>
      expect(screen.getByTestId("paywall-restore-empty")).toBeTruthy(),
    );
    expect(screen.getByTestId("open-progress")).toBeTruthy();
    expect(screen.getByTestId("open-settings")).toBeTruthy();
  });

  it("a purchase entitles her even with the trial long expired", () => {
    useEntitlementStore.setState({
      trialStartDate: isoDaysAgo(30),
      purchase: { plan: "annual", date: isoDaysAgo(10) },
    });
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
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
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.paywall.expired.headline)).toBeTruthy();

    fireEvent.press(screen.getByTestId("paywall-purchase"));
    await waitFor(() =>
      expect(screen.getByText(strings.prompt.time.question)).toBeTruthy(),
    );
    expect(useEntitlementStore.getState().purchase).toMatchObject({
      plan: "annual",
    });
  });

  it("waits for the entitlement store to hydrate before deciding anything", () => {
    useEntitlementStore.setState({ hydrated: false });
    const screen = render(<LaunchScreen {...callbacks()} />);
    expect(screen.getByText(strings.errors.preparing)).toBeTruthy();
    expect(screen.queryByText(strings.paywall.headline)).toBeNull();
    expect(screen.queryByText(strings.onboarding.welcome.headline)).toBeNull();
    expect(screen.queryByText(strings.prompt.time.question)).toBeNull();
  });
});
