import { fireEvent, render } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { createInitialProfile, weekOf, type HistoryEntry, type LedgerEvent } from "@fither/engine";

import RecapRoute, { parseRecapWeek } from "../../../../app/recap";
import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { formatWeekRange } from "../../../lib/format-week";
import { useActiveSessionStore } from "../../../state/active-session-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useIdentityStore } from "../../../state/identity-store";
import { useLedgerStore } from "../../../state/ledger-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { RecapScreen } from "../recap-screen";

// Today is pinned: the recap draws a ring on today's day, so a suite that
// read the real clock passed on one date and failed on the next (CI, the
// day the week rolled over). The anchor week below is fixed, so today is
// too — the one date outside it that keeps every day state stable.
const PINNED_TODAY = "2026-09-20";
jest.mock("../../../lib/use-today", () => ({
  useTodayIso: () => "2026-09-20",
}));

// The recap reads the week the way the engine folded it and the ledger
// dated it. Tests seed the stores and assert what the page reads back;
// the page never holds a literal or a rule of its own.

type Outcome = "completed" | "struggled" | "skipped";

function entry(date: string, minutes: 10 | 20 | 30, outcomes: Outcome[]): HistoryEntry {
  return {
    date,
    minutes,
    blocks: outcomes.map((outcome, index) => ({
      movementId: `movement-${index}`,
      pattern: "push",
      outcome,
    })),
  };
}

// Monday 7 to Sunday 13 September 2026.
const ANCHOR = "2026-09-10";
const WEEK = weekOf(ANCHOR);
const RANGE = formatWeekRange(WEEK.start, WEEK.end);

const hidden = { includeHiddenElements: true } as const;

