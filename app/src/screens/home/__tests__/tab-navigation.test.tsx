import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router, Tabs, useLocalSearchParams } from "expo-router";
import React from "react";
import { createInitialProfile } from "@fither/engine";

import TabsLayout from "../../../../app/(tabs)/_layout";
import HomeRoute from "../../../../app/(tabs)/home";
import PreviewRoute from "../../../../app/preview";
import PromptRoute from "../../../../app/prompt";
import { strings } from "../../../copy/strings";
import { darkColors, fontFamily } from "../../../design/tokens";
import { todayIso } from "../../../lib/dates";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useIdentityStore } from "../../../state/identity-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSessionStore } from "../../../state/session-store";
import { useSettingsStore } from "../../../state/settings-store";
import { createPlayer } from "../../../session/player-machine";
import {
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../../test-utils/fixtures";

// The hub's navigation shape (ADR-0013 §4): three tabs, and a tab bar
// that cannot appear during the session flow — because those routes are
// not in the group at all. The session stays sacred (design system §2).

// Route placement is asserted by resolution, not by reading the disk:
// a route file that is not in the group cannot be required from it.
declare function require(moduleId: string): unknown;

function routeExists(path: string): boolean {
  try {
    require(path);
    return true;
  } catch {
    return false;
  }
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return todayIso(d);
}

beforeEach(() => {
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
  useLedgerStore.setState({ events: [], hydrated: true, hydrationFailed: false });
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
  useIdentityStore.setState({
    identity: { kind: "guest", date: "2026-08-01" },
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.setState({
    prompt: null,
    sessionId: null,
    session: null,
    player: null,
    finish: null,
  });
  (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({});
});

describe("the tab bar", () => {
  it("carries exactly Home, Progress and Settings, labelled from strings.ts", () => {
    const screen = render(<TabsLayout />);
    const names = screen.UNSAFE_getAllByType(Tabs.Screen).map((node) => ({
      name: node.props.name as string,
      title: (node.props.options as { title: string }).title,
    }));
    expect(names).toEqual([
      { name: "home", title: strings.prompt.dayLabel },
      { name: "progress", title: strings.profile.title },
      { name: "settings", title: strings.settings.title },
    ]);
  });

  it("is styled from tokens: page ground, hairline, green active, soft ink inactive, an icon per tab", () => {
    const screen = render(<TabsLayout />);
    const options = screen.UNSAFE_getByType(Tabs).props.screenOptions;
    expect(options.tabBarActiveTintColor).toBe(darkColors.accent);
    expect(options.tabBarInactiveTintColor).toBe(darkColors.inkSoft);
    // Weight is the second cue: hue alone is no signifier with a
    // colour-vision deficiency.
    const label = options.tabBarLabel as (p: {
      focused: boolean;
      color: string;
      children: string;
    }) => React.ReactElement;
    const focused = render(label({ focused: true, color: darkColors.accent, children: "Today" }));
    const idle = render(label({ focused: false, color: darkColors.inkSoft, children: "Today" }));
    const face = (s: ReturnType<typeof render>) =>
      Object.assign({}, ...[s.getByText("Today").props.style].flat(Infinity)).fontFamily;
    expect(face(focused)).toBe(fontFamily.bold);
    expect(face(idle)).not.toBe(fontFamily.bold);
    // Every tab draws its own line icon, tinted by the bar (ADR-0017).
    const tabs = screen.UNSAFE_getAllByType(Tabs.Screen);
    expect(tabs).toHaveLength(3);
    for (const node of tabs) {
      const name = node.props.name as string;
      const tabOptions = node.props.options as {
        tabBarIcon: (p: { color: string; focused: boolean; size: number }) => React.ReactElement;
      };
      const icon = render(tabOptions.tabBarIcon({ color: darkColors.accent, focused: true, size: 28 }));
      const id = name === "home" ? "tab-icon-today" : `tab-icon-${name}`;
      const style = Object.assign({}, ...[icon.getByTestId(id, { includeHiddenElements: true }).props.style].flat(Infinity));
      expect(style.tintColor).toBe(darkColors.accent);
    }
    expect(options.tabBarStyle).toMatchObject({
      backgroundColor: darkColors.bg,
      borderTopColor: darkColors.line,
    });
    // The tabs carry no headers: each screen sets its own title in place.
    expect(options.headerShown).toBe(false);
  });

  it("never covers the session flow: those routes live outside the group", () => {
    // The three tabs are in the group...
    for (const route of ["home", "progress", "settings"]) {
      expect(routeExists(`../../../../app/(tabs)/${route}`)).toBe(true);
    }
    // ...and everything the session flow touches — plus the launch
    // surface and sign-in — is a sibling of it in the root stack, so it
    // pushes OVER the tabs and no chrome shows during a workout.
    for (const route of [
      "index",
      "prompt",
      "preview",
      "session",
      "finish",
      "unlock",
      "reminder-ask",
      "sign-in",
    ]) {
      expect(routeExists(`../../../../app/${route}`)).toBe(true);
      expect(routeExists(`../../../../app/(tabs)/${route}`)).toBe(false);
    }
  });
});

describe("the hub and the questions are what a subscription gates", () => {
  it("an entitled day renders the hub", () => {
    const screen = render(<HomeRoute />);
    expect(screen.getByTestId("home-start")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("on a gated day the Today tab IS the gated day — inline, no bounce through '/'", () => {
    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8), purchase: null, trialUsed: false });
    const screen = render(<HomeRoute />);
    expect(screen.queryByTestId("home-start")).toBeNull();
    // The letter where the questions would be; her record stays one tab
    // away (the bar is the door now — ADR-0017 removed the corner pills).
    expect(screen.getByText(strings.paywall.headline)).toBeTruthy();
    expect(screen.getByText(strings.paywall.expired.recordNote)).toBeTruthy();
    expect(screen.queryByTestId("open-progress")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("the questions are reachable, unchanged, and equally gated", async () => {
    const open = render(<PromptRoute />);
    expect(open.getByText(strings.prompt.time.question)).toBeTruthy();
    open.unmount();

    useEntitlementStore.setState({ trialStartDate: isoDaysAgo(8) });
    const gated = render(<PromptRoute />);
    expect(gated.queryByText(strings.prompt.time.question)).toBeNull();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("'Change today's answers' returns to the questions, not to the hub", () => {
    useSessionStore.setState({
      prompt: fixturePrompt,
      sessionId: "test:session",
      session: fixtureSession,
      player: createPlayer(fixturePlayerBlocks),
    });
    const screen = render(<PreviewRoute />);
    fireEvent.press(screen.getByTestId("preview-change-answers"));
    expect(router.replace).toHaveBeenCalledWith("/prompt");
  });

  it("renders the handoff eyebrow only when the launch surface asks for it", () => {
    (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({
      handoff: "1",
    });
    const screen = render(<PromptRoute />);
    expect(screen.getByText(strings.onboarding.handoff.eyebrow)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.handoff.line)).toBeTruthy();
  });
});
