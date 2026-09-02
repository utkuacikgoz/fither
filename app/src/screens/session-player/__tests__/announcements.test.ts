import { strings } from "../../../copy/strings";
import {
  createPlayer,
  reduce,
  type PlayerState,
} from "../../../session/player-machine";
import { fixturePlayerBlocks } from "../../../test-utils/fixtures";
import { announcementKey, phaseAnnouncement } from "../announcements";

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

  it("work start: the cue the screen shows for that set and side", () => {
    expect(phaseAnnouncement(repWorkState())).toBe("Push through your palms.");

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
      `${strings.player.sides.right}. Breathe steadily.`,
    );
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
