import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";

import { strings } from "../../../copy/strings";
import { todayIso } from "../../../lib/dates";
import { createSession } from "../../../session/create-session";
import { unblockingAreasFor } from "../../../session/unblocking";
import { useSessionStore } from "../../../state/session-store";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import {
  fixturePlayerBlocks,
  fixtureSession,
} from "../../../test-utils/fixtures";
import {
  DEV_TIMING_TITLE,
} from "../../dev-timing/first-movement-readout";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useFirstMovementStore } from "../../../state/first-movement-store";
import { DailyPromptScreen } from "../daily-prompt-screen";

jest.mock("../../../session/create-session", () => ({ createSession: jest.fn() }));
const mockedCreate = jest.mocked(createSession);
// The engine's "which area unblocks today" answer, asked through the
// app-side helper; mocked so each test states the answer it renders.
jest.mock("../../../session/unblocking", () => ({
  unblockingAreasFor: jest.fn(() => []),
}));
const mockedUnblocking = jest.mocked(unblockingAreasFor);

/**
 * An applied session recorded for today, with its engine-written per-block
 * outcomes — the done-state's only input. Detection and the minutes claim
 * both read these outcomes, so every seed states them explicitly.
 */
function todayEntry(
  minutes: number,
  outcomes: Array<"completed" | "struggled" | "skipped">,
) {
  return {
    date: todayIso(),
    minutes: minutes as 10 | 20 | 30,
    blocks: outcomes.map((outcome, index) => ({
      movementId: `movement-${index}`,
      pattern: "push" as const,
      outcome,
    })),
  };
}

function seedTodayHistory(entries: Array<ReturnType<typeof todayEntry>>) {
  useProfileStore.setState({ history: { entries } });
}

