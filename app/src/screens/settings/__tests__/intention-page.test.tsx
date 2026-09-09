import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { clearRecordedEvents, recordedEvents, recordedPerson } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { glyph } from "../../../design/tokens";
import { useIntentionStore } from "../../../state/intention-store";
import { useProfileStore } from "../../../state/profile-store";
import { weekView } from "../../../state/week-view";
import { startPersonSyncForTest } from "../../../test-utils/person-sync";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { IntentionPage } from "../pages/intention-page";
import { flushPersistence, resetSettingsStores } from "./settings-test-setup";

const hidden = { includeHiddenElements: true } as const;

beforeEach(async () => {
  await resetSettingsStores();
  clearRecordedEvents();
});

describe("Settings → Sessions a week", () => {
  it("shows the question, the lead and the three answers, the current one checked", () => {
    const screen = render(<IntentionPage />);
    expect(screen.getByText(strings.intention.question)).toBeTruthy();
    expect(screen.getByText(strings.intention.lead)).toBeTruthy();
    expect(screen.getByText(strings.intention.two)).toBeTruthy();
    expect(screen.getByText(strings.intention.three)).toBeTruthy();
    expect(screen.getByText(strings.intention.none)).toBeTruthy();
    // No target held: "No target" is the honest checked state.
    expect(screen.getByTestId("intention-none-check", hidden)).toBeTruthy();
    expect(screen.queryByTestId("intention-two-check", hidden)).toBeNull();
    screen.unmount();

    useIntentionStore.setState({ target: 2, asked: true });
    const two = render(<IntentionPage />);
    expect(two.getByTestId("intention-two-check", hidden)).toBeTruthy();
    expect(two.queryByTestId("intention-none-check", hidden)).toBeNull();
  });

  it("a tap sets the target at once, persists it, and sends weekly_intention_set", async () => {
    // The page answers the intention store only; the person sync the app
    // root runs watches it and carries the fact.
    const stopPersonSync = startPersonSyncForTest();
    const screen = render(<IntentionPage />);
    fireEvent.press(screen.getByTestId("intention-three"));
    expect(useIntentionStore.getState().target).toBe(3);
    expect(useIntentionStore.getState().asked).toBe(true);
    expect(screen.getByTestId("intention-three-check", hidden)).toBeTruthy();
    expect(recordedEvents()).toEqual([
      { name: "weekly_intention_set", properties: { target: "three" } },
    ]);
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/intention-v1")).toContain('"target":3');

    fireEvent.press(screen.getByTestId("intention-two"));
    expect(useIntentionStore.getState().target).toBe(2);
    fireEvent.press(screen.getByTestId("intention-none"));
    expect(useIntentionStore.getState().target).toBeNull();
    expect(recordedEvents().map((event) => event.properties)).toEqual([
      { target: "three" },
      { target: "two" },
      { target: "none" },
    ]);
    // The person's intention fact follows the last answer.
    expect(recordedPerson()).toMatchObject({ intention: "none" });
    stopPersonSync();
  });

  it("changing the target is prospective: history is untouched, only the reading changes", () => {
    const entries = [
      { date: "2026-09-07", minutes: 10 as const, blocks: [{ movementId: "m", pattern: "push" as const, outcome: "completed" as const }] },
      { date: "2026-09-09", minutes: 10 as const, blocks: [{ movementId: "m", pattern: "push" as const, outcome: "completed" as const }] },
    ];
    useProfileStore.setState({ history: { entries } });
    useIntentionStore.setState({ target: 2, asked: true });
    expect(weekView(entries, "2026-09-10", 2).met).toBe(true);

    const screen = render(<IntentionPage />);
    fireEvent.press(screen.getByTestId("intention-three"));
    // The same two trained days, read against the new number.
    expect(useProfileStore.getState().history.entries).toEqual(entries);
    expect(weekView(entries, "2026-09-10", useIntentionStore.getState().target).met).toBe(false);
    expect(weekView(entries, "2026-09-10", useIntentionStore.getState().target).participation.count).toBe(2);
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    allowed.add(glyph.check);
    for (const leaf of renderedTextLeaves(render(<IntentionPage />).toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
