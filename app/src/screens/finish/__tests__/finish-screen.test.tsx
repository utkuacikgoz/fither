import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { darkColors } from "../../../design/tokens";
import { applyResult } from "../../../session/apply-result";
import { createPlayer, reduce } from "../../../session/player-machine";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useIntentionStore } from "../../../state/intention-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { createInitialProfile, type ApplyResult, type BlockOutcome } from "@fither/engine";
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
  fixtureApplyResultOutcomes,
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
  clearRecordedEvents();
  useIntentionStore.setState({
    target: null,
    asked: false,
    hydrated: true,
    hydrationFailed: false,
  });
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

/**
 * The result the engine hands back for the given outcomes, over two
 * library movements that BOTH have figures — so a lost figure fails. The
 * receipt reads the history entry the commit wrote, so the outcomes live
 * there; a completed block also earns the fixture's session event, as
 * the engine's would.
 */
function figureBackedResult(outcomes: readonly BlockOutcome[]): ApplyResult {
  const base = fixtureApplyResultOutcomes(outcomes);
  const entry = base.history.entries[0]!;
  const ids = ["wall-push-up", "knee-plank"] as const;
  const completed = outcomes.some((outcome) => outcome === "completed");
  return {
    ...base,
    history: {
      entries: [
        {
          ...entry,
          blocks: entry.blocks.map((block, index) => ({
            ...block,
            movementId: ids[index] ?? block.movementId,
          })),
        },
      ],
    },
    ledgerEvents: completed ? [{ type: "session", points: 10, date: entry.date }] : [],
  };
}

/** The figure's drawn tint, read off its image. */
function figureTint(node: ReturnType<typeof render>["getByTestId"] extends (...args: never[]) => infer R ? R : never): string {
  const style = Object.assign({}, ...[node.findByType(Image).props.style].flat(Infinity)) as {
    tintColor: string;
  };
  return style.tintColor;
}

const hidden = { includeHiddenElements: true } as const;

