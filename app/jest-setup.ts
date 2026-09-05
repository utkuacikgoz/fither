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

// Share export natives (owner direction 2026-09-04): capture resolves to
// a file path and the sheet is available; unlock tests override per
// scenario (capture failure, sheet unavailable) to prove the text share
// still stands behind it.
jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(async () => "file:///tmp/skill-card.png"),
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// Voice playback native (expo-audio): a player that records play/remove
// and lets a test fire "didJustFinish"; the audio mode is a no-op.
jest.mock("expo-audio", () => {
  const players: Array<{ play: jest.Mock; remove: jest.Mock; listeners: Array<(s: unknown) => void> }> = [];
  const createAudioPlayer = jest.fn(() => {
    const listeners: Array<(s: unknown) => void> = [];
    const player = {
      play: jest.fn(),
      remove: jest.fn(),
      listeners,
      addListener: jest.fn((_event: string, cb: (s: unknown) => void) => {
        listeners.push(cb);
        return { remove: jest.fn(() => listeners.splice(listeners.indexOf(cb), 1)) };
      }),
    };
    players.push(player);
    return player;
  });
  return {
    createAudioPlayer,
    setAudioModeAsync: jest.fn(async () => undefined),
    __players: players,
  };
});

// RevenueCat (ADR-0014): never selected in tests (no key), but the
// adapter module is imported by the port, so its natives are shimmed.
// The adapter's own unit test drives these mocks directly.
jest.mock("react-native-purchases", () => {
  const PACKAGE_TYPE = { ANNUAL: "ANNUAL", MONTHLY: "MONTHLY", LIFETIME: "LIFETIME", CUSTOM: "CUSTOM" };
  const PURCHASES_ERROR_CODE = { PURCHASE_CANCELLED_ERROR: "1" };
  const LOG_LEVEL = { DEBUG: "DEBUG" };
  const Purchases = {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getOfferings: jest.fn(async () => ({ current: null })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
  };
  return { __esModule: true, default: Purchases, PACKAGE_TYPE, PURCHASES_ERROR_CODE, LOG_LEVEL };
});
jest.mock("react-native-purchases-ui", () => ({
  __esModule: true,
  default: { presentCustomerCenter: jest.fn(async () => undefined) },
}));

// Sign in with Apple (ADR-0011 adapter): the provider adapter is never
// selected in tests (__DEV__ and no opt-in), but the port imports it, so
// the native is shimmed; the adapter's own unit test drives it.
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(async () => ({ user: "apple-user-1", identityToken: "t" })),
  getCredentialStateAsync: jest.fn(async () => 1),
  AppleAuthenticationCredentialState: { REVOKED: 0, AUTHORIZED: 1, NOT_FOUND: 2, TRANSFERRED: 3 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
