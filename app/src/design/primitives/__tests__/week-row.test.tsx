import { render } from "@testing-library/react-native";
import React from "react";
import { weekOf, weekParticipation } from "@fither/engine";

import { strings } from "../../../copy/strings";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { WeekRow } from "../week-row";

// The strip is a rendering of the engine's week: seven days Monday
// first, trained days filled, today ringed, the rest a hairline ring.

const week = weekOf("2026-09-09"); // Wednesday 9 September 2026

function entry(date: string, outcome: "completed" | "skipped" = "completed") {
  return {
    date,
    minutes: 10 as const,
    blocks: [{ movementId: "m", pattern: "push" as const, outcome }],
  };
}

it("draws seven days, Monday first, lettered from strings.week", () => {
  const screen = render(
    <WeekRow dates={week.dates} trainedDates={[]} today="2026-09-09" testID="row" />,
  );
  const leaves = renderedTextLeaves(screen.toJSON());
  expect(leaves).toEqual([...strings.week.dayLetters]);
  for (let i = 0; i < 7; i += 1) {
    expect(screen.getByTestId(`row-day-${i}`).props.accessibilityLabel).toBe(
      strings.week.dayNames[i],
    );
  }
});

it("fills the engine's trained dates, rings today, leaves the rest open", () => {
  const participation = weekParticipation(
    [entry("2026-09-07"), entry("2026-09-08", "skipped"), entry("2026-09-11")],
    "2026-09-09",
  );
  const screen = render(
    <WeekRow
      dates={week.dates}
      trainedDates={participation.trainedDates}
      today="2026-09-09"
      testID="row"
    />,
  );
  expect(screen.getByTestId("row-day-0-trained")).toBeTruthy();
  // A fully skipped day is not training (the engine's definition, not ours).
  expect(screen.getByTestId("row-day-1-rest")).toBeTruthy();
  expect(screen.getByTestId("row-day-2-today")).toBeTruthy();
  expect(screen.getByTestId("row-day-4-trained")).toBeTruthy();
  expect(screen.getByTestId("row-day-6-rest")).toBeTruthy();
  expect(screen.getByTestId("row-day-0").props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByTestId("row-day-2").props.accessibilityState).toEqual({ selected: false });
});

it("a trained today is filled, not ringed", () => {
  const screen = render(
    <WeekRow dates={week.dates} trainedDates={["2026-09-09"]} today="2026-09-09" testID="row" />,
  );
  expect(screen.getByTestId("row-day-2-trained")).toBeTruthy();
  expect(screen.queryByTestId("row-day-2-today")).toBeNull();
});

it("rings nothing when today is outside the week (a past recap)", () => {
  const screen = render(
    <WeekRow dates={week.dates} trainedDates={[]} today="2026-09-20" testID="row" />,
  );
  for (let i = 0; i < 7; i += 1) {
    expect(screen.getByTestId(`row-day-${i}-rest`)).toBeTruthy();
  }
});

it("renders no user-facing text outside strings.ts", () => {
  const allowed = collectStringValues(strings);
  const screen = render(<WeekRow dates={week.dates} trainedDates={[]} today="2026-09-09" />);
  for (const leaf of renderedTextLeaves(screen.toJSON())) {
    expect(allowed.has(leaf)).toBe(true);
  }
});
