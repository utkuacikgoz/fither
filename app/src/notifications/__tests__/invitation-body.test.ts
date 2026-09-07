import type { StreakState } from "@fither/engine";

import { strings } from "../../copy/strings";
import { invitationBody } from "../invitation-body";

// Pure wording from two given facts: the engine's streak state and the
// app's one "trained today" reading. Nothing here derives either.

function streak(current: number, atRisk = false): StreakState {
  return { current, best: Math.max(current, 3), graceUsed: false, atRisk };
}

describe("invitationBody", () => {
  it("trained today with a run alive: what tomorrow's session would make it", () => {
    expect(invitationBody(streak(1), true)).toBe(
      strings.streak.notification.nextDay(2),
    );
    expect(invitationBody(streak(6), true)).toBe(
      strings.streak.notification.nextDay(7),
    );
  });

  it("untrained today with a run alive: the run is still going at today's count", () => {
    expect(invitationBody(streak(3, true), false)).toBe(
      strings.streak.notification.keepsGoing(3),
    );
    // The day after a rest day reads the same way — the grace is the
    // engine's business, the wording only sees the count.
    expect(
      invitationBody({ current: 4, best: 4, graceUsed: true, atRisk: true }, false),
    ).toBe(strings.streak.notification.keepsGoing(4));
  });

  it("no run alive: one of the four generic bodies, whatever today holds", () => {
    const generic = Object.values(strings.notifications.daily);
    expect(generic).toContain(invitationBody(streak(0), false));
    expect(generic).toContain(invitationBody(streak(0), true));
  });

  it("the streak day count is always 2 or more, as the copy assumes", () => {
    // current > 0 and trained today is the only path to nextDay.
    expect(invitationBody(streak(1), true)).toContain("2");
    expect(invitationBody(streak(1), true)).not.toContain(" 1 ");
  });

  it("never names a miss, a loss or a break — a rest day is a rest day", () => {
    const bodies = [
      invitationBody(streak(1), true),
      invitationBody(streak(5, true), false),
      invitationBody(streak(0), false),
    ];
    for (const body of bodies) {
      expect(body).not.toMatch(/break|lose|lost|miss|don't/i);
    }
  });
});
