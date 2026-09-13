import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { createInitialProfile } from "@fither/engine";
import * as StoreReview from "expo-store-review";

import FinishRoute from "../../../app/finish";
import IntentionRoute from "../../../app/intention";
import ReminderAskRoute from "../../../app/reminder-ask";
import TrialOfferRoute from "../../../app/trial-offer";
import UnlockRoute from "../../../app/unlock";
import { strings } from "../../copy/strings";
import { useActiveSessionStore } from "../../state/active-session-store";
import { useEntitlementStore } from "../../state/entitlement-store";
import { useExperimentStore } from "../../state/experiment-store";
import { useIdentityStore } from "../../state/identity-store";
import { useIntentionStore } from "../../state/intention-store";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { useRatingStore } from "../../state/rating-store";
import { useReminderStore } from "../../state/reminder-store";
import { useSessionStore, type FinishClose } from "../../state/session-store";

// The decided out-of-session moments, exercised through the REAL routes
// (launch checklist, wave 2): the one-time weekly-intention ask and the
// one-time notification ask after the first close with an attempted
// block, in that order (lib/close-flow.ts), and the system rating prompt
// from the second completed session onward — never the first, never
// over a nothing-done close, never mid-session. The OS notification
// surface is the jest-setup SDK mock (grant by default); store-review
// likewise.

const requestReview = jest.mocked(StoreReview.requestReview);
const hasAction = jest.mocked(StoreReview.hasAction);

