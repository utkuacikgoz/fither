import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { strings } from "../../../copy/strings";
import { applyResult } from "../../../session/apply-result";
import { createPlayer, reduce, type PlayerBlock } from "../../../session/player-machine";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { createInitialProfile, type BlockOutcome } from "@fither/engine";
import { useProfileStore } from "../../../state/profile-store";
import { movementFigure } from "../../../session/movement-figures";
import { useSessionStore } from "../../../state/session-store";
import { COMPLETION_STORAGE_KEY } from "../../../state/completion-journal";
import { useSettingsStore } from "../../../state/settings-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import {
  fixtureApplyResult,
  fixturePlayerBlocks,
  fixtureSession,
} from "../../../test-utils/fixtures";
import { FinishScreen } from "../finish-screen";

jest.mock("../../../session/apply-result", () => ({ applyResult: jest.fn() }));
const mockedApply = jest.mocked(applyResult);

function seedFinishedSession() {
  let player = createPlayer(fixturePlayerBlocks);
  player = reduce(player, { type: "skipBlock" });
  player = reduce(player, { type: "skipBlock" });
  useSessionStore.setState({
    sessionId: `finish-test:${Date.now()}:${Math.random()}`,
    session: fixtureSession,
    player,
    activeMs: 0,
    workResumedAt: null,
    pendingClose: null,
    finish: null,
    saveFailed: false,
    saving: false,
  });
}

beforeEach(async () => {
  await AsyncStorage.removeItem(COMPLETION_STORAGE_KEY);
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
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    hydrated: true,
    hydrationFailed: false,
  });
  seedFinishedSession();
  mockedApply.mockReturnValue({ ok: true, value: fixtureApplyResult() });
});

/** Two library movements that BOTH have figures — so a lost figure fails. */
function figureBackedPlayer(outcomes: BlockOutcome[]) {
  const done = useSessionStore.getState().player!;
  const blocks: PlayerBlock[] = [
    { ...fixturePlayerBlocks[0]!, movementId: "wall-push-up" },
    { ...fixturePlayerBlocks[1]!, movementId: "knee-plank", name: "Knee Plank" },
  ];
  return { ...done, blocks, outcomes };
}

