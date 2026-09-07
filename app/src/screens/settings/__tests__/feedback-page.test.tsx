import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import {
  clearSentFeedback,
  failNextFeedback,
  sentFeedback,
} from "../../../feedback/dev-feedback";
import { useFeedbackStore } from "../../../state/feedback-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { FeedbackPage } from "../pages/feedback-page";

beforeEach(() => {
  clearSentFeedback();
  useFeedbackStore.setState({ pending: [], hydrated: true, hydrationFailed: false });
});

describe("FeedbackPage", () => {
  it("is the title, the field, the optional email and Send: nothing else (owner rule: show, do not tell)", () => {
    const screen = render(<FeedbackPage />);
    expect(screen.getByText(strings.feedback.title)).toBeTruthy();
    expect(screen.getByPlaceholderText(strings.feedback.placeholder)).toBeTruthy();
    expect(screen.getByText(strings.feedback.includeEmail)).toBeTruthy();
    expect(screen.getByTestId("feedback-send")).toBeTruthy();
    expect(screen.queryByText(strings.feedback.lead)).toBeNull();
    expect(screen.queryByText(strings.feedback.privacy)).toBeNull();
  });

  it("an empty message sends nothing", () => {
    const screen = render(<FeedbackPage />);
    fireEvent.press(screen.getByTestId("feedback-send"));
    expect(sentFeedback()).toHaveLength(0);
    expect(screen.queryByTestId("feedback-sent")).toBeNull();
  });

  it("sends her words and shows the sent state; Done goes back", async () => {
    const screen = render(<FeedbackPage />);
    fireEvent.changeText(screen.getByTestId("feedback-message"), "More hinge work please");
    fireEvent.changeText(screen.getByTestId("feedback-email"), "me@x.io");
    fireEvent.press(screen.getByTestId("feedback-send"));
    await waitFor(() => expect(screen.getByTestId("feedback-sent")).toBeTruthy());
    expect(screen.getByText(strings.feedback.sent)).toBeTruthy();
    expect(screen.getByText(strings.feedback.sentNote)).toBeTruthy();
    expect(sentFeedback()[0]).toMatchObject({ message: "More hinge work please", email: "me@x.io" });
    fireEvent.press(screen.getByTestId("feedback-done"));
    expect(router.back).toHaveBeenCalled();
  });

  it("offline: the same calm page, with the saved-for-later line instead", async () => {
    failNextFeedback();
    const screen = render(<FeedbackPage />);
    fireEvent.changeText(screen.getByTestId("feedback-message"), "No signal here");
    fireEvent.press(screen.getByTestId("feedback-send"));
    await waitFor(() => expect(screen.getByTestId("feedback-sent")).toBeTruthy());
    expect(screen.getByText(strings.feedback.queued)).toBeTruthy();
    expect(screen.queryByText(strings.feedback.sentNote)).toBeNull();
    expect(useFeedbackStore.getState().pending).toHaveLength(1);
  });

  it("renders no user-facing text outside strings.ts, both states", async () => {
    const allowed = collectStringValues(strings);
    const screen = render(<FeedbackPage />);
    const audit = () => {
      for (const leaf of renderedTextLeaves(screen.toJSON())) {
        expect(allowed.has(leaf) ? true : leaf).toBe(true);
      }
    };
    audit();
    fireEvent.changeText(screen.getByTestId("feedback-message"), "x");
    fireEvent.press(screen.getByTestId("feedback-send"));
    await waitFor(() => expect(screen.getByTestId("feedback-sent")).toBeTruthy());
    audit();
  });
});
