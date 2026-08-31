import AsyncStorage from "@react-native-async-storage/async-storage";

import { applyResult } from "../../session/apply-result";
import { createSession } from "../../session/create-session";
import { createPlayer, reduce } from "../../session/player-machine";
import { useActiveSessionStore } from "../active-session-store";
import { totalPoints, useLedgerStore } from "../ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useProfileStore } from "../profile-store";
import { useSessionStore } from "../session-store";
import { useSettingsStore } from "../settings-store";
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
  useSessionStore.getState().resetSession();
  mockedCreate.mockReturnValue({
    ok: true,
    value: { session: fixtureSession, playerBlocks: fixturePlayerBlocks },
  });
  mockedApply.mockReturnValue({ ok: true, value: fixtureApplyResult() });
});

function playWholeSession() {
  const player = useSessionStore.getState().player;
  if (!player) throw new Error("missing fixture player");
  useSessionStore.setState({
    player: {
      ...player,
      phase: { kind: "done" },
      outcomes: ["completed", "completed"],
    },
  });
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
      { session: fixtureSession, outcomes: ["completed", "completed"] },
    );
    const { finish } = useSessionStore.getState();
    expect(finish?.pointsEarned).toBe(35);
    expect(finish?.unlockedSkills).toEqual([
      { pattern: "push", tier: 4, movementName: "Full Push-Up" },
    ]);
    // Profile/history/ledger updated only from the ApplyResult.
    expect(useProfileStore.getState().profile.patterns.push.tier).toBe(4);
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

  it("retries a failed save without double-applying", () => {
    mockedApply
      .mockReturnValueOnce({ ok: false, reason: "engineUnavailable" })
      .mockReturnValueOnce({ ok: true, value: fixtureApplyResult() });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();

    useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().saveFailed).toBe(true);
    useSessionStore.getState().completeSession();

    expect(mockedApply).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().saveFailed).toBe(false);
    expect(useSessionStore.getState().finish?.pointsEarned).toBe(35);
    expect(useLedgerStore.getState().events).toHaveLength(2);
  });

  it("refuses to start before persisted state is hydrated", () => {
    useProfileStore.setState({ hydrated: false });
    const result = useSessionStore.getState().startSession(fixturePrompt);
    expect(result).toEqual({ ok: false, reason: "notReady" });
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe("crash-safe persistence (S3)", () => {
  function activeSnapshot() {
    return useActiveSessionStore.getState().snapshot;
  }

  it("snapshots the session when it starts", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    const snapshot = activeSnapshot();
    expect(snapshot?.session).toEqual(fixtureSession);
    expect(snapshot?.player?.phase).toEqual({ kind: "blockIntro", blockIndex: 0 });
  });

  it("persists on phase transitions and outcome captures, never on ticks", () => {
    // One hold block so the work phase actually counts down.
    mockedCreate.mockReturnValue({
      ok: true,
      value: {
        session: fixtureSession,
        playerBlocks: [
          {
            movementId: "plank",
            name: "Plank",
            cue: "Breathe steadily.",
            sets: 1,
            amount: 5,
            restSeconds: 0,
            timingType: "seconds",
          },
        ],
      },
    });
    useSessionStore.getState().startSession(fixturePrompt);

    const save = jest.fn(useActiveSessionStore.getState().save);
    useActiveSessionStore.setState({ save });
    const storageWrites = () =>
      jest
        .mocked(AsyncStorage.setItem)
        .mock.calls.filter(([key]) => key === "fither/active-session-v1").length;
    const writesBefore = storageWrites();

    useSessionStore.getState().dispatchPlayer({ type: "begin" });
    expect(save).toHaveBeenCalledTimes(1); // intro -> work is a transition

    for (let i = 0; i < 4; i += 1) {
      useSessionStore.getState().dispatchPlayer({ type: "tick" });
    }
    // Four countdown ticks: no snapshot writes, in memory or storage.
    expect(save).toHaveBeenCalledTimes(1);
    expect(storageWrites()).toBe(writesBefore + 1);

    // The fifth tick ends the hold -> feedback: that IS a transition.
    useSessionStore.getState().dispatchPlayer({ type: "tick" });
    expect(save).toHaveBeenCalledTimes(2);
    expect(storageWrites()).toBe(writesBefore + 2);

    useSessionStore.getState().dispatchPlayer({ type: "feedback", outcome: "completed" });
    expect(save).toHaveBeenCalledTimes(3); // outcome captured
    expect(activeSnapshot()?.player.outcomes).toEqual(["completed"]);
  });

  it("round-trips the snapshot through AsyncStorage under its own key", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    const raw = await AsyncStorage.getItem("fither/active-session-v1");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as {
      state: { snapshot: { session: { date: string } } };
    };
    expect(persisted.state.snapshot.session.date).toBe(fixtureSession.date);
  });

  it("clears the snapshot once the session is applied", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().finish).not.toBeNull();
    expect(activeSnapshot()).toBeNull();
  });

  it("keeps the snapshot when the save fails so a relaunch can retry", () => {
    mockedApply.mockReturnValue({ ok: false, reason: "engineUnavailable" });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().saveFailed).toBe(true);
    expect(activeSnapshot()).not.toBeNull();
  });

  it("resetSession discards the snapshot", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().resetSession();
    expect(activeSnapshot()).toBeNull();
  });
});

