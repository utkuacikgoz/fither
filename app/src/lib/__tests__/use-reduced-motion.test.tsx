import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

// The real hook — jest-setup mocks it for screen tests, since its async
// OS read lands outside act(); here it is the subject.
const { useReducedMotion, resetReducedMotionForTests } = jest.requireActual<
  typeof import("../use-reduced-motion")
>("../use-reduced-motion");

beforeEach(() => resetReducedMotionForTests());

type Listener = (enabled: boolean) => void;

function stubAccessibility(initial: boolean) {
  const listeners: Listener[] = [];
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(initial);
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation(((event: string, handler: Listener) => {
      if (event === "reduceMotionChanged") listeners.push(handler);
      return { remove: jest.fn() };
    }) as never);
  return { listeners };
}

it("defaults to motion on, then settles to the OS setting", async () => {
  stubAccessibility(true);
  const { result } = renderHook(() => useReducedMotion());
  // The first frame carries the default; the settled value follows.
  expect(result.current).toBe(false);
  await waitFor(() => expect(result.current).toBe(true));
});

it("stays live: follows the setting when she changes it mid-session", async () => {
  const { listeners } = stubAccessibility(false);
  const { result } = renderHook(() => useReducedMotion());
  await waitFor(() => expect(listeners).toHaveLength(1));
  act(() => listeners[0]!(true));
  expect(result.current).toBe(true);
  act(() => listeners[0]!(false));
  expect(result.current).toBe(false);
});

it("keeps the default when the read fails — motion here is already gentle", async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockRejectedValue(new Error("no accessibility service"));
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockReturnValue({ remove: jest.fn() } as never);
  const { result } = renderHook(() => useReducedMotion());
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current).toBe(false);
});

it("remembers the setting: a second mount starts on the right frame, no snap", async () => {
  stubAccessibility(true);
  const first = renderHook(() => useReducedMotion());
  await waitFor(() => expect(first.result.current).toBe(true));
  first.unmount();
  // Every later screen in the process mounts already correct — the
  // Reduce Motion user never sees an entrance start and then cut.
  const second = renderHook(() => useReducedMotion());
  expect(second.result.current).toBe(true);
});
