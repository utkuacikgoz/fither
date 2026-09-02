import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { strings } from "../../../copy/strings";
import { applyResult } from "../../../session/apply-result";
import { createPlayer, reduce } from "../../../session/player-machine";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useProfileStore } from "../../../state/profile-store";
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
    workStartedAt: null,
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

describe("FinishScreen", () => {
  it("applies the session once on arrival and shows the points earned", async () => {
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(screen.getByText(strings.finish.savingHeadline)).toBeTruthy();
    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(strings.finish.headline)).toBeTruthy();
    expect(screen.getByText("+35")).toBeTruthy();
    expect(screen.getByText(strings.finish.pointsLabel)).toBeTruthy();
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
    expect(screen.queryByText(strings.finish.pointsLabel)).toBeNull();
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

  it("exactly one point renders without the plural unit label", async () => {
    // strings.finish.pointsLabel is static ("points"); until a singular
    // exists in strings.ts the unit line is dropped for 1, never false.
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
    expect(screen.queryByText(strings.finish.pointsLabel)).toBeNull();
  });

  it("every close state renders no user-facing text outside strings.ts", async () => {
    useSessionStore.setState({ pendingClose: "outOfTime" });
    const allowed = collectStringValues(strings);
    // Parameterised strings.ts values and dynamic numerals, enumerated.
    allowed.add(strings.finish.outOfTime.headline(fixtureSession.minutes));
    allowed.add("+35");
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText(
      strings.finish.outOfTime.headline(fixtureSession.minutes),
    );
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
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
