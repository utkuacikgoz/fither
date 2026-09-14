import * as Haptics from "expo-haptics";

import { haptic } from "../haptics";

// The port names moments; the SDK call behind each is pinned here so a
// "tap" can never quietly become a heavy thud.

it("tap is the selection engine, commit a medium impact, success the success notification", () => {
  haptic("tap");
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  haptic("commit");
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  haptic("success");
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
});

it("a failing engine is silence, never a thrown error, sync or async", async () => {
  jest.mocked(Haptics.selectionAsync).mockImplementationOnce(() => {
    throw new Error("no engine");
  });
  expect(() => haptic("tap")).not.toThrow();
  jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error("no engine"));
  expect(() => haptic("tap")).not.toThrow();
  await Promise.resolve();
});
