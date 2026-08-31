import { applyResult } from "../../session/apply-result";
import { createSession } from "../../session/create-session";
import { totalPoints, useLedgerStore } from "../ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useProfileStore } from "../profile-store";
import { useSessionStore } from "../session-store";
import {
  fixtureApplyResult,
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../test-utils/fixtures";

// The engine boundaries are mocked: the engine itself is still a contract
// stub, so the flow is exercised against fixture Sessions/ApplyResults.
jest.mock("../../session/create-session", () => ({ createSession: jest.fn() }));
jest.mock("../../session/apply-result", () => ({ applyResult: jest.fn() }));

const mockedCreate = jest.mocked(createSession);
const mockedApply = jest.mocked(applyResult);

beforeEach(() => {
  useLedgerStore.setState({ events: [] });
  useProfileStore.setState({ profile: createInitialProfile(), history: { entries: [] } });
  useSessionStore.getState().resetSession();
  mockedCreate.mockReturnValue({
    ok: true,
    value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks },
  });
  mockedApply.mockReturnValue({ ok: true, value: fixtureApplyResult() });
});

function playWholeSession() {
  const { dispatchPlayer } = useSessionStore.getState();
  dispatchPlayer({ type: "skipBlock" });
  dispatchPlayer({ type: "skipBlock" });
}

describe("session store", () => {
  it("startSession stores the generated session and a fresh player", () => {
    const result = useSessionStore.getState().startSession(fixturePrompt);
    expect(result.ok).toBe(true);
    const state = useSessionStore.getState();
    expect(state.session).toEqual(fixtureSession);
    expect(state.player?.phase).toEqual({ kind: "blockIntro", blockIndex: 0 });
  });

  it("startSession surfaces failure without touching state", () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noLibrary" });
    const result = useSessionStore.getState().startSession(fixturePrompt);
    expect(result.ok).toBe(false);
    expect(useSessionStore.getState().session).toBeNull();
  });

  it("completeSession routes outcomes through the engine and stores the summary", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    useSessionStore.getState().completeSession();

    expect(mockedApply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { session: fixtureSession, outcomes: ["skipped", "skipped"] },
    );
    const { finish } = useSessionStore.getState();
    expect(finish?.pointsEarned).toBe(35);
    expect(finish?.unlockedSkills).toEqual([
      { pattern: "push", tier: 2, movementName: "Incline Push-Up" },
    ]);
    // Profile/history/ledger updated only from the ApplyResult.
    expect(useProfileStore.getState().profile.patterns.push.tier).toBe(2);
    expect(totalPoints(useLedgerStore.getState().events)).toBe(35);
  });

  it("completeSession is idempotent", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    useSessionStore.getState().completeSession();
    useSessionStore.getState().completeSession();
    expect(mockedApply).toHaveBeenCalledTimes(1);
    expect(useLedgerStore.getState().events).toHaveLength(2);
  });

  it("does nothing before the player is finished", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().completeSession();
    expect(mockedApply).not.toHaveBeenCalled();
  });

  it("marks saveFailed calmly when the engine boundary fails", () => {
    mockedApply.mockReturnValue({ ok: false, reason: "engineUnavailable" });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    useSessionStore.getState().completeSession();
    const state = useSessionStore.getState();
    expect(state.saveFailed).toBe(true);
    expect(state.finish).toBeNull();
    expect(useLedgerStore.getState().events).toHaveLength(0);
  });
});
