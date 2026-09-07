// Feedback on its way to the owner (owner decision 2026-09-07). Sending
// is a network call, so the store keeps what could not go: a message the
// endpoint did not accept waits in AsyncStorage and is retried on every
// foreground and every later send, oldest first. She sees one of three
// states and never a spinner she has to wait out: sent, saved for later,
// or (only when a message was refused while online) a plain retry.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getFeedback, type FeedbackMessage } from "../feedback/feedback";
import { appVersion } from "../lib/app-version";
import { todayIso } from "../lib/dates";

export type SubmitResult = "sent" | "queued";

interface FeedbackState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Messages the endpoint has not accepted yet, oldest first. */
  pending: FeedbackMessage[];
  /** Send now; queue when the endpoint does not accept it. */
  submit: (input: { message: string; email: string }) => Promise<SubmitResult>;
  /** Retry the queue, oldest first, stopping at the first refusal. */
  flush: () => Promise<void>;
}

/** OS and model only, so a report can be reproduced; never an id. */
export function deviceLabel(): string {
  const model = Constants.deviceName;
  return [Platform.OS, String(Platform.Version), model ?? ""]
    .filter((part) => part.length > 0)
    .join(" ");
}

let flushing = false;

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hydrationFailed: false,
      pending: [],
      submit: async ({ message, email }) => {
        const trimmedEmail = email.trim();
        const entry: FeedbackMessage = {
          message: message.trim(),
          email: trimmedEmail.length > 0 ? trimmedEmail : null,
          appVersion: appVersion(),
          device: deviceLabel(),
          date: todayIso(),
        };
        // Earlier messages go first, so hers is never delivered out of
        // order; a refusal there queues this one too.
        await get().flush();
        if (get().pending.length === 0 && (await getFeedback().send(entry))) {
          return "sent";
        }
        set({ pending: [...get().pending, entry] });
        return "queued";
      },
      flush: async () => {
        if (flushing) return;
        flushing = true;
        try {
          while (get().pending.length > 0) {
            const [head, ...rest] = get().pending;
            if (!head) break;
            if (!(await getFeedback().send(head))) break;
            set({ pending: rest });
          }
        } finally {
          flushing = false;
        }
      },
    }),
    {
      name: "fither/feedback-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ pending: state.pending }),
      onRehydrateStorage: () => (_state, error) => {
        useFeedbackStore.setState({ hydrated: true, hydrationFailed: error !== undefined });
      },
    },
  ),
);