describe("restoreActiveSession", () => {
  function seedSnapshot(player = createPlayer(fixturePlayerBlocks)) {
    useActiveSessionStore.setState({
      snapshot: { prompt: fixturePrompt, session: fixtureSession, player },
    });
    return player;
  }

  it("returns none when nothing is persisted", () => {
    expect(useSessionStore.getState().restoreActiveSession(fixtureSession.date)).toBe(
      "none",
    );
  });

  it("restores a same-day in-progress session for the resume offer", () => {
    const player = seedSnapshot(
      reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }),
    );
    const result = useSessionStore
      .getState()
      .restoreActiveSession(fixtureSession.date);
    expect(result).toBe("inProgress");
    const state = useSessionStore.getState();
    expect(state.session).toEqual(fixtureSession);
    expect(state.player).toEqual(player);
    expect(state.finish).toBeNull();
  });

  it("silently discards a snapshot from a previous day — no mention, no restore", () => {
    seedSnapshot();
    const result = useSessionStore.getState().restoreActiveSession("2026-09-01");
    expect(result).toBe("none");
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
    expect(useSessionStore.getState().session).toBeNull();
  });

  it("routes a finished-but-unsaved session to the finish path, which applies it", () => {
    let player = createPlayer(fixturePlayerBlocks);
    player = reduce(player, { type: "skipBlock" });
    player = reduce(player, { type: "skipBlock" });
    seedSnapshot(player);

    const result = useSessionStore
      .getState()
      .restoreActiveSession(fixtureSession.date);
    expect(result).toBe("completedUnsaved");

    // The finish screen's normal save path now applies it (retries too).
    useSessionStore.getState().completeSession();
    expect(mockedApply).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      session: fixtureSession,
      outcomes: ["skipped", "skipped"],
    });
    expect(useSessionStore.getState().finish).not.toBeNull();
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
  });

  it("refuses to restore before the stores hydrate", () => {
    seedSnapshot();
    useActiveSessionStore.setState({ hydrated: false });
    expect(useSessionStore.getState().restoreActiveSession(fixtureSession.date)).toBe(
      "none",
    );
    expect(useSessionStore.getState().session).toBeNull();
  });
});

describe("finishSessionEarly", () => {
  it("banks captured outcomes, marks the rest skipped, and snapshots done", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    const dispatch = useSessionStore.getState().dispatchPlayer;
    dispatch({ type: "begin" });
    dispatch({ type: "advance" }); // set 1 done -> rest
    dispatch({ type: "advance" }); // end rest -> set 2
    dispatch({ type: "advance" }); // set 2 done -> feedback
    dispatch({ type: "feedback", outcome: "completed" });

    useSessionStore.getState().finishSessionEarly();
    const { player } = useSessionStore.getState();
    expect(player?.phase).toEqual({ kind: "done" });
    expect(player?.outcomes).toEqual(["completed", "skipped"]);
    expect(useActiveSessionStore.getState().snapshot?.player.phase).toEqual({
      kind: "done",
    });

    // The normal apply path earns whatever the engine grants for it.
    useSessionStore.getState().completeSession();
    expect(mockedApply).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      session: fixtureSession,
      outcomes: ["completed", "skipped"],
    });
  });
});
