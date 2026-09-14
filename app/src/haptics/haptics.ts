import * as Haptics from "expo-haptics";

// The haptics port (ADR-0030). Every tap she makes already answers with
// motion (press-surface); this is the answer she FEELS, at the moments a
// change of state is hers: a choice registered, a set begun, a session
// closed, a purchase held. Call sites name the moment, never the SDK,
// and never wait: the engine runs on the OS's own thread and a haptic
// that fails (Simulator, an old phone, the system setting off) is
// silence, not an error. Reduce-motion does not gate it: the OS's own
// "System Haptics" switch does, and that is her call, not ours.

/**
 * tap: a choice registered (an answer row, a settings option).
 * commit: a step taken that moves the session (a set begins, a skip lands).
 * success: something closed in her favour (the receipt, a purchase, a restore).
 */
export type HapticKind = "tap" | "commit" | "success";

export function haptic(kind: HapticKind): void {
  let call: Promise<void>;
  try {
    call =
      kind === "tap"
        ? Haptics.selectionAsync()
        : kind === "commit"
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    return;
  }
  void call.catch(() => undefined);
}
