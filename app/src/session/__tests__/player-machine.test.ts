import { fixturePlayerBlocks } from "../../test-utils/fixtures";
import {
  completedSets,
  createPlayer,
  isCountingDown,
  isFinished,
  progressFraction,
  reduce,
  totalSets,
  type PlayerEvent,
  type PlayerState,
} from "../player-machine";

function run(state: PlayerState, ...events: PlayerEvent[]): PlayerState {
  return events.reduce(reduce, state);
}

function ticks(n: number): PlayerEvent[] {
  return Array.from({ length: n }, () => ({ type: "tick" }) as PlayerEvent);
}

describe("createPlayer", () => {
  it("starts at the first block intro", () => {
    const state = createPlayer(fixturePlayerBlocks);
    expect(state.phase).toEqual({ kind: "blockIntro", blockIndex: 0 });
    expect(state.outcomes).toEqual([]);
  });

  it("is done immediately with zero blocks", () => {
    const state = createPlayer([]);
    expect(isFinished(state)).toBe(true);
    expect(progressFraction(state)).toBe(1);
  });
});

describe("rep work flow", () => {
  it("intro -> work with no countdown for rep blocks", () => {
    const state = run(createPlayer(fixturePlayerBlocks), { type: "begin" });
    expect(state.phase).toEqual({
      kind: "work",
      blockIndex: 0,
      setIndex: 0,
      remainingSeconds: null,
    });
    expect(isCountingDown(state)).toBe(false);
  });

  it("advance after a non-final set moves to rest with the block's rest time", () => {
    const state = run(createPlayer(fixturePlayerBlocks), { type: "begin" }, { type: "advance" });
    expect(state.phase).toEqual({
      kind: "rest",
      blockIndex: 0,
      setIndex: 0,
      remainingSeconds: 30,
    });
    expect(isCountingDown(state)).toBe(true);
  });

  it("advance after the final set asks the one calm question (no trailing rest)", () => {
    const state = run(
      createPlayer(fixturePlayerBlocks),
      { type: "begin" },
      { type: "advance" },
      ...ticks(30),
      { type: "advance" },
    );
    expect(state.phase).toEqual({ kind: "feedback", blockIndex: 0 });
  });

  it("ignores tick during rep work and advance during hold work", () => {
    const repWork = run(createPlayer(fixturePlayerBlocks), { type: "begin" });
    expect(reduce(repWork, { type: "tick" })).toBe(repWork);

    const holdBlocks = [fixturePlayerBlocks[1]!];
    const holdWork = run(createPlayer(holdBlocks), { type: "begin" });
    expect(reduce(holdWork, { type: "advance" })).toBe(holdWork);
  });
});

describe("hold work timing", () => {
  const holdBlocks = [fixturePlayerBlocks[1]!]; // 1 set × 20s hold

  it("counts down from the hold amount", () => {
    const state = run(createPlayer(holdBlocks), { type: "begin" });
    expect(state.phase).toMatchObject({ kind: "work", remainingSeconds: 20 });
    const after3 = run(state, ...ticks(3));
    expect(after3.phase).toMatchObject({ kind: "work", remainingSeconds: 17 });
  });

  it("takes exactly `amount` ticks to finish a hold set", () => {
    const state = run(createPlayer(holdBlocks), { type: "begin" }, ...ticks(19));
    expect(state.phase.kind).toBe("work");
    const done = reduce(state, { type: "tick" });
    expect(done.phase).toEqual({ kind: "feedback", blockIndex: 0 });
  });
});

describe("rest timing", () => {
  it("takes exactly restSeconds ticks, then starts the next set", () => {
    const resting = run(createPlayer(fixturePlayerBlocks), { type: "begin" }, { type: "advance" });
    const almost = run(resting, ...ticks(29));
    expect(almost.phase).toMatchObject({ kind: "rest", remainingSeconds: 1 });
    const next = reduce(almost, { type: "tick" });
    expect(next.phase).toEqual({
      kind: "work",
      blockIndex: 0,
      setIndex: 1,
      remainingSeconds: null,
    });
  });

  it("lets her end rest early with advance", () => {
    const resting = run(createPlayer(fixturePlayerBlocks), { type: "begin" }, { type: "advance" });
    const next = reduce(resting, { type: "advance" });
    expect(next.phase).toMatchObject({ kind: "work", setIndex: 1 });
  });

  it("skips rest entirely when restSeconds is 0", () => {
    const blocks = [{ ...fixturePlayerBlocks[0]!, restSeconds: 0 }];
    const state = run(createPlayer(blocks), { type: "begin" }, { type: "advance" });
    expect(state.phase).toEqual({
      kind: "work",
      blockIndex: 0,
      setIndex: 1,
      remainingSeconds: null,
    });
  });
});

