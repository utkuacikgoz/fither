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

// Screens navigate through expo-router's imperative `router`. Component
// tests render screens without a navigation container, so the router is a
// plain spy here — tests assert on the pushed paths. `useRouter` returns
// the same spy so route files render too (the route-guard matrix cold-
// opens them), and `Stack.Screen` is inert chrome.
jest.mock("expo-router", () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  const Stack = Object.assign(() => null, { Screen: () => null });
  return { router, useRouter: () => router, Stack };
});

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: async () => undefined,
  deactivateKeepAwake: async () => undefined,
}));
