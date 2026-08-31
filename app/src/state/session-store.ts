import type { ApplyResult, DailyPrompt, Session } from "@fither/engine";
import { create } from "zustand";

import { applyResult } from "../session/apply-result";
import { createSession, type CreateSessionResult } from "../session/create-session";
import {
  createPlayer,
  isFinished,
  reduce,
  type PlayerEvent,
  type PlayerState,
} from "../session/player-machine";
import { useProfileStore } from "./profile-store";
import { useSettingsStore } from "./settings-store";

interface FinishSummary {
  pointsEarned: number;
  unlockedSkills: ApplyResult["unlockedSkills"];
}

interface SessionFlowState {
  prompt: DailyPrompt | null;
  session: Session | null;
  player: PlayerState | null;
  finish: FinishSummary | null;
  saveFailed: boolean;
  /** Generate today's session from the prompt. Everything runs on device. */
  startSession: (prompt: DailyPrompt) => CreateSessionResult;
  dispatchPlayer: (event: PlayerEvent) => void;
  /** Apply the finished session through the engine boundary. Idempotent. */
  completeSession: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionFlowState>()((set, get) => ({
  prompt: null,
  session: null,
  player: null,
  finish: null,
  saveFailed: false,

  startSession: (prompt) => {
    const { profile, history } = useProfileStore.getState();
    const { sessionSalt } = useSettingsStore.getState();
    const result = createSession(prompt, profile, history, sessionSalt);
    if (result.ok) {
      set({
        prompt,
        session: result.value.session,
        player: createPlayer(result.value.playerBlocks),
        finish: null,
        saveFailed: false,
      });
    }
    return result;
  },

  dispatchPlayer: (event) => {
    const { player } = get();
    if (!player) return;
    set({ player: reduce(player, event) });
  },

  completeSession: () => {
    const { session, player, finish, saveFailed } = get();
    if (!session || !player || !isFinished(player)) return;
    if (finish || saveFailed) return; // already applied
    const { profile, history, applyEngineResult } = useProfileStore.getState();
    const outcome = applyResult(profile, history, {
      session,
      outcomes: player.outcomes,
    });
    if (outcome.ok) {
      applyEngineResult(outcome.value);
      set({
        finish: {
          pointsEarned: outcome.value.ledgerEvents.reduce((s, e) => s + e.points, 0),
          unlockedSkills: outcome.value.unlockedSkills,
        },
      });
    } else {
      set({ saveFailed: true });
    }
  },

  resetSession: () =>
    set({ prompt: null, session: null, player: null, finish: null, saveFailed: false }),
}));
