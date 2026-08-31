// Every user-facing string in the app lives here — components never hold
// literal user text. Written to fither-voice: calm coach, second person,
// short sentences, no guilt, forbidden list respected. Polished by
// copy-writer (2026-08-31); flag any new keys for review before release.

import type { BodyArea, Energy, SessionMinutes } from "@fither/engine";

export const strings = {
  prompt: {
    dayLabel: "Today",
    time: {
      question: "How much time do you have?",
      minutes: {
        10: "10 minutes",
        20: "20 minutes",
        30: "30 minutes",
      } satisfies Record<SessionMinutes, string>,
    },
    energy: {
      question: "How is your energy?",
      options: {
        low: "Low",
        okay: "Okay",
        strong: "Strong",
      } satisfies Record<Energy, string>,
    },
    quiet: {
      question: "Do you need to be quiet right now?",
      yes: "Keep it quiet",
      no: "Sound is fine",
    },
    soreness: {
      question: "Anything sore or off-limits today?",
      allGood: "All good",
      confirm: "Noted. We'll work around it.",
      areas: {
        shoulders: "Shoulders",
        wrists: "Wrists",
        elbows: "Elbows",
        back: "Back",
        hips: "Hips",
        knees: "Knees",
        ankles: "Ankles",
        core: "Core",
      } satisfies Record<BodyArea, string>,
    },
  },
  player: {
    begin: "Begin",
    setDone: "Done",
    skipBlock: "Skip this one",
    repsLabel: "reps",
    holdLabel: "seconds",
    rest: "Rest",
    restNote: "Breathe.",
    setCounter: (current: number, total: number) => `Set ${current} of ${total}`,
    blockPlan: (sets: number, amount: number, isHold: boolean) =>
      isHold
        ? `${sets} × ${amount}-second hold`
        : `${sets} × ${amount} reps`,
    feedback: {
      question: "How was that?",
      completed: "Good",
      struggled: "That was hard",
    },
  },
  finish: {
    headline: "Session complete",
    note: "That counts.",
    pointsLabel: "points",
    continueLabel: "Continue",
  },
  unlock: {
    heading: "New skill",
    note: "It counts.",
    continueLabel: "Continue",
  },
  errors: {
    // Shown while the session engine or movement library is unavailable
    // on this build. Reviewed by copy-writer (2026-08-31).
    sessionUnavailable: "Couldn't build today's session. Try again in a minute.",
    saveUnavailable: "Couldn't save this session. Try again in a minute.",
    tryAgain: "Try again",
  },
} as const;

export type Strings = typeof strings;