describe("FinishScreen", () => {
  it("one point closes the receipt as '+1' beside the Points label", async () => {
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
    expect(screen.getByTestId("finish-receipt-points-value").props.children).toBe("+1");
    expect(screen.getByText(strings.finish.receipt.pointsLabel)).toBeTruthy();
  });

  it("shows the faces of what she did — both completed blocks, in block order, in ink", async () => {
    mockedApply.mockReturnValue({ ok: true, value: figureBackedResult(["completed", "completed"]) });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText("+10");
    const figures = screen.getAllByTestId(/^finish-figure-\d+$/, hidden);
    const sources = figures.map((node) => node.findByType(Image).props.source);
    // Expected from the ids, not from the map the screen reads: a
    // missing asset fails here instead of passing with zero figures.
    expect(sources).toEqual([movementFigure("wall-push-up"), movementFigure("knee-plank")]);
    expect(sources.every((source) => source !== null)).toBe(true);
    expect(figures.map(figureTint)).toEqual([darkColors.ink, darkColors.ink]);
  });

  it("draws every attempted block: struggled has a face in the soft ink, skipped has none (ADR-0023)", async () => {
    mockedApply.mockReturnValue({ ok: true, value: figureBackedResult(["struggled", "skipped"]) });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText(strings.finish.headline);
    const figures = screen.getAllByTestId(/^finish-figure-\d+$/, hidden);
    expect(figures.map((node) => node.findByType(Image).props.source)).toEqual([
      movementFigure("wall-push-up"),
    ]);
    expect(figures.map(figureTint)).toEqual([darkColors.inkSoft]);
  });

  it("a 'Hard today' session closes as a session: no points row, no 'didn't fit', the receipt says Hard today", async () => {
    mockedApply.mockReturnValue({
      ok: true,
      value: figureBackedResult(["struggled", "struggled"]),
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(await screen.findByText(strings.finish.headline)).toBeTruthy();
    expect(screen.queryByText(strings.finish.nothingDone.headline)).toBeNull();
    expect(screen.queryByTestId("finish-receipt-points")).toBeNull();
    expect(screen.queryByText("+0")).toBeNull();
    expect(screen.getByTestId("finish-receipt-done-value").props.children).toBe(
      strings.finish.receipt.done(0),
    );
    expect(screen.getByTestId("finish-receipt-hard-value").props.children).toBe(
      strings.finish.receipt.hard(2),
    );
  });

  it("draws nothing until the close is known — figures, receipt and share under 'Saving' were a guess", async () => {
    mockedApply.mockReturnValue({ ok: true, value: figureBackedResult(["completed", "completed"]) });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(screen.getByText(strings.finish.savingHeadline)).toBeTruthy();
    expect(screen.queryByTestId("finish-figures", hidden)).toBeNull();
    expect(screen.queryByTestId("finish-receipt")).toBeNull();
    expect(screen.queryByTestId("finish-share")).toBeNull();
    // Let the apply settle inside the test, so the update lands in act().
    await screen.findByTestId("finish-continue");
    expect(screen.getByTestId("finish-figures", hidden)).toBeTruthy();
    expect(screen.getByTestId("finish-receipt")).toBeTruthy();
    expect(screen.getByTestId("finish-share")).toBeTruthy();
  });

  it("the honest nothing-done close shows nothing to show — no figures, no receipt, no share — and Continue waits for nothing", async () => {
    mockedApply.mockReturnValue({
      ok: true,
      value: fixtureApplyResultOutcomes(["skipped", "skipped"]),
    });
    const onContinue = jest.fn();
    const screen = render(<FinishScreen onContinue={onContinue} />);
    await screen.findByTestId("finish-continue");
    expect(screen.queryByTestId("finish-figures", hidden)).toBeNull();
    expect(screen.queryByTestId("finish-receipt")).toBeNull();
    expect(screen.queryByTestId("finish-share")).toBeNull();
    expect(recordedEvents().some((event) => event.name === "share_eligible")).toBe(false);
    // No timers advanced: the button is outside the choreography.
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("the receipt: Done, the planned length and the week — no Hard today row on a clean session", async () => {
    // The fixture's session is a Monday (2026-08-31); the entry the
    // commit wrote is the week's first trained day.
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByTestId("finish-receipt");
    const value = (key: string) =>
      screen.getByTestId(`finish-receipt-${key}-value`).props.children as string;
    expect(screen.getByText(strings.finish.receipt.doneLabel)).toBeTruthy();
    expect(value("done")).toBe(strings.finish.receipt.done(2));
    expect(screen.queryByTestId("finish-receipt-hard")).toBeNull();
    expect(screen.queryByText(strings.finish.receipt.hardLabel)).toBeNull();
    expect(screen.getByText(strings.finish.receipt.lengthLabel)).toBeTruthy();
    expect(value("length")).toBe(strings.finish.receipt.length(fixtureSession.minutes));
    expect(screen.getByText(strings.finish.receipt.weekLabel)).toBeTruthy();
    // No target: the plain count, its full stop trimmed for a column.
    expect(strings.week.progressNoTarget(1)).toMatch(/\.$/);
    expect(value("week")).toBe(strings.week.progressNoTarget(1).replace(/\.$/, ""));
  });

  it("the receipt's week reads against her target when she holds one", async () => {
    useIntentionStore.setState({ target: 3, asked: true });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByTestId("finish-receipt");
    expect(strings.week.progress(1, 3)).toMatch(/\.$/);
    expect(screen.getByTestId("finish-receipt-week-value").props.children).toBe(
      strings.week.progress(1, 3).replace(/\.$/, ""),
    );
  });

  it("a partial session's receipt counts what she did and what was hard, in the entry's own order", async () => {
    mockedApply.mockReturnValue({
      ok: true,
      value: figureBackedResult(["completed", "struggled"]),
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByTestId("finish-receipt");
    const rows = screen
      .getAllByTestId(/^finish-receipt-(done|hard|length|week)$/)
      .map((row) => row.props.testID as string);
    expect(rows).toEqual([
      "finish-receipt-done",
      "finish-receipt-hard",
      "finish-receipt-length",
      "finish-receipt-week",
    ]);
    expect(screen.getByTestId("finish-receipt-done-value").props.children).toBe(
      strings.finish.receipt.done(1),
    );
    expect(screen.getByTestId("finish-receipt-hard-value").props.children).toBe(
      strings.finish.receipt.hard(1),
    );
  });

  it("reads the receipt off the LAST entry dated the session's day — a second session on one date", async () => {
    const base = fixtureApplyResult();
    const today = base.history.entries[0]!;
    mockedApply.mockReturnValue({
      ok: true,
      value: {
        ...base,
        history: {
          entries: [
            // The morning's session, same date, three blocks done.
            { ...today, blocks: [...today.blocks, today.blocks[0]!] },
            // The one just committed: one done, one skipped.
            {
              ...today,
              blocks: [
                today.blocks[0]!,
                { ...today.blocks[1]!, outcome: "skipped" },
              ],
            },
          ],
        },
      },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByTestId("finish-receipt");
    expect(screen.getByTestId("finish-receipt-done-value").props.children).toBe(
      strings.finish.receipt.done(1),
    );
    // Two sessions, one trained day: the week counts days, not sessions.
    expect(screen.getByTestId("finish-receipt-week-value").props.children).toBe(
      strings.week.progressNoTarget(1).replace(/\.$/, ""),
    );
  });

  it("offers the share once the receipt settles, and records that it was offered exactly once", async () => {
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    fireEvent.press(await screen.findByTestId("finish-share"));
    expect(router.push).toHaveBeenCalledWith("/share?source=finish");
    // A re-render (the points beat, a store tick) does not re-offer.
    screen.rerender(<FinishScreen onContinue={jest.fn()} />);
    const offered = recordedEvents().filter((event) => event.name === "share_eligible");
    expect(offered).toEqual([{ name: "share_eligible", properties: { source: "finish" } }]);
  });

  it("applies the session once on arrival and shows the points earned", async () => {
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(screen.getByText(strings.finish.savingHeadline)).toBeTruthy();
    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(strings.finish.headline)).toBeTruthy();
    // The points are the receipt's last row, the value in the green.
    expect(screen.getByTestId("finish-receipt-points-value").props.children).toBe("+35");
    expect(screen.getByText(strings.finish.receipt.pointsLabel)).toBeTruthy();
    const rowIds = screen
      .getAllByTestId(/^finish-receipt-(done|hard|length|week|points)$/)
      .map((row) => row.props.testID);
    expect(rowIds[rowIds.length - 1]).toBe("finish-receipt-points");
  });

  it("makes the first completion the start of a visible capability path", async () => {
    const base = figureBackedResult(["completed", "completed"]);
    mockedApply.mockReturnValue({
      ok: true,
      value: {
        ...base,
        profile: createInitialProfile(),
        unlockedSkills: [],
      },
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    const path = await screen.findByTestId("finish-first-path");
    expect(path).toBeTruthy();
    expect(screen.getByText(strings.finish.first.title)).toBeTruthy();
    expect(
      screen.getByText(strings.finish.first.next("Full Push-Up", 3)),
    ).toBeTruthy();
  });

  it("does not repeat the starting-point card after the first completion", async () => {
    useEntitlementStore.setState({ trialStartDate: "2026-08-30" });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByTestId("finish-receipt");
    expect(screen.queryByTestId("finish-first-path")).toBeNull();
  });

  it("a zero-completion session gets the honest close — no 'complete', no points row", async () => {
    // Every block skipped: the engine emits no "session" event and no
    // points (skip is neutral, ADR-0012). The screen must not celebrate.
    mockedApply.mockReturnValue({
      ok: true,
      value: fixtureApplyResultOutcomes(["skipped", "skipped"]),
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(
      await screen.findByText(strings.finish.nothingDone.headline),
    ).toBeTruthy();
    expect(screen.getByText(strings.finish.nothingDone.note)).toBeTruthy();
    expect(screen.queryByText(strings.finish.headline)).toBeNull();
    expect(screen.queryByText(strings.finish.note)).toBeNull();
    expect(screen.queryByText("+0")).toBeNull();
    expect(screen.queryByTestId("finish-receipt-points")).toBeNull();
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
    mockedApply.mockReturnValue({
      ok: true,
      value: fixtureApplyResultOutcomes(["skipped", "skipped"]),
    });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);

    expect(
      await screen.findByText(strings.finish.nothingDone.headline),
    ).toBeTruthy();
    expect(
      screen.queryByText(strings.finish.outOfTime.headline(fixtureSession.minutes)),
    ).toBeNull();
    expect(screen.queryByText(strings.finish.endedEarly.headline)).toBeNull();
    expect(screen.queryByTestId("finish-receipt-points")).toBeNull();
  });

  it("exactly one point reads '+1' on the Points row — never '+0', never a second row", async () => {
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
    expect(screen.getByText(strings.finish.receipt.pointsLabel)).toBeTruthy();
    expect(screen.getAllByTestId(/^finish-receipt-points/)).toHaveLength(2);
  });

  it("carries no streak pill any more — the streak lives on Home and Progress (wave 2)", async () => {
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
    expect(screen.queryByTestId("finish-streak")).toBeNull();
    expect(screen.queryByText(strings.streak.finish(1))).toBeNull();
    expect(screen.queryByText(strings.streak.finish(2))).toBeNull();
  });

  it("every close state renders no user-facing text outside strings.ts", async () => {
    useSessionStore.setState({ pendingClose: "outOfTime" });
    const allowed = collectStringValues(strings);
    // Parameterised strings.ts values and dynamic numerals, enumerated.
    allowed.add(strings.finish.outOfTime.headline(fixtureSession.minutes));
    allowed.add(strings.finish.first.next("Full Push-Up", 3));
    allowed.add("+35");
    // The receipt's values, every shape this close can render.
    for (let n = 0; n <= 2; n += 1) {
      allowed.add(strings.finish.receipt.done(n));
      allowed.add(strings.finish.receipt.hard(n));
    }
    allowed.add(strings.finish.receipt.length(fixtureSession.minutes));
    allowed.add(strings.week.progressNoTarget(1).replace(/\.$/, ""));
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    await screen.findByText(
      strings.finish.outOfTime.headline(fixtureSession.minutes),
    );
    await screen.findByTestId("finish-receipt");
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
    mockedApply.mockReturnValue({
      ok: true,
      value: fixtureApplyResultOutcomes(["skipped", "skipped"]),
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
    expect(screen.queryByTestId("finish-receipt-points")).toBeNull();
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