describe("FinishScreen", () => {
  it("one point reads '+1 point' — a unit that agrees with its number", async () => {
    // pointsEarned is the sum of the result's ledger events, so a
    // one-point session is one session event worth one point.
    mockedApply.mockReturnValue({
      ok: true,
      value: {
        ...fixtureApplyResult(),
        ledgerEvents: [{ type: "session", points: 1, date: "2026-08-31" }],
      },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText("+1");
    expect(screen.getByText(strings.finish.pointsUnit(1))).toBeTruthy();
    expect(strings.finish.pointsUnit(1)).not.toBe(strings.finish.pointsUnit(2));
  });

  it("shows the faces of what she did — both completed blocks, in block order", async () => {
    useSessionStore.setState({ player: figureBackedPlayer(["completed", "completed"]) });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText("+35");
    const hidden = { includeHiddenElements: true } as const;
    const sources = screen
      .getAllByTestId(/^finish-figure-\d+$/, hidden)
      .map((node) => node.findByType(Image).props.source);
    // Expected from the ids, not from the map the screen reads: a
    // missing asset fails here instead of passing with zero figures.
    expect(sources).toEqual([movementFigure("wall-push-up"), movementFigure("knee-plank")]);
    expect(sources.every((source) => source !== null)).toBe(true);
  });

  it("draws only the completed ones: skipped and struggled blocks have no face here", async () => {
    useSessionStore.setState({ player: figureBackedPlayer(["struggled", "completed"]) });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText("+35");
    const hidden = { includeHiddenElements: true } as const;
    const sources = screen
      .getAllByTestId(/^finish-figure-\d+$/, hidden)
      .map((node) => node.findByType(Image).props.source);
    expect(sources).toEqual([movementFigure("knee-plank")]);
  });

  it("draws nothing until the close is known — figures under 'Saving' were a guess", async () => {
    useSessionStore.setState({ player: figureBackedPlayer(["completed", "completed"]) });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(screen.getByText(strings.finish.savingHeadline)).toBeTruthy();
    expect(screen.queryByTestId("finish-figures", { includeHiddenElements: true })).toBeNull();
    // Let the apply settle inside the test, so the update lands in act().
    await screen.findByTestId("finish-continue");
    expect(screen.getByTestId("finish-figures", { includeHiddenElements: true })).toBeTruthy();
  });

  it("the honest nothing-done close shows nothing to show, and Continue waits for nothing", async () => {
    // Default seed: both blocks skipped.
    const onContinue = jest.fn();
    const screen = render(<FinishScreen onContinue={onContinue} />);
    await screen.findByTestId("finish-continue");
    expect(screen.queryByTestId("finish-figures", { includeHiddenElements: true })).toBeNull();
    // No timers advanced: the button is outside the choreography.
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("applies the session once on arrival and shows the points earned", async () => {
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(screen.getByText(strings.finish.savingHeadline)).toBeTruthy();
    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(strings.finish.headline)).toBeTruthy();
    expect(screen.getByText("+35")).toBeTruthy();
    expect(screen.getByText(strings.finish.pointsUnit(35))).toBeTruthy();
  });

  it("a zero-completion session gets the honest close — no 'complete', no points row", async () => {
    // Every block skipped: the engine emits no "session" event and no
    // points (skip is neutral, ADR-0012). The screen must not celebrate.
    const base = fixtureApplyResult();
    mockedApply.mockReturnValue({
      ok: true,
      value: { ...base, ledgerEvents: [], unlockedSkills: [] },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(
      await screen.findByText(strings.finish.nothingDone.headline),
    ).toBeTruthy();
    expect(screen.getByText(strings.finish.nothingDone.note)).toBeTruthy();
    expect(screen.queryByText(strings.finish.headline)).toBeNull();
    expect(screen.queryByText(strings.finish.note)).toBeNull();
    expect(screen.queryByText("+0")).toBeNull();
    expect(screen.queryByText(strings.finish.pointsUnit(0))).toBeNull();
    // She still leaves through the same single button.
    expect(screen.getByTestId("finish-continue")).toBeTruthy();
  });

  it("ended early ('Finish here') closes as 'Finished here' — saved work, points shown", async () => {
    // The close reason was set where the close happened (the resume
    // offer's finishSessionEarly); the screen renders it, never infers.
    useSessionStore.setState({ pendingClose: "endedEarly" });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);

    expect(
      await screen.findByText(strings.finish.endedEarly.headline),
    ).toBeTruthy();
    expect(screen.getByText(strings.finish.endedEarly.note)).toBeTruthy();
    expect(screen.queryByText(strings.finish.headline)).toBeNull();
    expect(screen.queryByText(strings.finish.nothingDone.headline)).toBeNull();
    // Completed work counts: the points row stays.
    expect(screen.getByText("+35")).toBeTruthy();
  });

  it("out of time closes as the time promise kept, naming her minutes", async () => {
    useSessionStore.setState({ pendingClose: "outOfTime" });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);

    expect(
      await screen.findByText(
        strings.finish.outOfTime.headline(fixtureSession.minutes),
      ),
    ).toBeTruthy();
    expect(screen.getByText(strings.finish.outOfTime.note)).toBeTruthy();
    expect(screen.queryByText(strings.finish.headline)).toBeNull();
    expect(screen.getByText("+35")).toBeTruthy();
  });

  it("nothingDone wins over an early close when zero blocks completed", async () => {
    useSessionStore.setState({ pendingClose: "outOfTime" });
    const base = fixtureApplyResult();
    mockedApply.mockReturnValue({
      ok: true,
      value: { ...base, ledgerEvents: [], unlockedSkills: [] },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);

    expect(
      await screen.findByText(strings.finish.nothingDone.headline),
    ).toBeTruthy();
    expect(
      screen.queryByText(strings.finish.outOfTime.headline(fixtureSession.minutes)),
    ).toBeNull();
    expect(screen.queryByText(strings.finish.endedEarly.headline)).toBeNull();
    expect(screen.queryByTestId("finish-points")).toBeNull();
  });

  it("exactly one point reads '+1 point' — never unitless, never the false plural", async () => {
    const base = fixtureApplyResult();
    mockedApply.mockReturnValue({
      ok: true,
      value: {
        ...base,
        ledgerEvents: [{ type: "session", points: 1, date: "2026-08-31" }],
        unlockedSkills: [],
      },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);

    expect(await screen.findByText("+1")).toBeTruthy();
    expect(screen.getByText(strings.finish.pointsUnit(1))).toBeTruthy();
    expect(screen.queryByText(strings.finish.pointsUnit(2))).toBeNull();
  });

  it("names the streak the commit just made: day 1 on a first session, the run when there is one (ADR-0018)", async () => {
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(await screen.findByText(strings.finish.headline)).toBeTruthy();
    // The fixture history holds exactly today: a start, not a run of one.
    expect(screen.getByTestId("finish-streak")).toBeTruthy();
    expect(screen.getByText(strings.streak.finish(1))).toBeTruthy();
  });

  it("counts yesterday into today's streak, read from the history the engine wrote", async () => {
    const base = fixtureApplyResult();
    const today = base.history.entries[0]!;
    mockedApply.mockReturnValue({
      ok: true,
      value: {
        ...base,
        history: {
          entries: [{ ...today, date: "2026-08-30" }, today],
        },
      },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(await screen.findByText(strings.finish.headline)).toBeTruthy();
    expect(screen.getByText(strings.streak.finish(2))).toBeTruthy();
  });

  it("the nothing-done close carries no streak line — there is no day to count", async () => {
    let player = createPlayer(fixturePlayerBlocks);
    player = reduce(player, { type: "skipBlock" });
    player = reduce(player, { type: "skipBlock" });
    useSessionStore.setState({ player });
    mockedApply.mockReturnValue({
      ok: true,
      value: { ...fixtureApplyResult(), ledgerEvents: [], unlockedSkills: [] },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(
      await screen.findByText(strings.finish.nothingDone.headline),
    ).toBeTruthy();
    expect(screen.queryByTestId("finish-streak")).toBeNull();
  });

  it("every close state renders no user-facing text outside strings.ts", async () => {
    useSessionStore.setState({ pendingClose: "outOfTime" });
    const allowed = collectStringValues(strings);
    // Parameterised strings.ts values and dynamic numerals, enumerated.
    allowed.add(strings.finish.outOfTime.headline(fixtureSession.minutes));
    allowed.add("+35");
    allowed.add(strings.finish.pointsUnit(35));
    // The streak pill names whatever run today's history makes.
    for (let days = 1; days <= 60; days += 1) {
      allowed.add(strings.streak.finish(days));
    }
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText(
      strings.finish.outOfTime.headline(fixtureSession.minutes),
    );
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      // On failure the message shows the offending leaf, not just false.
      expect(allowed.has(leaf) ? true : leaf).toBe(true);
    }
  });

  it("announces the HONEST close to VoiceOver once settled", async () => {
    const announce = jest.spyOn(
      require("react-native").AccessibilityInfo,
      "announceForAccessibility",
    );
    const base = fixtureApplyResult();
    mockedApply.mockReturnValue({
      ok: true,
      value: { ...base, ledgerEvents: [], unlockedSkills: [] },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText(strings.finish.nothingDone.headline);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(strings.finish.nothingDone.headline);
    announce.mockRestore();
  });

  it("continues via the single button", async () => {
    const onContinue = jest.fn();
    const screen = render(<FinishScreen onContinue={onContinue} />);
    fireEvent.press(await screen.findByTestId("finish-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("stays calm when saving is unavailable — no points shown, no crash", async () => {
    mockedApply.mockReturnValue({ ok: false, reason: "engineUnavailable" });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(await screen.findByText(strings.errors.saveUnavailable)).toBeTruthy();
    expect(screen.queryByTestId("finish-points")).toBeNull();
    expect(screen.getByTestId("finish-retry")).toBeTruthy();
  });

  it("retries saving from the recovery action", async () => {
    mockedApply
      .mockReturnValueOnce({ ok: false, reason: "engineUnavailable" })
      .mockReturnValueOnce({ ok: true, value: fixtureApplyResult() });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    fireEvent.press(await screen.findByTestId("finish-retry"));
    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("finish-continue")).toBeTruthy();
  });
});
