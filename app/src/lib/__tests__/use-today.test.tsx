import { renderHook } from "@testing-library/react-native";

import { todayIso } from "../dates";
import { useTodayIso } from "../use-today";

// Focus is a moment the date can have changed under an open screen:
// the hook re-reads on it (the expo-router mock runs the focus callback
// on mount), and on foreground.

it("reads today on mount and again on focus", () => {
  const { result } = renderHook(() => useTodayIso());
  expect(result.current).toBe(todayIso());
});
