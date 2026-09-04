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
// `Tabs` renders its children so a tab layout can be rendered in a test
// without a navigation container; `Tabs.Screen` is inert chrome, like
// `Stack.Screen`. `useLocalSearchParams` returns no params by default —
// route tests that need one (the prompt's handoff) override it.
jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require("react") as typeof import("react");
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  const Stack = Object.assign(() => null, { Screen: () => null });
  const Tabs = Object.assign(
    ({ children }: { children?: import("react").ReactNode }) =>
      react.createElement(react.Fragment, null, children),
    { Screen: () => null },
  );
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Stack,
    Tabs,
  };
});

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: async () => undefined,
  deactivateKeepAwake: async () => undefined,
}));

// Local-notification and store-review natives, mocked deterministically:
// permission starts undetermined, requesting grants (individual tests
// override per scenario), scheduling records its calls. Nothing network-
// backed exists in either module — they are shimmed only because their
// native bindings don't exist under jest.
// The notifications adapter imports only the PermissionStatus enum from
// the expo package; mocking it keeps jest from loading expo's side-
// effectful entry point.
jest.mock("expo", () => ({
  PermissionStatus: {
    GRANTED: "granted",
    UNDETERMINED: "undetermined",
    DENIED: "denied",
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({
    status: "undetermined",
    granted: false,
    canAskAgain: true,
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    status: "granted",
    granted: true,
    canAskAgain: true,
  })),
  scheduleNotificationAsync: jest.fn(async () => "notification-id"),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  SchedulableTriggerInputTypes: {
    CALENDAR: "calendar",
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    YEARLY: "yearly",
    DATE: "date",
    TIME_INTERVAL: "timeInterval",
  },
}));

jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(async () => true),
  hasAction: jest.fn(async () => true),
  requestReview: jest.fn(async () => undefined),
}));

// Reduce Motion, in screen tests: the real hook reads the OS setting
// asynchronously and sets state when the promise lands — outside any
// act() a test can wrap, so every screen using it warned on every test
// (54 warnings, one source line). Screens get the settled default here.
// Nothing is lost: every primitive's Reduce Motion path is tested with
// the explicit prop (card, track, answer-row, progress-line), and the
// hook itself has its own unit test that reaches past this mock with
// jest.requireActual.
jest.mock("./src/lib/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));
