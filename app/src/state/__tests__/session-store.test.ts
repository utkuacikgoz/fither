import AsyncStorage from "@react-native-async-storage/async-storage";

import { firstMovementTracker } from "../../lib/first-movement-timer";
import { applyResult } from "../../session/apply-result";
import { createSession } from "../../session/create-session";
import {
  createPlayer,
  finishEarly,
  reduce,
  sessionCeilingMs,
} from "../../session/player-machine";
import { useActiveSessionStore } from "../active-session-store";
import { useEntitlementStore } from "../entitlement-store";
import { useFirstMovementStore } from "../first-movement-store";
import { totalPoints, useLedgerStore } from "../ledger-store";
import { createInitialProfile } from "@fither/engine";
import { useProfileStore } from "../profile-store";
import { useSessionStore } from "../session-store";
import {
  COMPLETION_STORAGE_KEY,
  readCompletionRecord,
  writeCompletionRecord,
} from "../completion-journal";
import { useSettingsStore } from "../settings-store";
import {
  fixtureApplyResult,
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../test-utils/fixtures";

// The engine boundaries are mocked: the engine itself is still a contract
// stub, so the flow is exercised against fixture Sessions/ApplyResults.
jest.mock("../../session/create-session", () => ({
  ...jest.requireActual("../../session/create-session"),
  createSession: jest.fn(),
}));
jest.mock("../../session/apply-result", () => ({ applyResult: jest.fn() }));

const mockedCreate = jest.mocked(createSession);
const mockedApply = jest.mocked(applyResult);

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
  useSessionStore.getState().resetSession();
  // Gate 3 instrumentation baseline: tracker disarmed (no t0), no runs.
  // Suites that don't mark a launch exercise the un-instrumented path.
  firstMovementTracker.reset();
  useFirstMovementStore.setState({
    runs: [],
    hydrated: true,
    hydrationFailed: false,
  });
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
  it("startSession stores the generated session and a fresh player", async () => {
    const result = useSessionStore.getState().startSession(fixturePrompt);
    expect(result.ok).toBe(true);
    const state = useSessionStore.getState();
    expect(state.session).toEqual(fixtureSession);
    expect(state.player?.phase).toEqual({ kind: "blockIntro", blockIndex: 0 });
  });

  it("startSession surfaces failure without touching state", async () => {
    mockedCreate.mockReturnValue({ ok: false, reason: "noLibrary" });
    const result = useSessionStore.getState().startSession(fixturePrompt);
    expect(result.ok).toBe(false);
    expect(useSessionStore.getState().session).toBeNull();
  });

  it("completeSession routes outcomes through the engine and stores the summary", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();

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
    // A natural end closes as plain completed.
    expect(finish?.close).toEqual({ reason: "completed" });
    // Profile/history/ledger updated only from the ApplyResult.
    expect(useProfileStore.getState().profile.patterns.push.tier).toBe(4);
    expect(totalPoints(useLedgerStore.getState().events)).toBe(35);
  });

  it("completeSession is idempotent", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    await useSessionStore.getState().completeSession();
    expect(mockedApply).toHaveBeenCalledTimes(1);
    expect(useLedgerStore.getState().events).toHaveLength(2);
  });

  it("replays a journaled completion after a crash without awarding twice", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    const sessionId = useSessionStore.getState().sessionId;
    if (!sessionId) throw new Error("missing session id");
    const result = fixtureApplyResult();
    await writeCompletionRecord({
      version: 1,
      status: "pending",
      sessionId,
      result,
      ledgerEvents: result.ledgerEvents,
      trialStartDate: fixtureSession.date,
      purchase: null,
    });

    await useSessionStore.getState().completeSession();

    expect(mockedApply).not.toHaveBeenCalled();
    expect(useLedgerStore.getState().events).toEqual(result.ledgerEvents);
    expect((await readCompletionRecord())?.status).toBe("committed");
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
  });

  it("does nothing before the player is finished", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    await useSessionStore.getState().completeSession();
    expect(mockedApply).not.toHaveBeenCalled();
  });

  it("marks saveFailed calmly when the engine boundary fails", async () => {
    mockedApply.mockReturnValue({ ok: false, reason: "engineUnavailable" });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    const state = useSessionStore.getState();
    expect(state.saveFailed).toBe(true);
    expect(state.finish).toBeNull();
    expect(useLedgerStore.getState().events).toHaveLength(0);
  });

  it("retries a failed save without double-applying", async () => {
    mockedApply
      .mockReturnValueOnce({ ok: false, reason: "engineUnavailable" })
      .mockReturnValueOnce({ ok: true, value: fixtureApplyResult() });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();

    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().saveFailed).toBe(true);
    await useSessionStore.getState().completeSession();

    expect(mockedApply).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().saveFailed).toBe(false);
    expect(useSessionStore.getState().finish?.pointsEarned).toBe(35);
    expect(useLedgerStore.getState().events).toHaveLength(2);
  });

  it("refuses to start before persisted state is hydrated", async () => {
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

  it("snapshots the session when it starts", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    const snapshot = activeSnapshot();
    expect(snapshot?.session).toEqual(fixtureSession);
    expect(snapshot?.player?.phase).toEqual({ kind: "blockIntro", blockIndex: 0 });
  });

  it("persists on phase transitions and outcome captures, never on ticks", async () => {
    // One hold block so the work phase actually counts down.
    mockedCreate.mockReturnValue({
      ok: true,
      value: {
        session: fixtureSession,
        playerBlocks: [
          {
            movementId: "plank",
            name: "Plank",
            cues: ["Breathe steadily."],
            unilateral: false,
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

  it("clears the snapshot once the session is applied", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().finish).not.toBeNull();
    expect(activeSnapshot()).toBeNull();
  });

  it("keeps the snapshot when the save fails so a relaunch can retry", async () => {
    mockedApply.mockReturnValue({ ok: false, reason: "engineUnavailable" });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().saveFailed).toBe(true);
    expect(activeSnapshot()).not.toBeNull();
  });

  it("resetSession discards the snapshot", async () => {
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

  it("returns none when nothing is persisted", async () => {
    expect(useSessionStore.getState().restoreActiveSession(fixtureSession.date)).toBe(
      "none",
    );
  });

  it("restores a same-day in-progress session for the resume offer", async () => {
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

  it("silently discards a snapshot from a previous day — no mention, no restore", async () => {
    seedSnapshot();
    const result = useSessionStore.getState().restoreActiveSession("2026-09-01");
    expect(result).toBe("none");
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
    expect(useSessionStore.getState().session).toBeNull();
  });

  it("routes a finished-but-unsaved session to the finish path, which applies it", async () => {
    let player = createPlayer(fixturePlayerBlocks);
    player = reduce(player, { type: "skipBlock" });
    player = reduce(player, { type: "skipBlock" });
    seedSnapshot(player);

    const result = useSessionStore
      .getState()
      .restoreActiveSession(fixtureSession.date);
    expect(result).toBe("completedUnsaved");

    // The finish screen's normal save path now applies it (retries too).
    await useSessionStore.getState().completeSession();
    expect(mockedApply).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      session: fixtureSession,
      outcomes: ["skipped", "skipped"],
    });
    expect(useSessionStore.getState().finish).not.toBeNull();
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
  });

  it("refuses to restore before the stores hydrate", async () => {
    seedSnapshot();
    useActiveSessionStore.setState({ hydrated: false });
    expect(useSessionStore.getState().restoreActiveSession(fixtureSession.date)).toBe(
      "none",
    );
    expect(useSessionStore.getState().session).toBeNull();
  });

  it("restores a timed set from its wall-clock deadline instead of restarting it", async () => {
    const player = reduce(
      createPlayer([
        {
          movementId: "plank",
          name: "Plank",
          cues: ["Breathe steadily."],
          unilateral: false,
          sets: 1,
          amount: 20,
          restSeconds: 0,
          timingType: "seconds",
        },
      ]),
      { type: "begin" },
    );
    useActiveSessionStore.setState({
      snapshot: {
        sessionId: "timer-restore",
        prompt: fixturePrompt,
        session: fixtureSession,
        player,
        countdownEndsAt: 21_000,
      },
    });
    jest.spyOn(Date, "now").mockReturnValue(8_000);

    useSessionStore.getState().restoreActiveSession(fixtureSession.date);

    expect(useSessionStore.getState().player?.phase).toMatchObject({
      kind: "work",
      remainingSeconds: 13,
    });
    expect(useSessionStore.getState().countdownEndsAt).toBe(21_000);
    jest.restoreAllMocks();
  });
});

describe("lifecycle-aware countdowns", () => {
  it("catches up from the deadline when the app returns to foreground", async () => {
    mockedCreate.mockReturnValue({
      ok: true,
      value: {
        session: fixtureSession,
        playerBlocks: [
          {
            movementId: "plank",
            name: "Plank",
            cues: ["Breathe steadily."],
            unilateral: false,
            sets: 1,
            amount: 5,
            restSeconds: 0,
            timingType: "seconds",
          },
        ],
      },
    });
    jest.spyOn(Date, "now").mockReturnValue(1_000);
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().dispatchPlayer({ type: "begin" });
    expect(useSessionStore.getState().countdownEndsAt).toBe(6_000);

    useSessionStore.getState().reconcileTimer(4_000);
    expect(useSessionStore.getState().player?.phase).toMatchObject({
      kind: "work",
      remainingSeconds: 2,
    });
    expect(useActiveSessionStore.getState().snapshot?.player.phase).toMatchObject({
      remainingSeconds: 2,
    });

    useSessionStore.getState().reconcileTimer(6_000);
    expect(useSessionStore.getState().player?.phase).toEqual({
      kind: "feedback",
      blockIndex: 0,
    });
    expect(useSessionStore.getState().countdownEndsAt).toBeNull();
    jest.restoreAllMocks();
  });
});

describe("finishSessionEarly", () => {
  it("banks captured outcomes, marks the rest skipped, and snapshots done", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    const dispatch = useSessionStore.getState().dispatchPlayer;
    dispatch({ type: "begin" });
    dispatch({ type: "advance" }); // set 1 done -> rest
    dispatch({ type: "advance" }); // end rest -> set 2
    dispatch({ type: "advance" }); // set 2 done -> feedback
    dispatch({ type: "feedback", outcome: "completed" });

    useSessionStore.getState().finishSessionEarly();
    const { player, pendingClose } = useSessionStore.getState();
    expect(player?.phase).toEqual({ kind: "done" });
    expect(player?.outcomes).toEqual(["completed", "skipped"]);
    // The close reason is captured HERE, where the close happened, and
    // persisted so a crash before the apply keeps the same honest state.
    expect(pendingClose).toBe("endedEarly");
    expect(useActiveSessionStore.getState().snapshot?.player.phase).toEqual({
      kind: "done",
    });
    expect(useActiveSessionStore.getState().snapshot?.pendingClose).toBe(
      "endedEarly",
    );

    // The normal apply path earns whatever the engine grants for it.
    await useSessionStore.getState().completeSession();
    expect(mockedApply).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      session: fixtureSession,
      outcomes: ["completed", "skipped"],
    });
    expect(useSessionStore.getState().finish?.close).toEqual({
      reason: "endedEarly",
    });
  });

  it("an ended-early session with nothing completed closes as nothingDone", async () => {
    const base = fixtureApplyResult();
    mockedApply.mockReturnValue({
      ok: true,
      value: { ...base, ledgerEvents: [], unlockedSkills: [] },
    });
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().finishSessionEarly();
    await useSessionStore.getState().completeSession();
    const { finish } = useSessionStore.getState();
    expect(finish?.completedAnything).toBe(false);
    expect(finish?.close).toEqual({ reason: "nothingDone" });
  });
});

describe("time-budget ceiling (ADR-0012 §2)", () => {
  // Elapsed time is derived from wall-clock anchors, never JS timers, so
  // these tests drive Date.now directly. fixtureSession is 10 minutes:
  // ceiling = 10 × 60 × 1000 × 1.1 (one source: sessionCeilingMs).
  const CEILING_MS = sessionCeilingMs(fixtureSession.minutes);
  let now = 0;

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const dispatch = (event: Parameters<typeof reduce>[1]) =>
    useSessionStore.getState().dispatchPlayer(event);

  it("anchors elapsed time at the first work phase, not at the intro", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    expect(useSessionStore.getState().workStartedAt).toBeNull();

    // Time spent reading the intro never spends the budget: even far past
    // the ceiling, skipping through intros wraps nothing.
    now += CEILING_MS * 2;
    dispatch({ type: "skipBlock" });
    expect(useSessionStore.getState().player?.phase).toEqual({
      kind: "blockIntro",
      blockIndex: 1,
    });

    dispatch({ type: "begin" });
    expect(useSessionStore.getState().workStartedAt).toBe(now);
    expect(useActiveSessionStore.getState().snapshot?.workStartedAt).toBe(now);
  });

  it("wraps at the next phase boundary once elapsed exceeds minutes×60×1.1", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    dispatch({ type: "begin" }); // first work — the anchor
    now += CEILING_MS + 1_000;
    dispatch({ type: "advance" }); // set 1 done → would rest: wraps instead

    const state = useSessionStore.getState();
    expect(state.player?.phase).toEqual({ kind: "done" });
    // Remaining blocks recorded skipped — progression-neutral (§1).
    expect(state.player?.outcomes).toEqual(["skipped", "skipped"]);
    expect(state.pendingClose).toBe("outOfTime");
    // Survives process death: the close travels with the snapshot.
    expect(useActiveSessionStore.getState().snapshot?.pendingClose).toBe(
      "outOfTime",
    );

    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().finish?.close).toEqual(
      // The default mocked apply has a "session" event, so
      // completedAnything holds and outOfTime stands, naming her minutes.
      { reason: "outOfTime", minutes: fixtureSession.minutes },
    );
  });

  it("lets a finished block answer its question first — completed work counts", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    dispatch({ type: "begin" });
    dispatch({ type: "advance" }); // set 1 → rest
    dispatch({ type: "advance" }); // rest → set 2
    now += CEILING_MS + 1_000;
    dispatch({ type: "advance" }); // set 2 done → feedback, NOT a wrap boundary
    expect(useSessionStore.getState().player?.phase).toEqual({
      kind: "feedback",
      blockIndex: 0,
    });

    dispatch({ type: "feedback", outcome: "completed" }); // → wraps at next intro
    const { player, pendingClose } = useSessionStore.getState();
    expect(player?.phase).toEqual({ kind: "done" });
    expect(player?.outcomes).toEqual(["completed", "skipped"]);
    expect(pendingClose).toBe("outOfTime");

    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().finish?.close).toEqual({
      reason: "outOfTime",
      minutes: fixtureSession.minutes,
    });
  });

  it("never wraps mid-count: a running hold ticks to its own end first", () => {
    mockedCreate.mockReturnValue({
      ok: true,
      value: {
        session: fixtureSession,
        playerBlocks: [
          {
            movementId: "plank",
            name: "Plank",
            cues: ["Breathe steadily."],
            unilateral: false,
            sets: 1,
            amount: 3,
            restSeconds: 0,
            timingType: "seconds",
          },
        ],
      },
    });
    useSessionStore.getState().startSession(fixturePrompt);
    dispatch({ type: "begin" }); // hold counting down from 3
    now += CEILING_MS + 1_000;

    dispatch({ type: "tick" }); // mid-count: same position, no wrap
    expect(useSessionStore.getState().player?.phase).toMatchObject({
      kind: "work",
      remainingSeconds: 2,
    });

    dispatch({ type: "tick" });
    dispatch({ type: "tick" }); // hold ends → feedback (excluded boundary)
    expect(useSessionStore.getState().player?.phase).toEqual({
      kind: "feedback",
      blockIndex: 0,
    });
  });

  it("holds across backgrounding: wall-clock reconciliation fires the wrap at the boundary", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    dispatch({ type: "begin" });
    dispatch({ type: "advance" }); // set 1 done → rest (30s countdown persisted)
    expect(useSessionStore.getState().countdownEndsAt).toBe(now + 30_000);

    // She backgrounds; the app returns long past the ceiling. The rest
    // ran out while away — reconciliation reaches the next boundary
    // (rep work) and the wrap lands there, from persisted anchors only.
    now += CEILING_MS + 60_000;
    useSessionStore.getState().reconcileTimer(now);

    const state = useSessionStore.getState();
    expect(state.player?.phase).toEqual({ kind: "done" });
    expect(state.pendingClose).toBe("outOfTime");
    expect(state.countdownEndsAt).toBeNull();
    expect(useActiveSessionStore.getState().snapshot?.pendingClose).toBe(
      "outOfTime",
    );
  });

  it("survives process death: the persisted anchor drives the wrap after restore", () => {
    const player = reduce(createPlayer(fixturePlayerBlocks), { type: "begin" });
    useActiveSessionStore.setState({
      snapshot: {
        sessionId: "ceiling-restore",
        prompt: fixturePrompt,
        session: fixtureSession,
        player,
        countdownEndsAt: null,
        workStartedAt: 500_000, // long before "now"
      },
    });
    now = 500_000 + CEILING_MS + 1_000;

    const result = useSessionStore
      .getState()
      .restoreActiveSession(fixtureSession.date);
    expect(result).toBe("inProgress");
    expect(useSessionStore.getState().workStartedAt).toBe(500_000);

    dispatch({ type: "advance" }); // her next transition wraps
    expect(useSessionStore.getState().player?.phase).toEqual({ kind: "done" });
    expect(useSessionStore.getState().pendingClose).toBe("outOfTime");
  });

  it("restores a crash-persisted early close and keeps its reason through the apply", async () => {
    let player = createPlayer(fixturePlayerBlocks);
    player = reduce(player, { type: "begin" });
    player = reduce(player, { type: "advance" });
    player = reduce(player, { type: "advance" });
    player = reduce(player, { type: "advance" });
    player = reduce(player, { type: "feedback", outcome: "completed" });
    player = finishEarly(player);
    useActiveSessionStore.setState({
      snapshot: {
        sessionId: "ended-early-restore",
        prompt: fixturePrompt,
        session: fixtureSession,
        player,
        countdownEndsAt: null,
        pendingClose: "endedEarly",
      },
    });

    const result = useSessionStore
      .getState()
      .restoreActiveSession(fixtureSession.date);
    expect(result).toBe("completedUnsaved");
    expect(useSessionStore.getState().pendingClose).toBe("endedEarly");

    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().finish?.close).toEqual({
      reason: "endedEarly",
    });
  });

  it("a session finished inside its budget never wraps and closes completed", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    dispatch({ type: "begin" });
    now += 60_000; // one minute in — well inside the ceiling
    dispatch({ type: "advance" });
    dispatch({ type: "advance" });
    dispatch({ type: "advance" });
    dispatch({ type: "feedback", outcome: "completed" });
    dispatch({ type: "begin" });
    for (let i = 0; i < 20; i += 1) dispatch({ type: "tick" });
    dispatch({ type: "feedback", outcome: "completed" });

    expect(useSessionStore.getState().player?.phase).toEqual({ kind: "done" });
    expect(useSessionStore.getState().pendingClose).toBeNull();

    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().finish?.close).toEqual({
      reason: "completed",
    });
  });
});

