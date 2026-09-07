import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { useIntentionStore } from "../../../state/intention-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { IntentionAskScreen } from "../intention-ask-screen";

// One question, three answers, auto-advance. The store holds the answer;
// the screen only offers the rows and reports which one she took.

beforeEach(() => {
  clearRecordedEvents();
  useIntentionStore.setState({
    target: null,
    asked: false,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("IntentionAskScreen", () => {
  it("asks the one question with its lead and three rows, no Next button", () => {
    const screen = render(<IntentionAskScreen onDone={jest.fn()} />);
    expect(screen.getByText(strings.intention.question)).toBeTruthy();
    expect(screen.getByText(strings.intention.lead)).toBeTruthy();
    expect(screen.getByTestId("intention-two")).toBeTruthy();
    expect(screen.getByTestId("intention-three")).toBeTruthy();
    expect(screen.getByTestId("intention-none")).toBeTruthy();
    // Three buttons and nothing else: the rows are the whole decision.
    expect(screen.getAllByRole("button")).toHaveLength(3);
    // Nothing is decided before she taps.
    expect(useIntentionStore.getState().asked).toBe(false);
    expect(recordedEvents()).toEqual([]);
  });

  it.each([
    ["intention-two", 2, "two"],
    ["intention-three", 3, "three"],
  ] as const)("%s sets the target, reports it, and continues", (testID, target, event) => {
    const onDone = jest.fn();
    const screen = render(<IntentionAskScreen onDone={onDone} />);
    // Pressed mid-entrance: rows are hittable from their first frame.
    fireEvent.press(screen.getByTestId(testID));
    expect(useIntentionStore.getState().target).toBe(target);
    expect(useIntentionStore.getState().asked).toBe(true);
    expect(recordedEvents()).toEqual([
      { name: "weekly_intention_set", properties: { target: event } },
    ]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("'No target' is an answer with the same dignity: nothing set, the ask still ends", () => {
    useIntentionStore.setState({ target: 3 });
    const onDone = jest.fn();
    const screen = render(<IntentionAskScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("intention-none"));
    expect(useIntentionStore.getState().target).toBeNull();
    expect(useIntentionStore.getState().asked).toBe(true);
    expect(recordedEvents()).toEqual([
      { name: "weekly_intention_set", properties: { target: "none" } },
    ]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    const screen = render(<IntentionAskScreen onDone={jest.fn()} />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf) ? true : leaf).toBe(true);
    }
  });
});
