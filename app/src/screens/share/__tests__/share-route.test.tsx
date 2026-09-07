import { act, render, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { createInitialProfile, type HistoryEntry } from "@fither/engine";

import ShareRoute from "../../../../app/share";
import { useDevAuthSessionStore } from "../../../auth/dev-auth";
import { strings } from "../../../copy/strings";
import { todayIso } from "../../../lib/dates";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useIdentityStore } from "../../../state/identity-store";
import { useIntentionStore } from "../../../state/intention-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";

// The route as a public door: parameters are text from anywhere, the
// guard waits on hydration only, and every input renders a truthful card.

const TODAY = todayIso();

function entry(date: string, minutes: 10 | 20 | 30): HistoryEntry {
  return {
    date,
    minutes,
    blocks: [{ movementId: "wall-push-up", pattern: "push", outcome: "completed" }],
  };
}

function seedHydrated() {
  useLedgerStore.setState({ events: [], hydrated: true, hydrationFailed: false });
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [entry("2026-01-05", 30), entry(TODAY, 10)] },
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
  useActiveSessionStore.setState({ snapshot: null, hydrated: true, hydrationFailed: false });
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useDevReceiptStore.setState({ receipt: null, hydrated: true, hydrationFailed: false });
  useIdentityStore.setState({
    identity: { kind: "guest", date: "2026-08-01" },
    hydrated: true,
    hydrationFailed: false,
  });
  useDevAuthSessionStore.setState({ session: null, hydrated: true, hydrationFailed: false });
  useIntentionStore.setState({ target: null, asked: true, hydrated: true });
}

function params(value: Record<string, string | string[]>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(value);
}

beforeEach(() => {
  seedHydrated();
  params({});
});

describe("/share", () => {
  it("renders today's session for source=finish with no date", () => {
    params({ source: "finish" });
    const screen = render(<ShareRoute />);
    expect(screen.getByText(strings.share.context.card.headline(null, 10))).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("reads the date parameter", () => {
    params({ source: "receipt", date: "2026-01-05" });
    const screen = render(<ShareRoute />);
    expect(screen.getByText(strings.share.context.card.headline(null, 30))).toBeTruthy();
  });

  it("a malformed date is today; an unknown source is a receipt", () => {
    params({ source: "anything", date: "05/01/2026" });
    const screen = render(<ShareRoute />);
    expect(screen.getByText(strings.share.context.card.headline(null, 10))).toBeTruthy();
    expect(screen.getByTestId("share-send")).toBeTruthy();
  });

  it("source=recap renders the week", () => {
    params({ source: "recap", date: TODAY });
    const screen = render(<ShareRoute />);
    expect(screen.getByText(strings.share.context.card.week(1))).toBeTruthy();
  });

  it("no parameters at all still renders (today's last entry)", () => {
    const screen = render(<ShareRoute />);
    expect(screen.getByTestId("share-card")).toBeTruthy();
  });

  it("waits on hydration, then shows the card without redirecting", async () => {
    useProfileStore.setState({ hydrated: false });
    params({ source: "finish" });
    const screen = render(<ShareRoute />);
    expect(screen.getByText(strings.errors.preparing)).toBeTruthy();
    expect(screen.queryByTestId("share-card")).toBeNull();
    act(() => {
      useProfileStore.setState({ hydrated: true });
    });
    await waitFor(() => expect(screen.getByTestId("share-card")).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
