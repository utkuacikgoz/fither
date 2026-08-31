// Test environment shims. AsyncStorage is native-backed, so tests use the
// official in-memory mock — persistence logic still runs for real.
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock(
  "react-native-safe-area-context",
  () =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require("react-native-safe-area-context/jest/mock") as { default: unknown })
      .default,
);

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: async () => undefined,
  deactivateKeepAwake: async () => undefined,
}));
