import { httpFeedback, httpFeedbackConfigured } from "../http-feedback";

// Without EXPO_PUBLIC_FEEDBACK_URL (the test environment) the adapter is
// not configured and refuses quietly; the port then selects the dev
// adapter. The JSON shape is pinned by docs/feedback-setup.md.

describe("http feedback adapter", () => {
  it("is not configured without an https endpoint, and then never sends", async () => {
    expect(httpFeedbackConfigured()).toBe(false);
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    expect(
      await httpFeedback.send({
        message: "x",
        email: null,
        appVersion: "1.0.0",
        device: "ios 18 iPhone",
        date: "2026-09-07",
      }),
    ).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
