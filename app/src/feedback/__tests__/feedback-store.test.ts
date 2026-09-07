import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearSentFeedback,
  failNextFeedback,
  sentFeedback,
} from "../dev-feedback";
import { deviceLabel, useFeedbackStore } from "../../state/feedback-store";

beforeEach(async () => {
  await AsyncStorage.clear();
  clearSentFeedback();
  useFeedbackStore.setState({ pending: [], hydrated: true, hydrationFailed: false });
});

describe("feedback store", () => {
  it("sends her words with the version, device and date, trimmed, email only if typed", async () => {
    const result = await useFeedbackStore
      .getState()
      .submit({ message: "  The rest timer is too short.  ", email: " " });
    expect(result).toBe("sent");
    expect(sentFeedback()).toHaveLength(1);
    expect(sentFeedback()[0]).toMatchObject({
      message: "The rest timer is too short.",
      email: null,
      device: deviceLabel(),
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as unknown as string,
    });
    expect(useFeedbackStore.getState().pending).toEqual([]);
  });

  it("keeps the email when she gives one", async () => {
    await useFeedbackStore.getState().submit({ message: "Loved it", email: "a@b.co " });
    expect(sentFeedback()[0]?.email).toBe("a@b.co");
  });

  it("queues a refused message on the phone and sends it on the next flush", async () => {
    failNextFeedback();
    const result = await useFeedbackStore.getState().submit({ message: "Offline note", email: "" });
    expect(result).toBe("queued");
    expect(sentFeedback()).toHaveLength(0);
    expect(useFeedbackStore.getState().pending).toHaveLength(1);
    // The queue persists: a relaunch still has it.
    const raw = await AsyncStorage.getItem("fither/feedback-v1");
    expect(raw).toContain("Offline note");

    await useFeedbackStore.getState().flush();
    expect(sentFeedback().map((m) => m.message)).toEqual(["Offline note"]);
    expect(useFeedbackStore.getState().pending).toEqual([]);
  });

  it("never delivers out of order: a queued message goes before a new one, and a refusal queues both", async () => {
    failNextFeedback();
    await useFeedbackStore.getState().submit({ message: "first", email: "" });
    failNextFeedback();
    const second = await useFeedbackStore.getState().submit({ message: "second", email: "" });
    expect(second).toBe("queued");
    expect(useFeedbackStore.getState().pending.map((m) => m.message)).toEqual(["first", "second"]);

    await useFeedbackStore.getState().flush();
    expect(sentFeedback().map((m) => m.message)).toEqual(["first", "second"]);
  });

  it("a flush with nothing pending touches nothing", async () => {
    await useFeedbackStore.getState().flush();
    expect(sentFeedback()).toHaveLength(0);
  });
});
