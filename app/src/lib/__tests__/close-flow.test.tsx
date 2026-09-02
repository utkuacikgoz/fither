import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { createInitialProfile } from "@fither/engine";
import * as StoreReview from "expo-store-review";

import FinishRoute from "../../../app/finish";
import ReminderAskRoute from "../../../app/reminder-ask";
import UnlockRoute from "../../../app/unlock";
import { strings } from "../../copy/strings";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useIdentityStore } from "../../state/identity-store";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { useRatingStore } from "../../state/rating-store";
import { useReminderStore } from "../../state/reminder-store";
import { useSessionStore, type FinishClose } from "../../state/session-store";

// The decided out-of-session moments, exercised through the REAL routes
// (launch checklist): the one-time notification ask after the first
// close with completed work, and the system rating prompt from the
// second completed session onward — never the first, never over a
// nothing-done close, never mid-session. The OS notification surface is
// the jest-setup SDK mock (grant by default); store-review likewise.

const requestReview = jest.mocked(StoreReview.requestReview);
const hasAction = jest.mocked(StoreReview.hasAction);

function seedFinish(close: FinishClose, unlocked = false) {
  useSessionStore.setState({
    prompt: null,
    sessionId: null,
    session: null,
    player: null,
    countdownEndsAt: null,
    activeMs: 0,
    workResumedAt: null,
    pendingClose: null,
    finish: {
      pointsEarned: close.reason === "nothingDone" ? 0 : 35,
      completedAnything: close.reason !== "nothingDone",
      close,
      unlockedSkills: unlocked
        ? [{ pattern: "push", tier: 4, movementName: "Full Push-Up" }]
        : [],
    },
    saveFailed: false,
    saving: false,
  });
}

async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  hasAction.mockResolvedValue(true);
  requestReview.mockResolvedValue(undefined);
  useLedgerStore.setState({ events: [], hydrated: true, hydrationFailed: false });
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
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
  useReminderStore.setState({
    asked: false,
    slot: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useRatingStore.setState({
    completedCloses: 0,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("the one-time notification ask (finish exit)", () => {
  it("appears after the FIRST completed close — and the summary survives for its guard", () => {
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/reminder-ask");
    // Not reset yet: /reminder-ask owns the reset on its way out.
    expect(useSessionStore.getState().finish).not.toBeNull();
  });

  it("a close with completed work but ended early ALSO earns the ask (ten minutes is complete)", () => {
    seedFinish({ reason: "endedEarly" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/reminder-ask");
  });

  it("never over a nothing-done close — no value shown means no ask", () => {
    seedFinish({ reason: "nothingDone" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalledWith("/reminder-ask");
    expect(useSessionStore.getState().finish).toBeNull();
  });

  it("never again once asked — a later completed close goes straight home", () => {
    useReminderStore.setState({ asked: true });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalledWith("/reminder-ask");
  });

  it("fails safe while the reminder store is unhydrated: no ask, home", () => {
    useReminderStore.setState({ hydrated: false });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.replace).not.toHaveBeenCalledWith("/reminder-ask");
  });
});

describe("/reminder-ask route", () => {
  it("runs the ask over a valid close, then resets the session on the way out", async () => {
    useReminderStore.setState({ asked: false });
    seedFinish({ reason: "completed" });
    const screen = render(<ReminderAskRoute />);
    expect(
      screen.getByText(strings.notifications.rationale.line),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId("reminder-ask-decline"));
    expect(useReminderStore.getState().asked).toBe(true);
    expect(useSessionStore.getState().finish).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("cold-opened after the ask already ran, it redirects home — never a second ask", async () => {
    useReminderStore.setState({ asked: true });
    seedFinish({ reason: "completed" });
    const screen = render(<ReminderAskRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(
      screen.queryByText(strings.notifications.rationale.line),
    ).toBeNull();
  });
});

describe("the rating moments", () => {
  it("her FIRST completed session never prompts (it offers the ask instead)", async () => {
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    await flushAsync();
    expect(useRatingStore.getState().completedCloses).toBe(1);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("the SECOND completed close prompts on the way out of the finish screen", async () => {
    useReminderStore.setState({ asked: true });
    useRatingStore.setState({ completedCloses: 1 });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    await flushAsync();
    expect(useRatingStore.getState().completedCloses).toBe(2);
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("only a plain 'completed' close counts or prompts — endedEarly does neither", async () => {
    useReminderStore.setState({ asked: true });
    useRatingStore.setState({ completedCloses: 5 });
    seedFinish({ reason: "endedEarly" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    await flushAsync();
    expect(useRatingStore.getState().completedCloses).toBe(5);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("a nothing-done close neither counts nor prompts", async () => {
    useReminderStore.setState({ asked: true });
    useRatingStore.setState({ completedCloses: 5 });
    seedFinish({ reason: "nothingDone" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    await flushAsync();
    expect(useRatingStore.getState().completedCloses).toBe(5);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("with an unlock pending, finish records the close but defers the prompt to the unlock exit", async () => {
    useReminderStore.setState({ asked: true });
    useRatingStore.setState({ completedCloses: 1 });
    seedFinish({ reason: "completed" }, true);
    const finishScreen = render(<FinishRoute />);
    fireEvent.press(finishScreen.getByTestId("finish-continue"));
    await flushAsync();
    expect(router.replace).toHaveBeenCalledWith("/unlock");
    expect(useRatingStore.getState().completedCloses).toBe(2);
    expect(requestReview).not.toHaveBeenCalled();
    finishScreen.unmount();

    const unlockScreen = render(<UnlockRoute />);
    fireEvent.press(unlockScreen.getByTestId("unlock-continue"));
    await flushAsync();
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(useSessionStore.getState().finish).toBeNull();
  });

  it("leaving the unlock after her FIRST completed session offers the ask, not the prompt", async () => {
    seedFinish({ reason: "completed" }, true);
    const finishScreen = render(<FinishRoute />);
    fireEvent.press(finishScreen.getByTestId("finish-continue"));
    finishScreen.unmount();

    const unlockScreen = render(<UnlockRoute />);
    fireEvent.press(unlockScreen.getByTestId("unlock-continue"));
    await flushAsync();
    expect(router.replace).toHaveBeenCalledWith("/reminder-ask");
    expect(requestReview).not.toHaveBeenCalled();
    // Summary alive for the ask route's guard.
    expect(useSessionStore.getState().finish).not.toBeNull();
  });

  it("the OS gate holds: no review action available means no request", async () => {
    hasAction.mockResolvedValue(false);
    useReminderStore.setState({ asked: true });
    useRatingStore.setState({ completedCloses: 3 });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    await flushAsync();
    expect(requestReview).not.toHaveBeenCalled();
  });
});
