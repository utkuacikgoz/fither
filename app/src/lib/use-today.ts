import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

import { todayIso } from "./dates";

/**
 * Today's local ISO date as REACTIVE state (audit polish): a screen left
 * open across midnight re-reads the date the next time the app comes to
 * the foreground OR the screen comes back into focus (a tab switched to
 * at 00:10 after training at 23:50 — reviewer note), so yesterday's
 * done-for-today state cannot linger into a new morning. Nothing
 * meaningful renders while the app is backgrounded, and a timer firing
 * at exactly midnight would spend battery to update a dark screen.
 */
export function useTodayIso(): string {
  const [today, setToday] = useState(() => todayIso());
  const reread = useCallback(() => {
    const current = todayIso();
    setToday((previous) => (previous === current ? previous : current));
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reread();
    });
    return () => subscription.remove();
  }, [reread]);
  useFocusEffect(reread);
  return today;
}