describe("Gate 3 capture at the dispatch boundary", () => {
  // No real clocks: t0 is injected via the tracker, t1 via a frozen
  // Date.now — the only clock the wiring reads, and only on capture.
  const T0 = 1_000;
  const T1 = 43_500;

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(T1);
    firstMovementTracker.markLaunch(T0);
    firstMovementTracker.markFirstRun(true);
  });

  afterEach(() => {
    jest.restoreAllMocks(); // un-freeze Date.now for the other suites
  });

  function recordedRuns() {
    return useFirstMovementStore.getState().runs;
  }

  it("records exactly one labelled run, at the first work entry only", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    expect(recordedRuns()).toHaveLength(0); // blockIntro is not moving

    useSessionStore.getState().dispatchPlayer({ type: "begin" });
    expect(recordedRuns()).toEqual([
      { t0: T0, t1: T1, deltaMs: T1 - T0, firstRun: true },
    ]);

    // Walk into rest and back into work: still one run.
    useSessionStore.getState().dispatchPlayer({ type: "advance" }); // set 1 -> rest
    useSessionStore.getState().dispatchPlayer({ type: "advance" }); // rest -> set 2
    expect(recordedRuns()).toHaveLength(1);
  });

  it("never writes on countdown ticks after the capture", async () => {
    // One hold block so work actually counts down.
    mockedCreate.mockReturnValue({
      ok: true,
      value: {
        session: fixtureSession,
        playerBlocks: [
          {
            movementId: "plank",
            name: "Plank",
            cues: ["Breathe steadily."],
            unilateral: false,
            sets: 1,
            amount: 5,
            restSeconds: 0,
            timingType: "seconds",
          },
        ],
      },
    });
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().dispatchPlayer({ type: "begin" });
    const afterCapture = recordedRuns();
    expect(afterCapture).toHaveLength(1);

    const timingWrites = () =>
      jest
        .mocked(AsyncStorage.setItem)
        .mock.calls.filter(([key]) => key === "fither/first-movement-v1").length;
    const writesAfterCapture = timingWrites();

    for (let i = 0; i < 4; i += 1) {
      useSessionStore.getState().dispatchPlayer({ type: "tick" });
    }
    // Ticks change nothing: same state object, no storage writes.
    expect(recordedRuns()).toBe(afterCapture);
    expect(timingWrites()).toBe(writesAfterCapture);
  });

  it("labels a non-first-run launch as such", async () => {
    firstMovementTracker.reset();
    firstMovementTracker.markLaunch(T0);
    firstMovementTracker.markFirstRun(false);

    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().dispatchPlayer({ type: "begin" });
    expect(recordedRuns()).toEqual([
      { t0: T0, t1: T1, deltaMs: T1 - T0, firstRun: false },
    ]);
  });

  it("records nothing when the session is skipped through without moving", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().dispatchPlayer({ type: "skipBlock" });
    useSessionStore.getState().dispatchPlayer({ type: "skipBlock" });
    expect(useSessionStore.getState().player?.phase).toEqual({ kind: "done" });
    expect(recordedRuns()).toHaveLength(0);
  });

  it("a restored mid-session launch captures at its next work entry", async () => {
    // She relaunched mid-workout: the snapshot restores directly into a
    // work phase without a dispatch, so the capture lands on the first
    // dispatch that finds the machine in work again.
    let player = createPlayer(fixturePlayerBlocks);
    player = reduce(player, { type: "begin" }); // work, set 1 (reps)
    useActiveSessionStore.setState({
      snapshot: { prompt: fixturePrompt, session: fixtureSession, player },
    });
    useSessionStore.getState().restoreActiveSession(fixtureSession.date);
    expect(recordedRuns()).toHaveLength(0); // restore alone is not a dispatch

    useSessionStore.getState().dispatchPlayer({ type: "advance" }); // set 1 -> rest
    expect(recordedRuns()).toHaveLength(0);
    useSessionStore.getState().dispatchPlayer({ type: "advance" }); // rest -> set 2
    expect(recordedRuns()).toHaveLength(1);
  });
});

describe("trial start (ADR-0009 §2 — app-layer policy, never engine)", () => {
  it("stamps the trial start when the first session is applied", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    expect(useEntitlementStore.getState().trialStartDate).toBe(fixtureSession.date);
  });

  it("never moves an already-stamped trial start", async () => {
    useEntitlementStore.setState({ trialStartDate: "2026-08-01" });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    expect(useEntitlementStore.getState().trialStartDate).toBe("2026-08-01");
  });

  it("a failed save spends no trial — only a landed apply counts", async () => {
    mockedApply.mockReturnValue({ ok: false, reason: "engineUnavailable" });
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
  });

  it("refuses to start a session before the entitlement store hydrates", async () => {
    useEntitlementStore.setState({ hydrated: false });
    const result = useSessionStore.getState().startSession(fixturePrompt);
    expect(result).toEqual({ ok: false, reason: "notReady" });
  });
});
