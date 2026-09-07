import { renderHook } from "@testing-library/react-native";
import { createInitialProfile, weeksParticipation, type HistoryEntry } from "@fither/engine";

import { todayIso } from "../../lib/dates";
import { useIntentionStore } from "../intention-store";
import { useProfileStore } from "../profile-store";
import { useWeekView, weekView } from "../week-view";

// The selector re-derives nothing: participation and the verdict are the
// engine's; these cases pin the app-side arithmetic on top (remaining,
// next training day) and the hook's wiring to the stores.

// 2026-09-07 is a Monday. The week runs to Sunday the 13th; the next
// Monday is the 14th.
const MON = "2026-09-07";
const WED = "2026-09-09";
const FRI = "2026-09-11";
const SAT = "2026-09-12";
const SUN = "2026-09-13";
const NEXT_MON = "2026-09-14";

function entry(
  date: string,
  outcomes: Array<"completed" | "struggled" | "skipped"> = ["completed"],
): HistoryEntry {
  return {
    date,
    minutes: 10,
    blocks: outcomes.map((outcome, index) => ({
      movementId: `movement-${index}`,
      pattern: "push",
      outcome,
    })),
  };
}

const monWedFri = [entry(MON), entry(WED), entry(FRI)];

describe("weekView", () => {
  it("a Mon/Wed/Fri user sees 3 of 3 on Friday and keeps it through Sunday", () => {
    for (const today of [FRI, SAT, SUN]) {
      const view = weekView(monWedFri, today, 3);
      expect(view.participation.count).toBe(3);
      expect(view.participation.trainedDates).toEqual([MON, WED, FRI]);
      expect(view.target).toBe(3);
      expect(view.met).toBe(true);
      expect(view.remaining).toBe(0);
    }
  });

  it("the following Monday is 0 of 3, and last week's 3 is still there via weeksParticipation", () => {
    const view = weekView(monWedFri, NEXT_MON, 3);
    expect(view.participation.count).toBe(0);
    expect(view.participation.start).toBe(NEXT_MON);
    expect(view.met).toBe(false);
    expect(view.remaining).toBe(3);
    expect(view.nextTrainingDay).toBe(NEXT_MON);

    const weeks = weeksParticipation(monWedFri, NEXT_MON, 2);
    expect(weeks.map((week) => week.count)).toEqual([3, 0]);
    expect(weeks[0]?.start).toBe(MON);
  });

  it("two sessions on one date count once", () => {
    const view = weekView([entry(MON), entry(MON), entry(WED)], WED, 3);
    expect(view.participation.count).toBe(2);
    expect(view.participation.sessions).toBe(3);
    expect(view.remaining).toBe(1);
    expect(view.met).toBe(false);
  });

  it("no-target users get met: null and remaining: null, the count still read", () => {
    const view = weekView(monWedFri, FRI, null);
    expect(view.met).toBeNull();
    expect(view.remaining).toBeNull();
    expect(view.target).toBeNull();
    expect(view.participation.count).toBe(3);
  });

  it("mid-week against a target of 2: one to go, then met, then still met", () => {
    expect(weekView([entry(MON)], WED, 2)).toMatchObject({ met: false, remaining: 1 });
    expect(weekView([entry(MON), entry(WED)], WED, 2)).toMatchObject({
      met: true,
      remaining: 0,
    });
    // A third day never pushes remaining below zero.
    expect(weekView(monWedFri, FRI, 2)).toMatchObject({ met: true, remaining: 0 });
  });

  it("nextTrainingDay is today when today is untrained, the next open date when trained", () => {
    // Wednesday, nothing yet today: today is the next training day.
    expect(weekView([entry(MON)], WED, 3).nextTrainingDay).toBe(WED);
    // Wednesday, trained: Thursday is next.
    expect(weekView([entry(MON), entry(WED)], WED, 3).nextTrainingDay).toBe(
      "2026-09-10",
    );
    // Sunday, trained: nothing left in this week.
    expect(weekView([entry(SUN)], SUN, 3).nextTrainingDay).toBeNull();
    // Sunday, untrained: today.
    expect(weekView([entry(SAT)], SUN, 3).nextTrainingDay).toBe(SUN);
  });

  it("an all-skipped session is not a trained day (the engine's rule, read not re-derived)", () => {
    const view = weekView([entry(MON, ["skipped", "skipped"]), entry(WED, ["struggled"])], WED, 2);
    expect(view.participation.trainedDates).toEqual([WED]);
    expect(view.remaining).toBe(1);
    // Monday holds only a skipped session, but it is in the past: the
    // next training day is still today, never a date already gone.
    expect(view.nextTrainingDay).toBe("2026-09-10");
  });
});

describe("useWeekView", () => {
  beforeEach(() => {
    useProfileStore.setState({
      profile: createInitialProfile(),
      history: { entries: [] },
      hydrated: true,
      hydrationFailed: false,
    });
    useIntentionStore.setState({ target: null, asked: false, hydrated: true, hydrationFailed: false });
  });

  it("reads the history, today and the intention from the stores", () => {
    const today = todayIso();
    useProfileStore.setState({ history: { entries: [entry(today)] } });
    useIntentionStore.getState().setTarget(2);

    const { result } = renderHook(() => useWeekView());
    expect(result.current).toEqual(weekView([entry(today)], today, 2));
    expect(result.current.participation.count).toBe(1);
    expect(result.current.remaining).toBe(1);
  });

  it("changing the target is prospective: the same trained days, read against the new number", () => {
    const today = todayIso();
    useProfileStore.setState({ history: { entries: [entry(today)] } });
    useIntentionStore.getState().setTarget(3);
    const { result, rerender } = renderHook(() => useWeekView());
    expect(result.current.remaining).toBe(2);

    useIntentionStore.getState().setTarget(null);
    rerender(undefined);
    expect(result.current.met).toBeNull();
    expect(result.current.participation.trainedDates).toEqual([today]);
  });
});
