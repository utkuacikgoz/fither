import { strings } from "../../../copy/strings";
import {
  createPlayer,
  reduce,
  type PlayerState,
} from "../../../session/player-machine";
import { fixturePlayerBlocks } from "../../../test-utils/fixtures";
import { announcementKey, countdownLine, phaseAnnouncement, workCue } from "../announcements";

// The pure half of the VoiceOver work (audit P0 #6): one key per machine
// position so the screen announces transitions exactly once, and every
// announcement composed from strings.player / strings.finish plus block
// data — no invented copy.

function repWorkState(): PlayerState {
  return reduce(createPlayer(fixturePlayerBlocks), { type: "begin" });
}

describe("announcementKey", () => {
  it("keeps its key across countdown ticks", () => {
    // Rep block: set done → rest 30s.
    const resting = reduce(repWorkState(), { type: "advance" });
    expect(resting.phase.kind).toBe("rest");
    const ticked = reduce(resting, { type: "tick" });
    expect(announcementKey(ticked)).toBe(announcementKey(resting));
  });

  it("changes on every phase transition, including set and side", () => {
    const intro = createPlayer(fixturePlayerBlocks);
    const work = reduce(intro, { type: "begin" });
    const rest = reduce(work, { type: "advance" });
    const work2 = reduce(rest, { type: "advance" });
    const keys = [intro, work, rest, work2].map(announcementKey);
    expect(new Set(keys).size).toBe(keys.length);

    // Unilateral: left, switch and right are three distinct positions.
    const unilateral = createPlayer([
      { ...fixturePlayerBlocks[1]!, unilateral: true, amount: 2 },
    ]);
    const left = reduce(unilateral, { type: "begin" });
    const doneLeft = reduce(reduce(left, { type: "tick" }), { type: "tick" });
    expect(doneLeft.phase.kind).toBe("sideSwitch");
    const right = reduce(doneLeft, { type: "advance" });
    const sideKeys = [left, doneLeft, right].map(announcementKey);
    expect(new Set(sideKeys).size).toBe(sideKeys.length);
  });
});

