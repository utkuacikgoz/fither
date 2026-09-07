import { weekParticipation, type HistoryEntry, type WeeklyTarget } from "@fither/engine";

import { strings } from "../../copy/strings";
import { invitationBody } from "../invitation-body";

// Pure wording from the week view's facts: the engine's participation
// and the intention. Nothing here derives either.

// 2026-09-07 is a Monday; the week runs to Sunday the 13th.
const MON = "2026-09-07";
const TUE = "2026-09-08";
const WED = "2026-09-09";
const THU = "2026-09-10";

function trainedOn(date: string): HistoryEntry {
  return {
    date,
    minutes: 10,
    blocks: [{ movementId: "wall-push-up", pattern: "push", outcome: "completed" }],
  };
}

function facts(entries: HistoryEntry[], today: string, target: WeeklyTarget) {
  return {
    participation: weekParticipation(entries, today),
    target,
    hasHistory: entries.length > 0,
  };
}

const GENERIC = Object.values(strings.notifications.daily);

describe("invitationBody", () => {
  it("on track: the count so far and what today's session would make it", () => {
    expect(invitationBody(facts([trainedOn(MON)], TUE, 3))).toBe(
      strings.notifications.weekly.onTrack(1, 3),
    );
    expect(invitationBody(facts([trainedOn(MON), trainedOn(TUE)], WED, 3))).toBe(
      strings.notifications.weekly.onTrack(2, 3),
    );
  });

  it("on track at zero this week with history from an earlier week: the first of the target", () => {
    // Last week's sessions are history; this week has none yet.
    expect(invitationBody(facts([trainedOn("2026-09-02")], MON, 2))).toBe(
      strings.notifications.weekly.onTrack(0, 2),
    );
  });

  it("met: the target is reached, and a further session counts just as much", () => {
    expect(invitationBody(facts([trainedOn(MON), trainedOn(TUE)], WED, 2))).toBe(
      strings.notifications.weekly.met,
    );
    // Past the target reads the same.
    expect(
      invitationBody(facts([trainedOn(MON), trainedOn(TUE), trainedOn(WED)], THU, 2)),
    ).toBe(strings.notifications.weekly.met);
  });

  it("no target: the no-target body, whatever the count", () => {
    expect(invitationBody(facts([trainedOn(MON)], TUE, null))).toBe(
      strings.notifications.weekly.noTarget,
    );
    expect(invitationBody(facts([trainedOn("2026-09-02")], MON, null))).toBe(
      strings.notifications.weekly.noTarget,
    );
  });

  it("no history at all: one of the four generic bodies, target or not", () => {
    expect(GENERIC).toContain(invitationBody(facts([], MON, 3)));
    expect(GENERIC).toContain(invitationBody(facts([], MON, null)));
  });

  it("an all-skipped session is history but not a trained day (the engine's rule, read not re-derived)", () => {
    const skipped: HistoryEntry = {
      date: MON,
      minutes: 10,
      blocks: [{ movementId: "wall-push-up", pattern: "push", outcome: "skipped" }],
    };
    expect(invitationBody(facts([skipped], TUE, 2))).toBe(
      strings.notifications.weekly.onTrack(0, 2),
    );
  });

  it("never names a miss, a loss, a break or a streak — today is an invitation", () => {
    const bodies = [
      invitationBody(facts([trainedOn(MON)], TUE, 3)),
      invitationBody(facts([trainedOn(MON), trainedOn(TUE)], WED, 2)),
      invitationBody(facts([trainedOn(MON)], TUE, null)),
      invitationBody(facts([], MON, 3)),
    ];
    for (const body of bodies) {
      expect(body).not.toMatch(/break|lose|lost|miss|don't|streak/i);
    }
  });
});