function seedFinish(close: FinishClose, unlocked = false, first = false) {
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
      first,
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
    trialUsed: false,
    qualifyingSessions: 0,
    hydrated: true,
    hydrationFailed: false,
  });
  useExperimentStore.setState({ hydrated: true, hydrationFailed: false, assignments: {}, forceVariant: null });
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
  // The reminder-ask and rating cases below run with the intention
  // already answered; its own cases seed it owed.
  useIntentionStore.setState({
    target: null,
    asked: true,
    hydrated: true,
    hydrationFailed: false,
  });
  useRatingStore.setState({
    completedCloses: 0,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("the first-session commercial offer", () => {
  beforeEach(() => {
    useIntentionStore.setState({ asked: false });
    useEntitlementStore.setState({ trialStartDate: "2026-09-12", qualifyingSessions: 1 });
  });

  it("follows the weekly choice, lets her decline, and leaves reminders for later", () => {
    seedFinish({ reason: "completed" }, false, true);
    const close = render(<FinishRoute />);
    fireEvent.press(close.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenLastCalledWith("/intention");
    close.unmount();
    const intention = render(<IntentionRoute />);
    fireEvent.press(intention.getByTestId("intention-three"));
    expect(router.replace).toHaveBeenLastCalledWith("/trial-offer");
    intention.unmount();
    const offer = render(<TrialOfferRoute />);
    expect(offer.getByText(strings.paywall.firstClose.lead(3))).toBeTruthy();
    fireEvent.press(offer.getByTestId("paywall-not-now"));
    expect(router.replace).toHaveBeenLastCalledWith("/home");
    expect(useSessionStore.getState().finish).toBeNull();
    expect(useReminderStore.getState().asked).toBe(false);
  });

  it("ends the offer after a successful purchase", async () => {
    seedFinish({ reason: "completed" }, false, true);
    const offer = render(<TrialOfferRoute />);
    fireEvent.press(offer.getByTestId("paywall-purchase"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/home"));
    expect(useEntitlementStore.getState().purchase).not.toBeNull();
    expect(useSessionStore.getState().finish).toBeNull();
  });

  it("preserves the three-session experiment allowance", () => {
    useExperimentStore.setState({ forceVariant: "three" });
    useIntentionStore.setState({ asked: true });
    seedFinish({ reason: "completed" }, false, true);
    const close = render(<FinishRoute />);
    fireEvent.press(close.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenLastCalledWith("/reminder-ask");
    expect(router.replace).not.toHaveBeenCalledWith("/trial-offer");
  });

  it("rejects a direct entry without a qualifying first close", async () => {
    seedFinish({ reason: "completed" });
    const offer = render(<TrialOfferRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(offer.queryByText(strings.paywall.firstClose.headline)).toBeNull();
  });
});

describe("the one-time intention ask (finish exit, wave 2)", () => {
  beforeEach(() => {
    useIntentionStore.setState({ asked: false });
  });

  it("comes FIRST after the first close with an attempted block — before the reminder ask", () => {
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/intention");
    expect(router.replace).not.toHaveBeenCalledWith("/reminder-ask");
    // Not reset: the asks downstream still need the summary.
    expect(useSessionStore.getState().finish).not.toBeNull();
  });

  it("a 'Hard today' session (attempted, nothing completed) earns the ask too (ADR-0023)", () => {
    seedFinish({ reason: "endedEarly" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/intention");
  });

  it("never over a nothing-done close — and never later because of it", () => {
    seedFinish({ reason: "nothingDone" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/home");
    expect(router.replace).not.toHaveBeenCalledWith("/intention");
    // Still owed: the next attempted session asks.
    expect(useIntentionStore.getState().asked).toBe(false);
  });

  it("never again once asked — the reminder ask (if owed) is next instead", () => {
    useIntentionStore.setState({ asked: true, target: 2 });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/reminder-ask");
    expect(router.replace).not.toHaveBeenCalledWith("/intention");
  });

  it("fails safe while the intention store is unhydrated: skipped, the reminder ask runs", () => {
    useIntentionStore.setState({ hydrated: false });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/reminder-ask");
    expect(router.replace).not.toHaveBeenCalledWith("/intention");
  });

  it("an unlock still owns the exit; the intention ask waits on the far side of it", () => {
    seedFinish({ reason: "completed" }, true);
    const finishScreen = render(<FinishRoute />);
    fireEvent.press(finishScreen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/unlock");
    expect(router.replace).not.toHaveBeenCalledWith("/intention");
    finishScreen.unmount();

    const unlockScreen = render(<UnlockRoute />);
    fireEvent.press(unlockScreen.getByTestId("unlock-continue"));
    expect(router.replace).toHaveBeenCalledWith("/intention");
    expect(useSessionStore.getState().finish).not.toBeNull();
  });

  it("the whole order through the real routes: finish → intention → reminder ask → home, once", async () => {
    seedFinish({ reason: "completed" });
    const finishScreen = render(<FinishRoute />);
    fireEvent.press(finishScreen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenLastCalledWith("/intention");
    finishScreen.unmount();

    const intentionScreen = render(<IntentionRoute />);
    expect(intentionScreen.getByText(strings.intention.question)).toBeTruthy();
    fireEvent.press(intentionScreen.getByTestId("intention-three"));
    expect(useIntentionStore.getState().target).toBe(3);
    expect(router.replace).toHaveBeenLastCalledWith("/reminder-ask");
    // The summary survives for the reminder ask's guard.
    expect(useSessionStore.getState().finish).not.toBeNull();
    intentionScreen.unmount();

    const reminderScreen = render(<ReminderAskRoute />);
    expect(reminderScreen.getByText(strings.notifications.rationale.line)).toBeTruthy();
    fireEvent.press(reminderScreen.getByTestId("reminder-ask-decline"));
    expect(router.replace).toHaveBeenLastCalledWith("/home");
    expect(useSessionStore.getState().finish).toBeNull();
    reminderScreen.unmount();

    // A second attempted close: neither ask runs again (ended early, so
    // the rating gate — a separate rule, pinned below — stays out of it).
    seedFinish({ reason: "endedEarly" });
    const again = render(<FinishRoute />);
    fireEvent.press(again.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenLastCalledWith("/home");
    await flushAsync();
    expect(requestReview).not.toHaveBeenCalled();
  });
});

describe("/intention route", () => {
  it("with the reminder already asked, answering goes straight home and resets the session", () => {
    useIntentionStore.setState({ asked: false });
    useReminderStore.setState({ asked: true });
    seedFinish({ reason: "completed" });
    const screen = render(<IntentionRoute />);
    fireEvent.press(screen.getByTestId("intention-none"));
    expect(useIntentionStore.getState().asked).toBe(true);
    expect(useSessionStore.getState().finish).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/home");
    expect(router.replace).not.toHaveBeenCalledWith("/reminder-ask");
  });

  it("cold-opened after the ask already ran, it redirects — never a second ask", async () => {
    seedFinish({ reason: "completed" });
    const screen = render(<IntentionRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(strings.intention.question)).toBeNull();
  });

  it("cold-opened over a nothing-done close, it redirects — there is nothing to plan from", async () => {
    useIntentionStore.setState({ asked: false });
    seedFinish({ reason: "nothingDone" });
    const screen = render(<IntentionRoute />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(strings.intention.question)).toBeNull();
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
    expect(router.replace).toHaveBeenCalledWith("/home");
    expect(router.replace).not.toHaveBeenCalledWith("/reminder-ask");
    expect(useSessionStore.getState().finish).toBeNull();
  });

  it("never again once asked — a later completed close goes straight home", () => {
    useReminderStore.setState({ asked: true });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/home");
    expect(router.replace).not.toHaveBeenCalledWith("/reminder-ask");
  });

  it("fails safe while the reminder store is unhydrated: no ask, home", () => {
    useReminderStore.setState({ hydrated: false });
    seedFinish({ reason: "completed" });
    const screen = render(<FinishRoute />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(router.replace).toHaveBeenCalledWith("/home");
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
    expect(router.replace).toHaveBeenCalledWith("/home");
  });

  it("cold-opened after the ask already ran, it redirects home — never a second ask", async () => {
    useReminderStore.setState({ asked: true });
    seedFinish({ reason: "completed" });
    const screen = render(<ReminderAskRoute />);
    // The route GUARD's redirect (not a post-session exit): guards still
    // send a cold open to the launch surface, which decides everything.
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
    expect(router.replace).toHaveBeenCalledWith("/home");
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
    expect(router.replace).toHaveBeenCalledWith("/home");
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
