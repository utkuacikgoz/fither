import * as Haptics from "expo-haptics";

// What the phone would have felt, in order, since the last clear. The
// jest-setup mock keeps the log; screen tests read it through here so
// no test names the SDK.
type Logged = typeof Haptics & { __log: string[] };

export function recordedHaptics(): readonly string[] {
  return (Haptics as Logged).__log;
}

export function clearRecordedHaptics(): void {
  (Haptics as Logged).__log.length = 0;
}