describe("feedback and outcomes", () => {
  function toFeedback(state: PlayerState): PlayerState {
    // Complete block 0 (2 rep sets with 30s rest between).
    return run(state, { type: "begin" }, { type: "advance" }, ...ticks(30), { type: "advance" });
  }

  it("records completed and moves to the next block intro", () => {
    const state = reduce(toFeedback(createPlayer(fixturePlayerBlocks)), {
      type: "feedback",
      outcome: "completed",
    });
    expect(state.outcomes).toEqual(["completed"]);
    expect(state.phase).toEqual({ kind: "blockIntro", blockIndex: 1 });
  });

  it("records struggled", () => {
    const state = reduce(toFeedback(createPlayer(fixturePlayerBlocks)), {
      type: "feedback",
      outcome: "struggled",
    });
    expect(state.outcomes).toEqual(["struggled"]);
  });

  it("finishes with one outcome per block, in block order", () => {
    let state = toFeedback(createPlayer(fixturePlayerBlocks));
    state = reduce(state, { type: "feedback", outcome: "struggled" });
    state = run(state, { type: "begin" }, ...ticks(20));
    expect(state.phase).toEqual({ kind: "feedback", blockIndex: 1 });
    state = reduce(state, { type: "feedback", outcome: "completed" });
    expect(isFinished(state)).toBe(true);
    expect(state.outcomes).toEqual(["struggled", "completed"]);
  });

  it("ignores skip during feedback — the question gets answered", () => {
    const state = toFeedback(createPlayer(fixturePlayerBlocks));
    expect(reduce(state, { type: "skipBlock" })).toBe(state);
  });
});

describe("skip", () => {
  it("records skipped from the intro and moves on", () => {
    const state = reduce(createPlayer(fixturePlayerBlocks), { type: "skipBlock" });
    expect(state.outcomes).toEqual(["skipped"]);
    expect(state.phase).toEqual({ kind: "blockIntro", blockIndex: 1 });
  });

  it("records skipped mid-work on the last block and finishes", () => {
    let state = reduce(createPlayer(fixturePlayerBlocks), { type: "skipBlock" });
    state = run(state, { type: "begin" }, ...ticks(5), { type: "skipBlock" });
    expect(isFinished(state)).toBe(true);
    expect(state.outcomes).toEqual(["skipped", "skipped"]);
  });
});

describe("done is terminal", () => {
  it("ignores every event after done", () => {
    let state = run(createPlayer(fixturePlayerBlocks), { type: "skipBlock" }, { type: "skipBlock" });
    expect(isFinished(state)).toBe(true);
    for (const event of [
      { type: "begin" },
      { type: "advance" },
      { type: "tick" },
      { type: "skipBlock" },
      { type: "feedback", outcome: "completed" },
    ] as PlayerEvent[]) {
      expect(reduce(state, event)).toBe(state);
    }
  });
});

describe("progress selectors", () => {
  it("counts sets across blocks", () => {
    const state = createPlayer(fixturePlayerBlocks);
    expect(totalSets(state)).toBe(3);
    expect(completedSets(state)).toBe(0);
    expect(progressFraction(state)).toBe(0);
  });

  it("advances the thin line set by set", () => {
    let state = run(createPlayer(fixturePlayerBlocks), { type: "begin" });
    expect(completedSets(state)).toBe(0);
    state = reduce(state, { type: "advance" }); // rest after set 1
    expect(completedSets(state)).toBe(1);
    state = run(state, ...ticks(30), { type: "advance" }); // block 0 feedback
    expect(completedSets(state)).toBe(2);
    state = reduce(state, { type: "feedback", outcome: "completed" });
    expect(completedSets(state)).toBe(2); // intro of block 1
    state = run(state, { type: "begin" }, ...ticks(20), {
      type: "feedback",
      outcome: "completed",
    });
    expect(completedSets(state)).toBe(3);
    expect(progressFraction(state)).toBe(1);
  });
});
