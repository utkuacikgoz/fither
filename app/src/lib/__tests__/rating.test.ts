import * as StoreReview from "expo-store-review";

import { maybeRequestReview } from "../rating";

// expo-store-review is mocked in jest-setup; here we drive its answers.
const hasAction = jest.mocked(StoreReview.hasAction);
const requestReview = jest.mocked(StoreReview.requestReview);

async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  hasAction.mockResolvedValue(true);
  requestReview.mockResolvedValue(undefined);
});

describe("maybeRequestReview", () => {
  it("requests the system prompt when the OS can show one", async () => {
    maybeRequestReview();
    await flushAsync();
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the OS has no review action", async () => {
    hasAction.mockResolvedValue(false);
    maybeRequestReview();
    await flushAsync();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("swallows failures — the prompt is a bonus, never an error state", async () => {
    hasAction.mockRejectedValue(new Error("native down"));
    expect(() => maybeRequestReview()).not.toThrow();
    await flushAsync();
    requestReview.mockRejectedValue(new Error("native down"));
    expect(() => maybeRequestReview()).not.toThrow();
    await flushAsync();
  });
});