describe("phaseAnnouncement", () => {
  it("block intro: movement name plus the prescription line", () => {
    expect(phaseAnnouncement(createPlayer(fixturePlayerBlocks))).toBe(
      `Wall Push-Up. ${strings.player.blockPlan(2, 8, false, false)}`,
    );
  });

  it("work start: the in-set correction the screen shows for that set and side", () => {
    expect(phaseAnnouncement(repWorkState())).toBe("Elbows back, not out.");

    const right = reduce(
      reduce(
        reduce(
          createPlayer([{ ...fixturePlayerBlocks[1]!, unilateral: true, amount: 1 }]),
          { type: "begin" },
        ),
        { type: "tick" },
      ),
      { type: "advance" },
    );
    expect(right.phase.kind).toBe("work");
    expect(phaseAnnouncement(right)).toBe(
      `${strings.player.sides.right}. Ribs down, keep breathing.`,
    );
  });

  it("work rotates the in-set corrections per set, one each, never the setup cues", () => {
    const block = { ...fixturePlayerBlocks[0]!, sets: 3, inSetCues: ["First fix", "Second fix"] };
    let state = reduce(createPlayer([block]), { type: "begin" });
    expect(workCue(state)).toBe("First fix");
    state = reduce(reduce(state, { type: "advance" }), { type: "advance" }); // rest → set 2
    expect(state.phase).toMatchObject({ kind: "work", setIndex: 1 });
    expect(workCue(state)).toBe("Second fix");
    state = reduce(reduce(state, { type: "advance" }), { type: "advance" }); // rest → set 3
    expect(state.phase).toMatchObject({ kind: "work", setIndex: 2 });
    expect(workCue(state)).toBe("First fix");
    expect(block.cues).not.toContain(workCue(state));
  });

  it("work falls back to the setup cues only for a block with no in-set corrections", () => {
    const block = { ...fixturePlayerBlocks[0]!, inSetCues: [] };
    const state = reduce(createPlayer([block]), { type: "begin" });
    expect(workCue(state)).toBe("Push through your palms.");
    expect(workCue(reduce(createPlayer([{ ...block, cues: [] }]), { type: "begin" }))).toBeNull();
  });

  it("side switch: the switch instruction", () => {
    const switching = reduce(
      reduce(
        createPlayer([{ ...fixturePlayerBlocks[1]!, unilateral: true, amount: 1 }]),
        { type: "begin" },
      ),
      { type: "tick" },
    );
    expect(switching.phase.kind).toBe("sideSwitch");
    expect(phaseAnnouncement(switching)).toBe(
      `${strings.player.sides.switchTitle}. ${strings.player.sides.switchBody}`,
    );
  });

  it("rest start: rest plus the seconds she is entering with", () => {
    const resting = reduce(repWorkState(), { type: "advance" });
    expect(resting.phase.kind).toBe("rest");
    expect(phaseAnnouncement(resting)).toBe(
      `${strings.player.rest}. 30 ${strings.player.holdLabel}`,
    );
  });

  it("feedback stays silent — its question carries its own copy", () => {
    const machine = createPlayer([{ ...fixturePlayerBlocks[0]!, sets: 1 }]);
    const atFeedback = reduce(reduce(machine, { type: "begin" }), {
      type: "advance",
    });
    expect(atFeedback.phase.kind).toBe("feedback");
    expect(phaseAnnouncement(atFeedback)).toBeNull();
  });

  it("done is silent here — the finish screen announces the honest close", () => {
    const done = reduce(createPlayer([fixturePlayerBlocks[0]!]), {
      type: "skipBlock",
    });
    expect(done.phase.kind).toBe("done");
    expect(phaseAnnouncement(done)).toBeNull();
  });
});

describe("countdownLine", () => {
  const tick = (state: ReturnType<typeof createPlayer>, times: number) => {
    let next = state;
    for (let i = 0; i < times; i += 1) next = reduce(next, { type: "tick" });
    return next;
  };

  it("counts the last five seconds of a timed hold, the five as the warning", () => {
    // Fixture block 1: a 20-second hold.
    let state = reduce(createPlayer([fixturePlayerBlocks[1]!]), { type: "begin" });
    expect(countdownLine(state)).toBeNull(); // 20
    state = tick(state, 14);
    expect(countdownLine(state)).toBeNull(); // 6
    state = tick(state, 1);
    expect(countdownLine(state)).toBe(strings.player.countdown(5));
    const lines = [countdownLine(state)];
    for (let i = 0; i < 4; i += 1) {
      state = tick(state, 1);
      lines.push(countdownLine(state));
    }
    expect(lines).toEqual([5, 4, 3, 2, 1].map((n) => strings.player.countdown(n as 1 | 2 | 3 | 4 | 5)));
  });

  it("counts the last five seconds of a rest the same way", () => {
    // Fixture block 0: reps, 30 seconds of rest after set 1.
    let state = reduce(reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }), { type: "advance" });
    expect(state.phase.kind).toBe("rest");
    expect(countdownLine(state)).toBeNull();
    state = tick(state, 25);
    expect(countdownLine(state)).toBe(strings.player.countdown(5));
    state = tick(state, 4);
    expect(countdownLine(state)).toBe(strings.player.countdown(1));
  });

  it("says nothing on rep work, and never on a count's first second", () => {
    expect(countdownLine(reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }))).toBeNull();
    // A 5-second hold starts at its own warning second: the start cue owns it.
    const short = reduce(createPlayer([{ ...fixturePlayerBlocks[1]!, amount: 5 }]), { type: "begin" });
    expect(countdownLine(short)).toBeNull();
    expect(countdownLine(tick(short, 1))).toBe(strings.player.countdown(4));
  });
});
