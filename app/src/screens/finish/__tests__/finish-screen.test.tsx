import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { applyResult } from "../../../session/apply-result";
import { createPlayer, reduce } from "../../../session/player-machine";
import { useLedgerStore } from "../../../state/ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useProfileStore } from "../../../state/profile-store";
import { useSessionStore } from "../../../state/session-store";
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
    session: fixtureSession,
    player,
    finish: null,
    saveFailed: false,
  });
}

beforeEach(() => {
  useLedgerStore.setState({ events: [] });
  useProfileStore.setState({ profile: createInitialProfile(), history: { entries: [] } });
  seedFinishedSession();
  mockedApply.mockReturnValue({ ok: true, value: fixtureApplyResult() });
});

describe("FinishScreen", () => {
  it("applies the session once on arrival and shows the points earned", () => {
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(mockedApply).toHaveBeenCalledTimes(1);
    expect(screen.getByText(strings.finish.headline)).toBeTruthy();
    expect(screen.getByText("+35")).toBeTruthy();
    expect(screen.getByText(strings.finish.pointsLabel)).toBeTruthy();
  });

  it("continues via the single button", () => {
    const onContinue = jest.fn();
    const screen = render(<FinishScreen onContinue={onContinue} />);
    fireEvent.press(screen.getByTestId("finish-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("stays calm when saving is unavailable — no points shown, no crash", () => {
    mockedApply.mockReturnValue({ ok: false, reason: "engineUnavailable" });
    const screen = render(<FinishScreen onContinue={jest.fn()} />);
    expect(screen.getByText(strings.errors.saveUnavailable)).toBeTruthy();
    expect(screen.queryByTestId("finish-points")).toBeNull();
    expect(screen.getByTestId("finish-continue")).toBeTruthy();
  });
});
