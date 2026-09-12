import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { clearRecordedEvents, recordedEvents, recordedPerson } from "../../analytics/dev-analytics";
import { strings } from "../../copy/strings";
import { capturedErrors, clearCapturedErrors } from "../../monitoring/quiet-monitoring";
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
import { useIntentionStore } from "../intention-store";
import { useReminderStore } from "../reminder-store";
import { INTRO_SECONDS } from "../../session/player-machine";
import { useSessionStore } from "../session-store";
import * as journal from "../completion-journal";
import {
  COMPLETION_STORAGE_KEY,
  readCompletionRecord,
  writeCompletionRecord,
} from "../completion-journal";
import { useSettingsStore } from "../settings-store";
import { startPersonSyncForTest } from "../../test-utils/person-sync";
import {
  fixtureApplyResult,
  fixtureApplyResultOutcomes,
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
// The calendar is pinned to the fixture session's date so the streak the
// invitation names is the one the committed history holds.
jest.mock("../../lib/dates", () => ({ todayIso: () => "2026-08-31" }));

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
  clearRecordedEvents();
  clearCapturedErrors();
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
    expect(state.player?.phase).toEqual({ kind: "blockIntro", blockIndex: 0, remainingSeconds: INTRO_SECONDS });
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
    // The journaled trial decision replays verbatim — same stamp, once.
    expect(useEntitlementStore.getState().trialStartDate).toBe(fixtureSession.date);
    expect((await readCompletionRecord())?.status).toBe("committed");
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
  });

  describe("analytics (ADR-0015)", () => {
    it("workout_start fires on the first real transition, never on a built session", () => {
      useSessionStore.getState().startSession(fixturePrompt);
      expect(recordedEvents()).toEqual([]);
      useSessionStore.getState().dispatchPlayer({ type: "begin" });
      expect(recordedEvents()).toEqual([
        { name: "workout_start", properties: { minutes: 10 } },
      ]);
      // Later transitions and ticks are not a second start.
      useSessionStore.getState().dispatchPlayer({ type: "tick" });
      useSessionStore.getState().dispatchPlayer({ type: "skipBlock" });
      expect(recordedEvents().filter((e) => e.name === "workout_start")).toHaveLength(1);
    });

    it("block_outcome reports each answered block: where in the session, and how", () => {
      useSessionStore.getState().startSession(fixturePrompt);
      const dispatch = useSessionStore.getState().dispatchPlayer;
      dispatch({ type: "begin" });
      // A tick mid-work and a begin at the wrong phase record nothing.
      dispatch({ type: "tick" });
      expect(recordedEvents().filter((e) => e.name === "block_outcome")).toEqual([]);
      // The fixture's first block is rep work: advance through its sets
      // to the feedback question, then answer it.
      let guard = 0;
      while (useSessionStore.getState().player?.phase.kind !== "feedback" && guard < 20) {
        dispatch({ type: "advance" });
        guard += 1;
      }
      // A skip on the feedback question is rejected by the machine: nothing.
      dispatch({ type: "skipBlock" });
      expect(recordedEvents().filter((e) => e.name === "block_outcome")).toEqual([]);
      dispatch({ type: "feedback", outcome: "struggled" });
      // The second block is skipped from its intro.
      dispatch({ type: "skipBlock" });
      expect(recordedEvents().filter((e) => e.name === "block_outcome")).toEqual([
        { name: "block_outcome", properties: { index: 0, total: 2, outcome: "struggled" } },
        { name: "block_outcome", properties: { index: 1, total: 2, outcome: "skipped" } },
      ]);
      expect(useSessionStore.getState().player?.outcomes).toEqual(["struggled", "skipped"]);
    });

    it("block_outcome names a completed answer too, and only hers — never the ceiling wrap's skips", () => {
      useSessionStore.getState().startSession(fixturePrompt);
      const dispatch = useSessionStore.getState().dispatchPlayer;
      dispatch({ type: "begin" });
      let guard = 0;
      while (useSessionStore.getState().player?.phase.kind !== "feedback" && guard < 20) {
        dispatch({ type: "advance" });
        guard += 1;
      }
      // Past the ceiling: her answer counts, the wrap's skip of the
      // remaining block is the clock's and is not reported.
      useSessionStore.setState({
        activeMs: sessionCeilingMs(fixtureSession.minutes) + 1,
        workResumedAt: null,
      });
      dispatch({ type: "feedback", outcome: "completed" });
      expect(useSessionStore.getState().player?.phase.kind).toBe("done");
      expect(useSessionStore.getState().player?.outcomes).toEqual(["completed", "skipped"]);
      expect(recordedEvents().filter((e) => e.name === "block_outcome")).toEqual([
        { name: "block_outcome", properties: { index: 0, total: 2, outcome: "completed" } },
      ]);
    });

    it("a restored mid-session player has already begun — no second workout_start", async () => {
      useSessionStore.getState().startSession(fixturePrompt);
      useSessionStore.getState().dispatchPlayer({ type: "begin" });
      const snapshot = useActiveSessionStore.getState().snapshot;
      if (!snapshot) throw new Error("missing snapshot");
      clearRecordedEvents();
      useSessionStore.getState().resetSession();
      useActiveSessionStore.setState({ snapshot });
      useSessionStore.getState().restoreActiveSession(fixtureSession.date);
      useSessionStore.getState().dispatchPlayer({ type: "tick" });
      expect(recordedEvents()).toEqual([]);
    });

    it("workout_complete reports the close and whether it was her first, once", async () => {
      useSessionStore.getState().startSession(fixturePrompt);
      playWholeSession();
      await useSessionStore.getState().completeSession();
      await useSessionStore.getState().completeSession();
      expect(useSessionStore.getState().finish?.first).toBe(true);
      expect(recordedEvents()).toEqual([
        {
          name: "workout_complete",
          properties: { minutes: 10, close: "completed", first: true, streak: 1 },
        },
        // The fixture result grants one milestone: the pattern and the
        // tier, never the movement's name.
        { name: "skill_unlocked", properties: { pattern: "push", tier: 4 } },
      ]);
    });

    it("skill_unlocked fires once per granted skill, and not at all when none was", async () => {
      mockedApply.mockReturnValue({
        ok: true,
        value: {
          ...fixtureApplyResult(),
          unlockedSkills: [
            { pattern: "push", tier: 4, movementName: "Full Push-Up" },
            { pattern: "core", tier: 2, movementName: "Plank" },
          ],
        },
      });
      useSessionStore.getState().startSession(fixturePrompt);
      playWholeSession();
      await useSessionStore.getState().completeSession();
      expect(recordedEvents().filter((e) => e.name === "skill_unlocked")).toEqual([
        { name: "skill_unlocked", properties: { pattern: "push", tier: 4 } },
        { name: "skill_unlocked", properties: { pattern: "core", tier: 2 } },
      ]);

      clearRecordedEvents();
      useSessionStore.getState().resetSession();
      mockedApply.mockReturnValue({ ok: true, value: { ...fixtureApplyResult(), unlockedSkills: [] } });
      useSessionStore.getState().startSession(fixturePrompt);
      playWholeSession();
      await useSessionStore.getState().completeSession();
      expect(recordedEvents().filter((e) => e.name === "skill_unlocked")).toEqual([]);
    });

    it("the person's facts are synced once the commit lands, from the committed history", async () => {
      const stop = startPersonSyncForTest();
      expect(recordedPerson()).toMatchObject({ sessions_completed: 0, last_minutes: null });
      useSessionStore.getState().startSession(fixturePrompt);
      playWholeSession();
      await useSessionStore.getState().completeSession();
      expect(recordedPerson()).toMatchObject({
        sessions_completed: 1,
        last_minutes: 10,
        signed_in: false,
      });
      stop();
    });

    it("a second-ever session is not 'first'; a replayed journal reports once, a committed one never", async () => {
      useEntitlementStore.setState({ trialStartDate: "2026-08-30" });
      useSessionStore.getState().startSession(fixturePrompt);
      playWholeSession();
      await useSessionStore.getState().completeSession();
      expect(useSessionStore.getState().finish?.first).toBe(false);
      expect(recordedEvents()[0]?.properties).toMatchObject({ first: false });

      clearRecordedEvents();
      useSessionStore.getState().resetSession();
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
      // The pending journal means the commit never landed, so nothing
      // was reported yet: this replay reports it, once.
      await useSessionStore.getState().completeSession();
      expect(recordedEvents().map((e) => e.name)).toEqual(["workout_complete", "skill_unlocked"]);

      // A committed journal has already reported: re-running the
      // completion for it (finish cleared, as after a relaunch) is silent.
      clearRecordedEvents();
      useSessionStore.setState({ finish: null });
      await useSessionStore.getState().completeSession();
      expect(recordedEvents()).toEqual([]);
    });

    it("a save that fails mid-commit reports on the retry, not twice", async () => {
      useSessionStore.getState().startSession(fixturePrompt);
      playWholeSession();
      // The journal is written, then the canonical commit fails once.
      const spy = jest
        .spyOn(journal, "persistCanonicalCompletion")
        .mockRejectedValueOnce(new Error("disk"));
      await useSessionStore.getState().completeSession();
      expect(useSessionStore.getState().saveFailed).toBe(true);
      expect(recordedEvents()).toEqual([]);
      // The owner hears about a failed save (ADR-0016), with the fixed
      // context label and nothing of hers.
      expect(capturedErrors()).toEqual([
        { error: expect.any(Error), context: "completeSession" },
      ]);
      await useSessionStore.getState().completeSession();
      expect(useSessionStore.getState().finish).not.toBeNull();
      expect(recordedEvents().filter((e) => e.name === "workout_complete")).toHaveLength(1);
      spy.mockRestore();
    });
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
    expect(snapshot?.player?.phase).toEqual({ kind: "blockIntro", blockIndex: 0, remainingSeconds: INTRO_SECONDS });
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
            inSetCues: [],
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
    // Zero completed blocks: nothing saved to keep, nothing fabricated.
    expect(mockedApply).not.toHaveBeenCalled();
  });

  // Audit S7: midnight must not discard COMPLETED work.
  async function flushStaleApply() {
    for (let i = 0; i < 20; i += 1) {
      if (useActiveSessionStore.getState().snapshot === null) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  function seedStaleSnapshotWithCompletedWork() {
    const player = {
      ...createPlayer(fixturePlayerBlocks),
      outcomes: ["completed", "skipped"] as const,
    } as ReturnType<typeof createPlayer>;
    useActiveSessionStore.setState({
      snapshot: {
        sessionId: `stale:${fixtureSession.date}`,
        prompt: fixturePrompt,
        session: fixtureSession,
        player,
      },
    });
  }

  it("a previous-day snapshot WITH completed work applies silently under its own date", async () => {
    seedStaleSnapshotWithCompletedWork();
    const result = useSessionStore.getState().restoreActiveSession("2099-01-01");
    // The launch decision is unaffected: today proceeds as normal.
    expect(result).toBe("none");
    expect(useSessionStore.getState().session).toBeNull();
    expect(useSessionStore.getState().finish).toBeNull();
    await flushStaleApply();
    // Applied through the normal journaled path: profile, ledger, and
    // the trial evidence rule, dated by the SNAPSHOT's session.
    expect(mockedApply).toHaveBeenCalledTimes(1);
    const fixture = fixtureApplyResult();
    expect(useProfileStore.getState().profile).toEqual(fixture.profile);
    expect(useLedgerStore.getState().events).toEqual(fixture.ledgerEvents);
    expect(useEntitlementStore.getState().trialStartDate).toBe(
      fixtureSession.date,
    );
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
  });

  it("the silent commit moves the person's facts too", async () => {
    const stop = startPersonSyncForTest();
    seedStaleSnapshotWithCompletedWork();
    useSessionStore.getState().restoreActiveSession("2099-01-01");
    await flushStaleApply();
    // Nothing was said to her, but the same facts moved as on the
    // visible path — and the subscription saw the profile write.
    expect(recordedPerson()).toMatchObject({
      sessions_completed: 1,
      last_minutes: 10,
    });
    stop();
  });

  it("a crash mid-apply replays the identical result — no double award", async () => {
    seedStaleSnapshotWithCompletedWork();
    useSessionStore.getState().restoreActiveSession("2099-01-01");
    await flushStaleApply();
    const eventsAfterFirst = useLedgerStore.getState().events;
    // Simulate the crash-retry: the same snapshot resurfaces (it would
    // only persist if the commit never landed) and restore runs again.
    seedStaleSnapshotWithCompletedWork();
    useSessionStore.getState().restoreActiveSession("2099-01-01");
    await flushStaleApply();
    expect(useLedgerStore.getState().events).toEqual(eventsAfterFirst);
    expect(useActiveSessionStore.getState().snapshot).toBeNull();
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
          inSetCues: [],
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
            inSetCues: [],
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
    mockedApply.mockReturnValue({
      ok: true,
      value: fixtureApplyResultOutcomes(["skipped", "skipped"]),
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

  it("anchors active time at the first work phase, not at the intro", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    expect(useSessionStore.getState().workResumedAt).toBeNull();
    expect(useSessionStore.getState().activeMs).toBe(0);

    // Time spent reading the intro never spends the budget: even far past
    // the ceiling, skipping through intros wraps nothing and banks nothing.
    now += CEILING_MS * 2;
    dispatch({ type: "skipBlock" });
    expect(useSessionStore.getState().player?.phase).toEqual({
      kind: "blockIntro",
      blockIndex: 1,
      remainingSeconds: INTRO_SECONDS,
    });
    expect(useSessionStore.getState().activeMs).toBe(0);

    dispatch({ type: "begin" });
    expect(useSessionStore.getState().workResumedAt).toBe(now);
    expect(useSessionStore.getState().activeMs).toBe(0);
    // The snapshot carries banked active time only — never a wall anchor.
    expect(useActiveSessionStore.getState().snapshot?.activeMs).toBe(0);
  });

  it("banks active time at snapshot boundaries as she trains", () => {
    useSessionStore.getState().startSession(fixturePrompt);
    dispatch({ type: "begin" });
    now += 60_000; // one minute of set 1
    dispatch({ type: "advance" }); // set 1 done → rest: folds the stretch
    expect(useSessionStore.getState().activeMs).toBe(60_000);
    expect(useActiveSessionStore.getState().snapshot?.activeMs).toBe(60_000);

    now += 30_000; // the rest counts while the session is live
    dispatch({ type: "advance" }); // rest ended early → set 2
    expect(useSessionStore.getState().activeMs).toBe(90_000);
    expect(useActiveSessionStore.getState().snapshot?.activeMs).toBe(90_000);
    // The live anchor restarts at each fold; elapsed time never doubles.
    expect(useSessionStore.getState().workResumedAt).toBe(now);
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
      // The default mocked apply's history entry has completed blocks,
      // so completedAnything holds and outOfTime stands, naming her minutes.
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
            inSetCues: [],
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

  it("interrupted at three active minutes, restored hours later: she trains her remaining budget", async () => {
    // Three minutes of actual training, then the process dies at a rest.
    useSessionStore.getState().startSession(fixturePrompt);
    dispatch({ type: "begin" });
    now += 3 * 60_000;
    dispatch({ type: "advance" }); // set 1 done → rest: 3 min banked
    expect(useActiveSessionStore.getState().snapshot?.activeMs).toBe(180_000);
    const snapshot = useActiveSessionStore.getState().snapshot;

    // Relaunch hours later; the resume offer's "Keep going" restores it.
    useSessionStore.getState().resetSession();
    useActiveSessionStore.setState({ snapshot });
    now += 5 * 60 * 60 * 1000;
    const result = useSessionStore
      .getState()
      .restoreActiveSession(fixtureSession.date);
    expect(result).toBe("inProgress");
    // Banked time only: the five away hours never spend her budget, and
    // no live anchor runs until she moves again.
    expect(useSessionStore.getState().activeMs).toBe(180_000);
    expect(useSessionStore.getState().workResumedAt).toBeNull();

    // She trains on — no instant "that's your 10 minutes", no wrap.
    dispatch({ type: "advance" }); // finishes the restored set → feedback
    dispatch({ type: "feedback", outcome: "completed" }); // → next intro
    expect(useSessionStore.getState().player?.phase).toEqual({
      kind: "blockIntro",
      blockIndex: 1,
      remainingSeconds: INTRO_SECONDS,
    });
    expect(useSessionStore.getState().pendingClose).toBeNull();

    // The wrap lands only once ACTIVE time passes the ceiling: 3 banked
    // minutes plus the rest of the budget, plus one second over.
    now += CEILING_MS - 180_000 + 1_000;
    dispatch({ type: "begin" }); // intro → work would start: wraps instead
    expect(useSessionStore.getState().player?.phase).toEqual({ kind: "done" });
    expect(useSessionStore.getState().player?.outcomes).toEqual([
      "completed",
      "skipped",
    ]);
    expect(useSessionStore.getState().pendingClose).toBe("outOfTime");

    await useSessionStore.getState().completeSession();
    expect(useSessionStore.getState().finish?.close).toEqual({
      reason: "outOfTime",
      minutes: fixtureSession.minutes,
    });
  });

  it("a legacy snapshot (wall-clock anchor, no activeMs) restores generously and trains on", () => {
    const player = reduce(createPlayer(fixturePlayerBlocks), { type: "begin" });
    useActiveSessionStore.setState({
      snapshot: {
        sessionId: "legacy-anchor-restore",
        prompt: fixturePrompt,
        session: fixtureSession,
        player,
        countdownEndsAt: null,
        // Pre-active-time shape: one wall anchor, hours before "now".
        workStartedAt: 500_000,
      },
    });
    now = 500_000 + CEILING_MS + 1_000;

    const result = useSessionStore
      .getState()
      .restoreActiveSession(fixtureSession.date);
    expect(result).toBe("inProgress");
    // The anchor can't tell training from hours away, so it banks
    // NOTHING — the generous reading that preserves her session.
    expect(useSessionStore.getState().activeMs).toBe(0);
    expect(useSessionStore.getState().workResumedAt).toBeNull();
    // The re-persisted snapshot converges on the new shape.
    expect(useActiveSessionStore.getState().snapshot?.activeMs).toBe(0);
    expect(useActiveSessionStore.getState().snapshot?.workStartedAt).toBeNull();

    dispatch({ type: "advance" }); // set 1 done → rest: continues, no wrap
    expect(useSessionStore.getState().player?.phase).toMatchObject({
      kind: "rest",
    });
    expect(useSessionStore.getState().pendingClose).toBeNull();
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
            inSetCues: [],
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
  it("stamps the trial start when the first COMPLETED session is applied", async () => {
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    expect(useEntitlementStore.getState().trialStartDate).toBe(fixtureSession.date);
  });

  it("an all-skipped session spends no trial — nothing was completed", async () => {
    // The engine's evidence for "completed anything" is its "session"
    // ledger event; an all-skipped apply carries none, so the trial
    // stays unstarted (ADR-0009 §2: an unused install spends no trial,
    // and skipping through a session is not using it).
    mockedApply.mockReturnValue({
      ok: true,
      value: fixtureApplyResultOutcomes(["skipped", "skipped"]),
    });
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().finishSessionEarly();
    await useSessionStore.getState().completeSession();

    expect(useSessionStore.getState().finish?.completedAnything).toBe(false);
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
  });

  it("the first genuinely completed session after an all-skipped one stamps it", async () => {
    const base = fixtureApplyResult();
    mockedApply.mockReturnValueOnce({
      ok: true,
      value: { ...base, ledgerEvents: [], unlockedSkills: [] },
    });
    useSessionStore.getState().startSession(fixturePrompt);
    useSessionStore.getState().finishSessionEarly();
    await useSessionStore.getState().completeSession();
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();

    // Later, a session with real completed work: the trial starts here.
    useSessionStore.getState().resetSession();
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    expect(useEntitlementStore.getState().trialStartDate).toBe(
      fixtureSession.date,
    );
  });

  it("replaying a journaled all-skipped completion reaches the same no-trial decision", async () => {
    // Crash-replay path: the record's STORED decision is replayed
    // verbatim — never re-derived from ambient state — so a retry can
    // neither invent nor lose a trial start.
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    const sessionId = useSessionStore.getState().sessionId;
    if (!sessionId) throw new Error("missing session id");
    const base = fixtureApplyResult();
    const skippedEntry = {
      ...base.history.entries[0]!,
      blocks: base.history.entries[0]!.blocks.map((b) => ({ ...b, outcome: "skipped" as const })),
    };
    await writeCompletionRecord({
      version: 1,
      status: "pending",
      sessionId,
      result: {
        ...base,
        history: { entries: [skippedEntry] },
        ledgerEvents: [],
        unlockedSkills: [],
      },
      ledgerEvents: [],
      trialStartDate: null,
      purchase: null,
    });

    await useSessionStore.getState().completeSession();
    expect(mockedApply).not.toHaveBeenCalled();
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
    // The journal's own history entry decides the close (ADR-0023), not
    // the in-memory player that completed every block.
    expect(useSessionStore.getState().finish?.completedAnything).toBe(false);
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

describe("the daily invitation after a commit (ADR-0018)", () => {
  const scheduleAsync = jest.mocked(Notifications.scheduleNotificationAsync);
  const cancelAsync = jest.mocked(Notifications.cancelAllScheduledNotificationsAsync);
  const getPermissionAsync = jest.mocked(Notifications.getPermissionsAsync);

  function granted() {
    getPermissionAsync.mockResolvedValue({
      status: "granted",
      granted: true,
      canAskAgain: true,
    } as unknown as Notifications.NotificationPermissionsStatus);
  }

  async function flushReschedule() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    useReminderStore.setState({ slot: null, asked: true, hydrated: true });
  });

  afterEach(() => {
    useReminderStore.setState({ slot: null });
  });

  it("re-schedules her slot with the week body once the commit has landed", async () => {
    useReminderStore.setState({ slot: "evening" });
    useIntentionStore.setState({ target: 2, asked: true, hydrated: true });
    granted();
    // The history the scheduler read from: captured at the moment of the
    // first schedule call, to prove the profile store was written first.
    let entriesSeen = -1;
    scheduleAsync.mockImplementation(async () => {
      if (entriesSeen < 0) {
        entriesSeen = useProfileStore.getState().history.entries.length;
      }
      return "notification-id";
    });

    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    await flushReschedule();

    expect(useSessionStore.getState().finish?.completedAnything).toBe(true);
    expect(cancelAsync).toHaveBeenCalledTimes(1);
    expect(scheduleAsync).toHaveBeenCalledTimes(7);
    expect(entriesSeen).toBe(1);
    // Trained today, 1 of 2 this week: the body carries the count the
    // commit just wrote, never a streak line.
    const bodies = scheduleAsync.mock.calls.map(([r]) => r.content.body);
    expect(bodies).toContain(strings.notifications.weekly.onTrack(1, 2));
    expect(bodies).not.toContain(strings.streak.notification.nextDay(2));
    for (const [request] of scheduleAsync.mock.calls) {
      expect(request.trigger).toMatchObject({ hour: 18, minute: 30 });
    }
  });

  it("schedules nothing when no slot is chosen", async () => {
    granted();
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    await flushReschedule();
    expect(getPermissionAsync).not.toHaveBeenCalled();
    expect(scheduleAsync).not.toHaveBeenCalled();
  });

  it("schedules nothing when the OS permission is not granted", async () => {
    useReminderStore.setState({ slot: "morning" });
    getPermissionAsync.mockResolvedValue({
      status: "denied",
      granted: false,
      canAskAgain: false,
    } as unknown as Notifications.NotificationPermissionsStatus);
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    await flushReschedule();
    expect(scheduleAsync).not.toHaveBeenCalled();
    expect(useSessionStore.getState().finish).not.toBeNull();
  });

  it("a scheduling failure never touches the finish flow", async () => {
    useReminderStore.setState({ slot: "midday" });
    granted();
    cancelAsync.mockRejectedValue(new Error("native down"));
    useSessionStore.getState().startSession(fixturePrompt);
    playWholeSession();
    await useSessionStore.getState().completeSession();
    await flushReschedule();
    const state = useSessionStore.getState();
    expect(state.finish?.pointsEarned).toBe(35);
    expect(state.saveFailed).toBe(false);
    expect(capturedErrors).toHaveLength(0);
    // The reminder store keeps her slot: the next commit tries again.
    expect(useReminderStore.getState().slot).toBe("midday");
  });
});