beforeEach(() => {
  clearRecordedEvents();
  useProfileStore.setState({
    profile: createInitialProfile(),
    history: { entries: [] },
    hydrated: true,
    hydrationFailed: false,
  });
  useLedgerStore.setState({ events: [], hydrated: true, hydrationFailed: false });
  useSettingsStore.setState({ hydrated: true, hydrationFailed: false });
  useActiveSessionStore.setState({ snapshot: null, hydrated: true, hydrationFailed: false });
  useEntitlementStore.setState({ hydrated: true, hydrationFailed: false });
  useIdentityStore.setState({ identity: null, hydrated: true, hydrationFailed: false });
  (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({});
});

describe("RecapScreen", () => {
  it("captions the week's range, headlines the session count, sums the receipts", () => {
    useProfileStore.setState({
      history: {
        entries: [
          entry("2026-09-07", 10, ["completed", "completed"]),
          entry("2026-09-09", 20, ["completed", "struggled", "skipped"]),
          entry("2026-09-11", 10, ["completed"]),
        ],
      },
    });
    const screen = render(<RecapScreen week={ANCHOR} />);
    expect(screen.getByTestId("recap-range")).toHaveTextContent(strings.recap.title(RANGE));
    expect(screen.getByTestId("recap-headline")).toHaveTextContent(strings.recap.headline(3));
    expect(screen.getByText(strings.week.daysLabel)).toBeTruthy();
    expect(screen.getByTestId("recap-week-day-0-trained")).toBeTruthy();
    expect(screen.getByTestId("recap-week-day-2-trained")).toBeTruthy();
    expect(screen.getByTestId("recap-week-day-4-trained")).toBeTruthy();
    expect(screen.getByTestId("recap-week-day-1-rest")).toBeTruthy();
    expect(screen.getByTestId("recap-minutes-value")).toHaveTextContent("40");
    expect(screen.getByTestId("recap-movements-value")).toHaveTextContent("5");
  });

  it("headlines sessions, not days: two sessions on one day are two", () => {
    useProfileStore.setState({
      history: {
        entries: [entry("2026-09-08", 10, ["completed"]), entry("2026-09-08", 10, ["completed"])],
      },
    });
    const screen = render(<RecapScreen week={ANCHOR} />);
    expect(screen.getByTestId("recap-headline")).toHaveTextContent(strings.recap.headline(2));
    expect(screen.getByTestId("recap-week-day-1-trained")).toBeTruthy();
    expect(screen.queryByTestId("recap-week-day-0-trained")).toBeNull();
  });

  it("lists a tier the ledger dated this week, in the pattern's own name", () => {
    useProfileStore.setState({
      history: { entries: [entry("2026-09-08", 10, ["completed"])] },
    });
    const events: LedgerEvent[] = [
      { type: "session", points: 20, date: "2026-09-08" },
      { type: "newTierBlock", points: 5, date: "2026-09-08", pattern: "push", movementId: "incline-push-up" },
      // Last week's rise: not this week's row.
      { type: "newTierBlock", points: 5, date: "2026-09-02", pattern: "core", movementId: "incline-plank" },
    ];
    useLedgerStore.setState({ events });
    const screen = render(<RecapScreen week={ANCHOR} />);
    expect(screen.getByText(strings.recap.tierLabel(strings.profile.patterns.names.push))).toBeTruthy();
    expect(screen.getByTestId("recap-tier-push-value")).toHaveTextContent(strings.recap.tierValue(2));
    expect(screen.queryByTestId("recap-tier-core")).toBeNull();
    expect(screen.queryByTestId("recap-no-change")).toBeNull();
  });

  it("says no new tier when the ledger dated none this week, whatever the profile holds", () => {
    const profile = createInitialProfile();
    // A current tier alone is not a rise this week; only a dated record is.
    profile.patterns.push = { ...profile.patterns.push, tier: 3, tierSince: "2026-09-08" };
    useProfileStore.setState({
      profile,
      history: { entries: [entry("2026-09-08", 10, ["completed"])] },
    });
    const screen = render(<RecapScreen week={ANCHOR} />);
    expect(screen.getByTestId("recap-no-change")).toHaveTextContent(strings.recap.noChange);
    expect(screen.queryByTestId("recap-tier-push")).toBeNull();
  });

  it("a quiet week: the zero headline, open strip, zero rows, no share and no share event", () => {
    // A past week, so today's ring is not on the strip either.
    const screen = render(<RecapScreen week="2026-08-12" />);
    expect(screen.getByTestId("recap-headline")).toHaveTextContent(strings.recap.headline(0));
    for (let i = 0; i < 7; i += 1) {
      expect(screen.getByTestId(`recap-week-day-${i}-rest`)).toBeTruthy();
    }
    expect(screen.getByTestId("recap-minutes-value")).toHaveTextContent("0");
    expect(screen.getByTestId("recap-movements-value")).toHaveTextContent("0");
    expect(screen.queryByTestId("recap-share")).toBeNull();
    expect(recordedEvents()).toEqual([]);
  });

  it("a trained week offers one share, sends share_eligible once, and pushes the recap share", () => {
    useProfileStore.setState({
      history: { entries: [entry("2026-09-08", 10, ["completed"])] },
    });
    const screen = render(<RecapScreen week={ANCHOR} />);
    expect(recordedEvents()).toEqual([{ name: "share_eligible", properties: { source: "recap" } }]);
    screen.rerender(<RecapScreen week={ANCHOR} />);
    expect(recordedEvents()).toHaveLength(1);
    fireEvent.press(screen.getByTestId("recap-share"));
    expect(router.push).toHaveBeenCalledWith(`/share?source=recap&date=${WEEK.start}`);
  });

  it("defaults to the week containing today and rings today in the strip", () => {
    const today = PINNED_TODAY;
    const week = weekOf(today);
    const screen = render(<RecapScreen />);
    expect(screen.getByTestId("recap-range")).toHaveTextContent(
      strings.recap.title(formatWeekRange(week.start, week.end)),
    );
    const index = week.dates.indexOf(today);
    expect(screen.getByTestId(`recap-week-day-${index}-today`)).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", () => {
    useProfileStore.setState({
      history: { entries: [entry("2026-09-08", 10, ["completed"])] },
    });
    useLedgerStore.setState({
      events: [
        { type: "newTierBlock", points: 5, date: "2026-09-08", pattern: "push", movementId: "incline-push-up" },
      ],
    });
    const allowed = collectStringValues(strings);
    allowed.add(strings.recap.title(RANGE));
    allowed.add(strings.recap.headline(1));
    allowed.add(strings.recap.tierValue(2));
    allowed.add("10");
    allowed.add("1");
    const screen = render(<RecapScreen week={ANCHOR} />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
    expect(screen.queryByTestId("recap-no-change", hidden)).toBeNull();
  });
});

describe("/recap route", () => {
  it("renders the recap behind the hydration guard for the week named, never redirecting", () => {
    (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({ week: ANCHOR });
    const screen = render(<RecapRoute />);
    expect(screen.getByTestId("recap-range")).toHaveTextContent(strings.recap.title(RANGE));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("falls back to today's week for a malformed or missing week", () => {
    expect(parseRecapWeek(undefined)).toBeUndefined();
    expect(parseRecapWeek("next-week")).toBeUndefined();
    expect(parseRecapWeek(["2026-09-10", "x"])).toBe("2026-09-10");
    (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({ week: "soon" });
    const screen = render(<RecapRoute />);
    const week = weekOf(PINNED_TODAY);
    expect(screen.getByTestId("recap-range")).toHaveTextContent(
      strings.recap.title(formatWeekRange(week.start, week.end)),
    );
  });
});