beforeEach(() => {
  useLedgerStore.setState({ hydrated: true, hydrationFailed: false });
  useProfileStore.setState({
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
  useSettingsStore.setState({
    hydrated: true,
    hydrationFailed: false,
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
  useCareNoteStore.setState({
    entries: [],
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.getState().resetSession();
  mockedCreate.mockReturnValue({
    ok: true,
    value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks },
  });
});

describe("DailyPromptScreen", () => {
  it("prefills today's previous answers when she returns from the preview", () => {
    useSessionStore.setState({
      prompt: {
        minutes: 20,
        energy: "strong",
        quiet: false,
        avoid: ["wrists"],
        date: "2026-09-02",
        equipment: ["none", "wall"],
      },
    });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    expect(screen.getByTestId("time-20").props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(screen.getByTestId("time-20"));
    expect(screen.getByTestId("energy-strong").props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(screen.getByTestId("energy-strong"));
    expect(screen.getByTestId("quiet-no").props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(screen.getByTestId("quiet-no"));
    expect(screen.getByTestId("soreness-wrists").props.accessibilityState).toEqual({
      selected: true,
    });
  });

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

  it("keeps every answer row hittable from its first frame, mid-entrance", () => {
    // Gate 3 budget: a returning user who knows the flow taps ahead of
    // the fade. The rows enter staggered (ADR-0013) but nothing gates
    // the press, so four taps still complete the prompt with no wait.
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-30"));
    fireEvent.press(screen.getByTestId("energy-strong"));
    fireEvent.press(screen.getByTestId("quiet-no"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(onSessionReady).toHaveBeenCalledTimes(1);
  });

  it("shows how far through the four questions she is, one segment per question", () => {
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
    const bar = () => screen.getByTestId("prompt-flow");

    // ADR-0003 fixes the flow at four questions and the domain rule
    // forbids a fifth; the indicator counts from that structure, so a
    // question added without reading the rule would fail here.
    expect(bar().props.accessibilityValue).toEqual({ min: 0, max: 4, now: 1 });

    fireEvent.press(screen.getByTestId("time-10"));
    expect(bar().props.accessibilityValue.now).toBe(2);

    fireEvent.press(screen.getByTestId("energy-low"));
    expect(bar().props.accessibilityValue.now).toBe(3);

    fireEvent.press(screen.getByTestId("quiet-yes"));
    expect(bar().props.accessibilityValue.now).toBe(4);
  });

  it("stops counting where the flow stops — the can't-build state is not a step", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    // A bar that kept counting through an outcome would be lying about
    // where she is; adjusting her answers puts her back on question one.
    expect(screen.queryByTestId("prompt-flow")).toBeNull();
    fireEvent.press(screen.getByTestId("prompt-adjust-answers"));
    expect(screen.getByTestId("prompt-flow").props.accessibilityValue.now).toBe(
      1,
    );
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

  it("the error state's 'Try again' retries generation with the same answers", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noLibrary" });
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(onSessionReady).not.toHaveBeenCalled();
    expect(screen.getByText(strings.errors.sessionUnavailable)).toBeTruthy();
    expect(screen.getByText(strings.errors.tryAgain)).toBeTruthy();

    // "Try again" truthfully names a retry: the identical prompt goes back
    // through generation — no reset, no re-answering.
    fireEvent.press(screen.getByTestId("prompt-try-again"));
    expect(mockedCreate).toHaveBeenCalledTimes(2);
    expect(mockedCreate.mock.calls[1]).toEqual(mockedCreate.mock.calls[0]);
    // Still unavailable: the honest error stays, not the questions.
    expect(screen.getByText(strings.errors.sessionUnavailable)).toBeTruthy();

    // When generation recovers, the same tap starts the session.
    mockedCreate.mockReturnValue({
      ok: true,
      value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks },
    });
    fireEvent.press(screen.getByTestId("prompt-try-again"));
    expect(mockedCreate.mock.calls[2]).toEqual(mockedCreate.mock.calls[0]);
    expect(onSessionReady).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText(strings.prompt.noSession.headline(0))).toBeTruthy();
    expect(screen.getByTestId("prompt-adjust-answers")).toBeTruthy();
  });

  it("the can't-build action returns to question one with her answers preserved", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-20"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-back"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));
    fireEvent.press(screen.getByTestId("care-continue"));

    // The action names what it does — adjusting answers, not "trying again".
    expect(screen.getByText(strings.preview.changeAnswers)).toBeTruthy();
    expect(screen.queryByText(strings.errors.tryAgain)).toBeNull();

    fireEvent.press(screen.getByTestId("prompt-adjust-answers"));
    // Back at the FIRST question, every answer kept as a prefill.
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(screen.getByTestId("time-20").props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(screen.getByTestId("time-20"));
    expect(screen.getByTestId("energy-low").props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(screen.getByTestId("energy-low"));
    expect(screen.getByTestId("quiet-yes").props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(screen.getByTestId("quiet-yes"));
    expect(screen.getByTestId("soreness-back").props.accessibilityState).toEqual({
      selected: true,
    });
    // The kept pick means "All good" stays hidden and confirm is live —
    // she adjusts the selection rather than rebuilding it.
    expect(screen.queryByTestId("soreness-all-good")).toBeNull();
    expect(screen.getByTestId("soreness-confirm")).toBeTruthy();
  });

  it("merges the persistent avoid-list into every prompt, even on 'All good'", () => {
    useSettingsStore.setState({ alwaysAvoid: ["knees"] });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ avoid: ["knees"] }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
  });

  it("deduplicates persistent and daily picks into one avoid list", () => {
    useSettingsStore.setState({ alwaysAvoid: ["knees", "back"] });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-knees"));
    fireEvent.press(screen.getByTestId("soreness-wrists"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));

    expect(mockedCreate).toHaveBeenCalledWith(
      // Stable presentation order, each area once.
      expect.objectContaining({ avoid: ["wrists", "back", "knees"] }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
  });

  it("shows selection affordances on soreness picks: checkmark and live count", () => {
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-okay"));
    fireEvent.press(screen.getByTestId("quiet-no"));

    // Nothing selected yet: no checks, no count cue.
    expect(screen.queryByTestId("soreness-wrists-check", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("soreness-count")).toBeNull();

    fireEvent.press(screen.getByTestId("soreness-wrists"));
    expect(screen.getByTestId("soreness-wrists-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(strings.prompt.soreness.areasNoted(1))).toBeTruthy();
    expect(screen.queryByTestId("soreness-all-good")).toBeNull();

    fireEvent.press(screen.getByTestId("soreness-knees"));
    expect(screen.getByTestId("soreness-knees-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(strings.prompt.soreness.areasNoted(2))).toBeTruthy();

    // Deselecting removes the check and updates the count.
    fireEvent.press(screen.getByTestId("soreness-knees"));
    expect(screen.queryByTestId("soreness-knees-check", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText(strings.prompt.soreness.areasNoted(1))).toBeTruthy();

    fireEvent.press(screen.getByTestId("soreness-wrists"));
    expect(screen.getByTestId("soreness-all-good")).toBeTruthy();
  });

  it("leads the can't-build state with care when sore areas caused it", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-back"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));

    // The acknowledgment leads as its own beat (one headline per screen,
    // ADR-0017); the recommendation and the way out come after it.
    expect(screen.getByTestId("care-acknowledgment")).toBeTruthy();
    expect(screen.getByText(strings.care.acknowledgment)).toBeTruthy();
    expect(screen.getByText(strings.care.notePrompt)).toBeTruthy();
    expect(screen.getByText(strings.care.notePrivacy)).toBeTruthy();
    expect(screen.queryByTestId("prompt-adjust-answers")).toBeNull();

    fireEvent.press(screen.getByTestId("care-continue"));
    expect(screen.getByText(strings.prompt.noSession.headline(1))).toBeTruthy();
    expect(screen.getByTestId("prompt-adjust-answers")).toBeTruthy();
  });

  it("keeps the plain can't-build state when no body areas were involved", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(screen.getByText(strings.prompt.noSession.headline(0))).toBeTruthy();
    expect(screen.queryByTestId("care-acknowledgment")).toBeNull();
    expect(screen.queryByTestId("care-note")).toBeNull();
  });

  it("saves an optional note to the local store when she writes one, skippable otherwise", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-back"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));

    fireEvent.changeText(screen.getByTestId("care-note"), "  long day  ");
    fireEvent.press(screen.getByTestId("care-continue"));
    fireEvent.press(screen.getByTestId("prompt-adjust-answers"));

    // Shape-matched, not deep-equal: the care-note store (owned by the
    // care-journal surface) may attach its own identity fields; this
    // screen's contract is only that date + text were captured.
    expect(useCareNoteStore.getState().entries).toHaveLength(1);
    expect(useCareNoteStore.getState().entries[0]).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as unknown as string,
      text: "long day",
    });
    // And she is back at the start, with the moment behind her.
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();

    // Leaving the field empty saves nothing — completely skippable. Her
    // answers were preserved, so she re-walks the prefilled questions;
    // "back" is still picked, so confirm is already live.
    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));
    fireEvent.press(screen.getByTestId("care-skip"));
    fireEvent.press(screen.getByTestId("prompt-adjust-answers"));
    expect(useCareNoteStore.getState().entries).toHaveLength(1);
  });

  it("recommends the way out: the engine's unblocking areas as rows, one tap builds the session", () => {
    // Owner decision 2026-09-07: a dead end recommends what to do. The
    // engine says which single area, set aside, lets today build.
    mockedCreate.mockReturnValueOnce({ ok: false, reason: "noSession" });
    mockedUnblocking.mockReturnValueOnce(["shoulders", "hips"]);
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-shoulders"));
    fireEvent.press(screen.getByTestId("soreness-hips"));
    fireEvent.press(screen.getByTestId("soreness-core"));
    fireEvent.press(screen.getByTestId("soreness-confirm"));
    fireEvent.press(screen.getByTestId("care-continue"));

    expect(screen.getByText(strings.prompt.noSession.headline(3))).toBeTruthy();
    expect(screen.getByText(strings.prompt.noSession.instruction)).toBeTruthy();
    expect(screen.getByText(strings.prompt.noSession.settingsNote)).toBeTruthy();
    expect(screen.queryByText(strings.prompt.noSession.none)).toBeNull();
    const shoulders = strings.prompt.soreness.areas.shoulders.toLowerCase();
    expect(
      screen.getByText(strings.prompt.noSession.setAside(shoulders)),
    ).toBeTruthy();
    expect(screen.getByTestId("no-session-set-aside-hips")).toBeTruthy();
    // Core did not unblock alone, so it is not offered.
    expect(screen.queryByTestId("no-session-set-aside-core")).toBeNull();
    // The helper was asked with the exact prompt the engine refused.
    expect(mockedUnblocking).toHaveBeenCalledWith(
      expect.objectContaining({ avoid: ["shoulders", "hips", "core"] }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );

    mockedCreate.mockReturnValueOnce({
      ok: true,
      value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks },
    });
    fireEvent.press(screen.getByTestId("no-session-set-aside-shoulders"));
    // The rebuilt prompt is the same day, minus the one area, today only.
    expect(mockedCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ avoid: ["hips", "core"] }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
    expect(onSessionReady).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
  });

  it("sets aside an Always-work-around area for today without touching Settings", () => {
    useSettingsStore.setState({ alwaysAvoid: ["shoulders", "back", "hips"] });
    mockedCreate.mockReturnValueOnce({ ok: false, reason: "noSession" });
    mockedUnblocking.mockReturnValueOnce(["back"]);
    const onSessionReady = jest.fn();
    const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));
    fireEvent.press(screen.getByTestId("care-continue"));
    expect(screen.getByText(strings.prompt.noSession.headline(3))).toBeTruthy();

    mockedCreate.mockReturnValueOnce({
      ok: true,
      value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks },
    });
    fireEvent.press(screen.getByTestId("no-session-set-aside-back"));
    expect(mockedCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ avoid: ["shoulders", "hips"] }),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
    );
    expect(onSessionReady).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([
      "shoulders",
      "back",
      "hips",
    ]);
  });

  it("says so when no single area unblocks, and still offers the way back", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noSession" });
    mockedUnblocking.mockReturnValue([]);
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent.press(screen.getByTestId("energy-low"));
    fireEvent.press(screen.getByTestId("quiet-yes"));
    fireEvent.press(screen.getByTestId("soreness-all-good"));

    expect(screen.getByText(strings.prompt.noSession.none)).toBeTruthy();
    expect(screen.queryByTestId("no-session-rows")).toBeNull();
    expect(screen.getByTestId("prompt-adjust-answers")).toBeTruthy();
  });

  it("dev-only timing readout: long-press entry, prompt state survives", () => {
    // Jest runs with __DEV__ true, so the invisible long-press target on
    // the day label is rendered here — in release it does not exist.
    useFirstMovementStore.setState({
      runs: [],
      hydrated: true,
      hydrationFailed: false,
    });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    // A plain tap does nothing — only a long-press opens the readout.
    fireEvent.press(screen.getByTestId("dev-timing-entry"));
    expect(screen.queryByText(DEV_TIMING_TITLE)).toBeNull();

    // Answer one question first: the overlay must not lose her place.
    fireEvent.press(screen.getByTestId("time-10"));
    fireEvent(screen.getByTestId("dev-timing-entry"), "longPress");
    expect(screen.getByText(DEV_TIMING_TITLE)).toBeTruthy();
    expect(screen.queryByText(strings.prompt.energy.question)).toBeNull();

    fireEvent.press(screen.getByTestId("dev-timing-close"));
    expect(screen.queryByText(DEV_TIMING_TITLE)).toBeNull();
    expect(screen.getByText(strings.prompt.energy.question)).toBeTruthy();
  });

  it("carries no navigation doors — Progress and Settings are tabs now", () => {
    // ADR-0013 §4: the corner doors are gone. This is a pushed flow with
    // one job (the four questions); the hub's tab bar owns navigation,
    // and the way back is the route's own back chevron.
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(screen.queryByTestId("open-progress")).toBeNull();
    expect(screen.queryByTestId("open-settings")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("asks the four questions even when today already holds completed work", () => {
    // The calm done-state moved to the hub (one definition, in
    // state/today-training.ts). Arriving here means she CHOSE to build a
    // session — "Another session" is a home action — so this screen never
    // second-guesses her with a done state of its own.
    seedTodayHistory([todayEntry(20, ["completed", "completed"])]);
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(
      screen.queryByText(strings.prompt.completedToday.headline),
    ).toBeNull();
    expect(screen.queryByTestId("another-session")).toBeNull();
  });

  it("an all-skipped session leaves the questions exactly as they are", () => {
    // The entry exists in history (the engine records it), but nothing
    // completed. Whatever today holds, this screen asks the four
    // questions — the done-state lives on the hub.
    seedTodayHistory([todayEntry(10, ["skipped", "skipped"])]);
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);

    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(
      screen.queryByText(strings.prompt.completedToday.headline),
    ).toBeNull();
  });

  it("a previous day's history changes nothing here either", () => {
    useProfileStore.setState({
      history: {
        entries: [{ date: "2026-08-01", minutes: 30, blocks: [] }],
      },
    });
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
    expect(screen.getByText(strings.prompt.time.question)).toBeTruthy();
    expect(
      screen.queryByText(strings.prompt.completedToday.headline),
    ).toBeNull();
  });

  it("renders no user-facing text outside strings.ts, history and all", () => {
    seedTodayHistory([
      todayEntry(10, ["completed"]),
      todayEntry(20, ["completed", "completed"]),
    ]);
    const allowed = collectStringValues(strings);
    // Parameterised strings.ts values, explicitly enumerated.
    allowed.add(strings.prompt.completedToday.line(30));
    const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });

  describe("restrictions once — the first session's remember toggle (owner brief 2026-09-07)", () => {
    // First session: nothing remembered, nothing trained. The beforeEach
    // above already leaves alwaysAvoid empty and history empty.
    const reachSoreness = (screen: ReturnType<typeof render>) => {
      fireEvent.press(screen.getByTestId("time-10"));
      fireEvent.press(screen.getByTestId("energy-okay"));
      fireEvent.press(screen.getByTestId("quiet-no"));
    };

    it("offers the toggle only once an area is picked, OFF by default", () => {
      const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
      reachSoreness(screen);
      expect(screen.queryByTestId("soreness-remember")).toBeNull();

      fireEvent.press(screen.getByTestId("soreness-knees"));
      const toggle = screen.getByTestId("soreness-remember");
      expect(toggle).toBeTruthy();
      expect(screen.getByText(strings.prompt.soreness.remember)).toBeTruthy();
      expect(toggle.props.accessibilityState).toEqual({ selected: false });
      expect(
        screen.queryByTestId("soreness-remember-check", { includeHiddenElements: true }),
      ).toBeNull();

      // Deselecting the last pick takes the offer away with it.
      fireEvent.press(screen.getByTestId("soreness-knees"));
      expect(screen.queryByTestId("soreness-remember")).toBeNull();
    });

    it("toggle ON persists the picks as the permanent list before the session is built", () => {
      const onSessionReady = jest.fn();
      const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);
      reachSoreness(screen);
      fireEvent.press(screen.getByTestId("soreness-knees"));
      fireEvent.press(screen.getByTestId("soreness-back"));
      fireEvent.press(screen.getByTestId("soreness-remember"));
      expect(
        screen.getByTestId("soreness-remember").props.accessibilityState,
      ).toEqual({ selected: true });
      expect(
        screen.getByTestId("soreness-remember-check", { includeHiddenElements: true }),
      ).toBeTruthy();

      // The list lands before generation runs: what the engine saw is
      // what Settings now holds.
      mockedCreate.mockImplementationOnce((prompt, profile, history, salt) => {
        expect(useSettingsStore.getState().alwaysAvoid).toEqual(["knees", "back"]);
        void prompt; void profile; void history; void salt;
        return { ok: true, value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks } };
      });
      fireEvent.press(screen.getByTestId("soreness-confirm"));

      expect(onSessionReady).toHaveBeenCalledTimes(1);
      expect(useSettingsStore.getState().alwaysAvoid).toEqual(["knees", "back"]);
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ avoid: ["back", "knees"] }),
        expect.anything(),
        expect.anything(),
        expect.any(Number),
      );
    });

    it("toggle OFF persists nothing — today's picks stay today's", () => {
      const onSessionReady = jest.fn();
      const screen = render(<DailyPromptScreen onSessionReady={onSessionReady} />);
      reachSoreness(screen);
      fireEvent.press(screen.getByTestId("soreness-knees"));
      expect(screen.getByTestId("soreness-remember")).toBeTruthy();
      fireEvent.press(screen.getByTestId("soreness-confirm"));

      expect(onSessionReady).toHaveBeenCalledTimes(1);
      expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({ avoid: ["knees"] }),
        expect.anything(),
        expect.anything(),
        expect.any(Number),
      );
    });

    it("toggling twice is OFF again and persists nothing", () => {
      const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
      reachSoreness(screen);
      fireEvent.press(screen.getByTestId("soreness-wrists"));
      fireEvent.press(screen.getByTestId("soreness-remember"));
      fireEvent.press(screen.getByTestId("soreness-remember"));
      fireEvent.press(screen.getByTestId("soreness-confirm"));
      expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    });

    it("builds the identical session either way — the merge logic is untouched", () => {
      const walk = (remember: boolean) => {
        const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
        reachSoreness(screen);
        fireEvent.press(screen.getByTestId("soreness-shoulders"));
        fireEvent.press(screen.getByTestId("soreness-hips"));
        if (remember) fireEvent.press(screen.getByTestId("soreness-remember"));
        fireEvent.press(screen.getByTestId("soreness-confirm"));
        const [prompt] = mockedCreate.mock.calls[mockedCreate.mock.calls.length - 1] ?? [];
        screen.unmount();
        return prompt;
      };
      const off = walk(false);
      // Reset to a first-session state for the second walk.
      useSettingsStore.setState({ alwaysAvoid: [] });
      useSessionStore.getState().resetSession();
      const on = walk(true);
      expect(on).toEqual(off);
      expect(on).toMatchObject({ avoid: ["shoulders", "hips"] });
      expect(useSettingsStore.getState().alwaysAvoid).toEqual(["shoulders", "hips"]);
    });

    it("is absent on a non-first session: a permanent list already exists", () => {
      useSettingsStore.setState({ alwaysAvoid: ["wrists"] });
      const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
      reachSoreness(screen);
      fireEvent.press(screen.getByTestId("soreness-knees"));
      expect(screen.queryByTestId("soreness-remember")).toBeNull();
      expect(screen.queryByText(strings.prompt.soreness.remember)).toBeNull();
    });

    it("is absent on a non-first session: she has trained before", () => {
      useProfileStore.setState({
        history: { entries: [{ date: "2026-08-01", minutes: 10, blocks: [] }] },
      });
      const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
      reachSoreness(screen);
      fireEvent.press(screen.getByTestId("soreness-knees"));
      expect(screen.queryByTestId("soreness-remember")).toBeNull();
      fireEvent.press(screen.getByTestId("soreness-confirm"));
      expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    });

    it("'All good' on a first session remembers nothing — there is nothing to remember", () => {
      const screen = render(<DailyPromptScreen onSessionReady={jest.fn()} />);
      reachSoreness(screen);
      fireEvent.press(screen.getByTestId("soreness-all-good"));
      expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    });
  });

  it("shows the onboarding handoff atop the first question only", () => {
    const screen = render(
      <DailyPromptScreen onSessionReady={jest.fn()} showHandoff />,
    );
    expect(screen.getByText(strings.onboarding.handoff.eyebrow)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.handoff.line)).toBeTruthy();
    expect(screen.queryByText(strings.prompt.dayLabel)).toBeNull();

    fireEvent.press(screen.getByTestId("time-10"));
    expect(screen.queryByText(strings.onboarding.handoff.eyebrow)).toBeNull();
    expect(screen.queryByText(strings.onboarding.handoff.line)).toBeNull();
    expect(screen.getByText(strings.prompt.dayLabel)).toBeTruthy();
  });
});
