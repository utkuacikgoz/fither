import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { todayIso } from "./dates";

/**
 * Today's local ISO date as REACTIVE state (audit polish): a screen left
 * open across midnight re-reads the date the next time the app comes to
 * the foreground, so yesterday's done-for-today state cannot linger into
 * a new morning. Foreground is the one moment that matters — nothing
 * meaningful renders while the app is backgrounded, and a timer firing
 * at exactly midnight would spend battery to update a dark screen.
 */
export function useTodayIso(): string {
  const [today, setToday] = useState(() => todayIso());
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const current = todayIso();
        setToday((previous) => (previous === current ? previous : current));
      }
    });
    return () => subscription.remove();
  }, []);
  return today;
}
