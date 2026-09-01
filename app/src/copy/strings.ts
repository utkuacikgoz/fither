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
      // Shared with the onboarding avoid-list screen (one string, on
      // purpose): both "nothing to work around" defaults say "All good".
      allGood: "All good",
      confirm: "Noted. We'll work around it.",
      // COPY-WRITER: new key (2026-09-01, live-testing pass) — the quiet
      // count cue under multi-select body-area pickers.
      areasNoted: (count: number) =>
        count === 1 ? "1 area noted" : `${count} areas noted`,
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
    restDone: "I'm ready",
    setCounter: (current: number, total: number) => `Set ${current} of ${total}`,
    blockPlan: (sets: number, amount: number, isHold: boolean) =>
      isHold
        ? `${sets} × ${amount}-second hold`
        : `${sets} × ${amount} reps`,
    feedback: {
      question: "How was that?",
      // COPY-WRITER: three answers since 2026-09-01 (live-testing pass),
      // each one fine to give. The ENGINE contract is untouched: both
      // positive answers record "completed", "hard" records "struggled" —
      // see the mapping comment in session-player-screen.tsx.
      options: {
        feltStrong: "Felt strong",
        good: "Good",
        hard: "That was hard",
      },
    },
    // COPY-WRITER: new keys (2026-09-01, live-testing pass). One calm
    // confirm when she taps the quiet exit on a block intro — never a
    // lecture, no cost framing; skipping stays fully allowed and is never
    // mentioned again afterwards.
    skipConfirm: {
      title: (movement: string) => `Skip ${movement}?`,
      body: "Fewer reps count too. Either way is fine.",
      keepGoing: "Keep going",
      skipIt: "Skip it",
    },
  },
  // COPY-WRITER: new keys (2026-09-01, live-testing pass). Shown only
  // when today's work-around list is heavy, or the engine couldn't build
  // around it. One acknowledgment, one optional local note — no advice,
  // no diagnosis, no follow-up questions. The privacy line states a hard
  // technical fact: the note is written to this phone only, zero network.
  care: {
    acknowledgment: "That's a lot to carry today.",
    notePrompt: "Want to say what happened?",
    notePrivacy: "Stays on your phone. Never sent anywhere.",
  },
  preview: {
    eyebrow: "Made for today",
    headline: "Your session is ready",
    summary: (minutes: SessionMinutes, movements: number) =>
      `${minutes} minutes · ${movements} movements`,
    defaultFit: "Built around your time and current level.",
    start: "Start session",
    // Replacements from docs/copy/draft-strings.md §0 (2026-08-31): each
    // line reads as "Cause: effect", matching the domain file's examples.
    adaptations: {
      soreness: (areas: string) => `Works around your ${areas} today.`,
      quiet: "Quiet mode: nothing here makes a sound.",
      lowEnergy: "Low energy: same movements, lighter volume.",
      softLanding: "Slightly lighter where last session was hard.",
      staleFocus: "One movement pattern rotates back in today.",
      tasteBlock: "Ends with a first look at your next level. Optional.",
    },
  },
  // Onboarding — docs/copy/draft-strings.md §1, wired verbatim. Three
  // screens, one decision each, then the handoff eyebrow atop the first
  // daily-prompt question. Nothing else may spend Gate 3 budget.
  onboarding: {
    welcome: {
      headline: "Strength that fits your life.",
      body: "10, 20 or 30 minutes. No equipment. Built for the day you're actually having.",
      cta: "Begin",
    },
    equipment: {
      question: "What's within reach?",
      options: {
        floorOnly: "Just me and the floor",
        chair: "A sturdy chair too",
      },
    },
    avoid: {
      question: "Anything we should always work around?",
      // The one-tap default deliberately reuses prompt.soreness.allGood
      // ("All good") — one shared string, warmer than the old "Nothing",
      // and it matches the daily prompt she'll see every day after.
      confirm: "Noted. Every session will work around it.",
    },
    handoff: {
      eyebrow: "Last step",
      line: "Now, today. Four taps and you're moving.",
    },
  },
  // Paywall — docs/copy/draft-strings.md §3, wired verbatim. An honest
  // letter: annual led, plain prices, no countdowns, no strikethroughs.
  paywall: {
    headline: "The honest version",
    letter:
      "FITHER is one subscription and it covers everything: every session, every length, adapted daily to your time, energy and surroundings. It works offline — on a plane, in a quiet house at 6am. No ads, nothing sold separately.",
    trialLine:
      "The first 7 days are free. If it doesn't fit your life, cancel in Settings before the week ends and pay nothing.",
    plans: {
      annual: {
        label: "Yearly",
        // GBP reference price (ADR-0002). The billing port's offering is
        // the display source; these are the fallback strings it carries.
        price: "£39.99/year",
        note: "£3.33 a month, billed once a year",
      },
      monthly: {
        label: "Monthly",
        price: "£5.99/month",
      },
    },
    cta: "Start my free week",
    afterTrialNote: (price: string) => `7 days free, then ${price}. Cancel anytime.`,
    // Expired-trial variants (ADR-0009 flag). Shown when the paywall gates
    // after the 7 free days are spent. Key shapes mirror the pre-trial
    // keys one-for-one: headline, letter, trialLine, cta, afterTrialNote.
    // No fake re-trial, no guilt about the week being over. The pre-trial
    // keys above stay for any settings-reachable paywall before expiry.
    expired: {
      headline: "Your free week is complete",
      letter:
        "You've had the full seven days — every session, every length, adapted daily. A subscription covers exactly what you've been using: works offline, no ads, nothing sold separately.",
      trialLine:
        "Subscribing starts billing today. Cancel anytime in your App Store settings.",
      cta: "Keep training",
      afterTrialNote: (price: string) => `${price}, starting today. Cancel anytime.`,
    },
    restore: "Restore purchase",
    restoreError: "Couldn't restore your purchase. Try again in a minute.",
    // Restore found no purchase on this Apple ID. Not an error — she may
    // simply be new, or on a new phone signed into a different Apple ID.
    restoreEmpty:
      "No purchase found on this Apple ID. If you subscribed before, check you're signed in with the same one.",
    legal: {
      autoRenew:
        "Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store settings.",
      termsLabel: "Terms of Use",
      privacyLabel: "Privacy Policy",
    },
    // Optional included-list (draft §3): wired for the copy surface; not
    // rendered unless the letter alone tests too sparse.
    included: [
      "Every session, adapted daily",
      "10, 20 and 30 minutes — all of them",
      "Works fully offline",
      "Skill milestones as you get stronger",
      "No ads, ever",
    ],
  },
  // Notifications — docs/copy/draft-strings.md §4. Strings only for now;
  // no notification code exists yet. Invitations, never nags.
  notifications: {
    rationale: {
      line: "One quiet note a day when your session is ready. That's all we'd ever send.",
      allow: "Sounds good",
      decline: "Not now",
    },
    daily: {
      ready: "Today's session is ready. Ten, twenty or thirty minutes — your call.",
      quietTen: "Ten quiet minutes, whenever you are.",
      fitsToday: "A workout that fits today. Ready when you are.",
      yourMinutes: "Somewhere in today there are ten minutes. They're yours.",
    },
  },
  resume: {
    // From docs/copy/draft-strings.md ("Resume prompt"). Both paths keep
    // her work: "Finish here" applies the blocks she completed — it is
    // never a discard (fither-voice: no guilt about the interruption).
    headline: "You're mid-session",
    line: "Everything you've done is saved. Carry on, or call it complete here.",
    continueLabel: "Keep going",
    finishLabel: "Finish here",
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
    noSession: "Couldn't build a session around today's answers.",
    preparing: "Getting your progress ready…",
    storageUnavailable: "Couldn't load your progress. Please reopen the app.",
    saveUnavailable: "Couldn't save this session. Try again in a minute.",
    tryAgain: "Try again",
  },
} as const;

export type Strings = typeof strings;
