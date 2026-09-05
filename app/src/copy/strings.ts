// Every user-facing string in the app lives here — components never hold
// literal user text. Written to fither-voice: calm coach, second person,
// short sentences, no guilt, forbidden list respected. Polished by
// copy-writer (2026-08-31); flag any new keys for review before release.

import type { BodyArea, Energy, Pattern, SessionMinutes } from "@fither/engine";

export const strings = {
  // COPY-WRITER: home hub (2026-09-04, ADR-0013 §4) — the app's face
  // between sessions. Three cards; only the day's card carries a primary
  // action. Most of this screen REUSES keys that already exist, and the
  // reuses are load-bearing, not thrift:
  //   · in-flight card → resume.headline + resume.continueLabel ("Keep
  //     going"). Same act, same words as the resume screen itself; a
  //     home-only twin would let the two drift apart. No `today.resume`
  //     key here — do not add one.
  //   · done-for-today card → prompt.completedToday.*
  //   · card headings → profile.patterns.title ("Patterns") and
  //     profile.skills.title ("Skills"). Both cards tap through to
  //     Progress, so the heading must be the word she lands on; a warmer
  //     home-only heading would name the same thing twice and break the
  //     mapping. The patterns row also speaks profile.patterns.title in
  //     its own accessibility label, so a different visible heading
  //     would make the screen say one thing and VoiceOver another.
  // Three keys are new, and each earns it below.
  home: {
    today: {
      // The nothing-yet state, under the "Today" label (prompt.dayLabel).
      // This is the decided product/daily tagline verbatim (ADR-0006) —
      // not a rival slogan, and this is the one surface it was decided
      // for: the daily card, before a session exists. It promises a fit,
      // never a built session waiting (the truth rule under
      // `notifications`). Onboarding's welcome headline keeps the BRAND
      // tagline; the two never share a screen.
      line: "A workout that fits today.",
      // The only primary action on the hub. It names its outcome, not its
      // mechanism: the tap opens the four questions and what comes out is
      // today's session. "Start" would lie — nothing starts for another
      // four taps.
      //
      // Same words as prompt.soreness.confirm, deliberately NOT the same
      // key: that button is the last of the four questions, this one is
      // the entrance to them — the promise made here is kept there. One
      // shared key would couple two screens that must stay free to
      // diverge (the confirm sits under the "1 area noted" cue and may
      // shorten), and a prompt key imported into the home screen would
      // read as a bug at review.
      start: "Build today's session",
    },
    skills: {
      // Heading is profile.skills.title. The card now names the NEAREST
      // milestone she has not reached yet (engine `nextMilestone`), with
      // the movement's figure beside it — so both lines below describe a
      // forward view, not a record.
      //
      // Caption under the skill name, e.g. "Full Push-Up" / "2 tiers
      // ahead". Vocabulary is deliberate: she already reads "Tier 2 of 6"
      // (profile.tier) and "as you reach new tiers"
      // (profile.skills.empty), so "tier" is a word she owns — inventing
      // "steps"/"levels" here would give the same ladder two names.
      // "ahead" places the skill on the path in front of her; "away"
      // measures a gap and "to go" implies something owed. No "only", no
      // "just", no when — this orients, it does not set a target.
      // Numerals match profile.points.total, the other counted caption.
      // Callsite only renders unearned milestones, so tiers is 1–3; the
      // function stays total anyway.
      away: (tiers: number) =>
        tiers === 1 ? "1 tier ahead" : `${tiers} tiers ahead`,
      // Now reachable only when every milestone is behind her — the card
      // has no next skill to name. So this is the top of every ladder,
      // not an empty beginning: "Your first named skill lands here."
      // would have been plainly wrong for the one user who sees it.
      // States the achievement and stops. No "nothing left", no "that's
      // all", nothing that reads as an ending. "reached" is the same
      // honest tier-entry verb as profile.skills.empty and ADR-0012 §3.
      empty: "You've reached every named skill.",
    },
  },
  prompt: {
    dayLabel: "Today",
    // COPY-WRITER (2026-09-04): VoiceOver label for the segmented
    // indicator above the daily prompt's four questions and onboarding's
    // two. Same shape as player.sessionProgress ("Session progress"):
    // names the thing, nothing more. iOS appends the value itself
    // ("2 of 4"), so no number and no "of" here — they'd be read twice.
    // "Question", because that is what each segment is on both surfaces;
    // she never sees the word "prompt".
    progressLabel: "Question progress",
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
      confirm: "Build today's session",
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
    // COPY-WRITER: the calm completed-today state on the daily surface
    // (2026-09-02, ADR-0012 §2 / audit wave 2). States what she did, and
    // offers one quiet action — training again is her choice, never
    // pushed, so the action sits plain, with no urgency and no reward
    // framing. `line` takes total minutes trained today and renders only
    // when the session completed in full; `lineSome` renders when she did
    // some work but ended early or ran out of time — no minutes claimed,
    // no framing of what was left undone.
    completedToday: {
      headline: "Done for today",
      line: (minutes: number) => `${minutes} minutes trained today. It counts.`,
      lineSome: "You trained today. It counts.",
      action: "Another session",
    },
  },
  player: {
    sessionProgress: "Session progress",
    begin: "Begin",
    setDone: "Done",
    skipBlock: "Skip exercise",
    repsLabel: "reps",
    holdLabel: "seconds",
    rest: "Rest",
    restNote: "Breathe.",
    restDone: "I'm ready",
    setCounter: (current: number, total: number) => `Set ${current} of ${total}`,
    blockPlan: (
      sets: number,
      amount: number,
      isHold: boolean,
      unilateral = false,
    ) => {
      const side = unilateral ? " each side" : "";
      return isHold
        ? `${sets} × ${amount}-second hold${side}`
        : `${sets} × ${amount} ${amount === 1 ? "rep" : "reps"}${side}`;
    },
    sides: {
      left: "Left side",
      right: "Right side",
      switchTitle: "Switch sides",
      switchBody: "Set up on your right side when you're ready.",
      startRight: "Start right side",
    },
    feedback: {
      question: "How did that feel?",
      // COPY-WRITER: values revised 2026-09-02 (audit pass, owner-approved
      // direction) — three dignified answers, keys unchanged. The ENGINE
      // contract is untouched: "Strong" and "About right" both record
      // "completed", "Hard today" records "struggled" — see the mapping
      // comment in session-player-screen.tsx.
      options: {
        feltStrong: "Strong",
        good: "About right",
        hard: "Hard today",
      },
    },
    // COPY-WRITER: one calm confirm when she taps the quiet exit on a
    // block — shown in every active phase, never a lecture. The body is
    // honest AND mechanically true (ADR-0012 §1: skip is progression-
    // neutral): it doesn't count as completed, it also costs her nothing,
    // and it is never mentioned again afterwards.
    skipConfirm: {
      title: (movement: string) => `Skip ${movement}?`,
      body: "It won't count as completed, and it won't set you back. Either way is fine.",
      keepGoing: "Keep going",
      skipIt: "Skip exercise",
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
      `${minutes} minutes · ${movements} ${movements === 1 ? "block" : "blocks"}`,
    defaultFit: "Built around your time and current level.",
    planTitle: "Today's plan",
    changeAnswers: "Change today's answers",
    start: "Start session",
    // Replacements from docs/copy/draft-strings.md §0 (2026-08-31): each
    // line reads as "Cause: effect", matching the domain file's examples.
    adaptations: {
      soreness: (areas: string) => `Works around your ${areas} today.`,
      quiet: "Quiet mode: every movement is designed to stay quiet.",
      lowEnergy: "Low energy: fewer sets at your current level.",
      softLanding: "Slightly lighter where last session was hard.",
      staleFocus: "A movement you haven't seen lately is back today.",
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
      //
      // COPY-WRITER (2026-09-02, audit S10): confirm is a primary BUTTON,
      // so it names an action, not a confirmation. It only renders when
      // she has picked areas (the no-picks path is the "All good" row,
      // which advances on its own), so one label serves its one state.
      // "Continue" over outcome-naming: the count cue directly above
      // ("1 area noted") already acknowledges the picks, and any
      // these/this phrasing breaks on a single pick.
      confirm: "Continue",
    },
    handoff: {
      eyebrow: "Last step",
      line: "Four answers to today's plan.",
    },
  },
  // Sign-in (2026-09-01, dev-mode only for now — nothing connects yet).
  // Guest is a full peer of the provider buttons: she is never
  // second-class for skipping an account. Apple/Google wordings are the
  // platform-sanctioned conventions — do not restyle them.
  auth: {
    // Not the tagline: onboarding's welcome headline owns the brand
    // moment (ADR-0006), and on a first run these two screens are
    // back-to-back. This line just sets up the choice below — no rival
    // slogan, no feature promise (ADR-0011 §5: no sync claims).
    welcome: "Choose how you'd like to continue.",
    apple: "Continue with Apple",
    google: "Continue with Google",
    guest: "Continue without an account",
    guestNote: "Your training lives on this phone either way.",
    // Deliberately promises nothing: sync does not exist, so the
    // move-to-a-new-phone benefit line must WAIT until it does. This is
    // the whole honest truth of an account today. Revisit when sync
    // ships — flagged in the copy report.
    accountNote: "For now, an account simply keeps your place here. Nothing more yet.",
    error: "Couldn't sign you in. Try again in a minute, or continue without an account.",
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
        // USD reference prices (owner decision 2026-09-05, superseding
        // ADR-0002's GBP; ADR in progress). The billing port's offering is
        // the display source; these are the fallback strings it carries.
        // The note is plain arithmetic on the real price: 59.99 / 12.
        price: "$59.99/year",
        note: "$5.00 a month, billed once a year",
      },
      monthly: {
        label: "Monthly",
        price: "$12.99/month",
      },
      // COPY-WRITER (2026-09-05, owner decision): the one-time purchase.
      // NOT a row on the main paywall — it is offered once, on day 3 of
      // the free week, only to someone who has switched off auto-renew,
      // and it renders on the `lifetimeOffer` screen below alongside
      // that block's letter. Same shape as its siblings so the row reads
      // the same. `price` says what the number is: one payment, not a
      // rate. `note` is the single fact one-time means — it never
      // renews. No "forever", no "best value", nothing struck through.
      // Never render afterTrialNote or legal.autoRenew beside this plan:
      // both describe renewal, and this plan has none.
      lifetime: {
        label: "Lifetime",
        price: "$99 once",
        note: "One payment. It never renews.",
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
      // The ownership boundary on the gated day (ADR-0009 §3), rendered
      // under the "Today" header, above the letter. Plain fact: history,
      // points and skills stay hers; only making a new session is gated.
      recordNote: "Your record stays yours. Subscribe to make a new session.",
    },
    restore: "Restore purchase",
    restoreError: "Couldn't restore your purchase. Try again in a minute.",
    // COPY-WRITER (2026-09-02, audit S2): the purchase ATTEMPT failed —
    // a provider/process error, never her declining. Symmetric with
    // restoreError: the process couldn't complete, one calm retry, no
    // urgency. No "you weren't charged" claim — we can't guarantee it.
    purchaseError: "Couldn't complete your purchase. Try again in a minute.",
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
  // COPY-WRITER (2026-09-05, owner decision): the one-time offer screen.
  // Shown ONCE, on day 3 of her free week, and only after she has
  // switched off the trial's auto-renew in her App Store settings. One
  // decision: take the lifetime purchase, or not. Same register as the
  // paywall letter. The body acknowledges her choice as a plain fact —
  // no guilt, no question, no "are you sure" — then states the offer:
  // one payment, everything, no renewal. The price is not in the prose,
  // exactly as the paywall letter carries none: the screen must render
  // paywall.plans.lifetime (label, price, note) beside this body, or she
  // never sees the amount. "We'll only ask once" is the one true fact
  // about frequency, stated flatly; no countdown, no "last chance", no
  // "only today". `cta` names the outcome she gets. `decline` names the
  // plain state she is already in, with equal dignity — it is the
  // default path, not a loss.
  lifetimeOffer: {
    headline: "One other option",
    body:
      "You've switched off auto-renew, so your free week ends as a free week and nothing is charged. There is one other way to keep FITHER: one payment covers everything — every session, every length, working offline — with no subscription and no renewal, ever. We'll only ask once.",
    cta: "Pay once, keep everything",
    decline: "Finish my free week as planned",
  },
  // Notifications — docs/copy/draft-strings.md §4. Strings only for now;
  // no notification code exists yet. Invitations, never nags.
  // TRUTH RULE (audit, 2026-09-02): a session does not exist until she
  // answers the four questions, so no line may claim one is ready. Lines
  // invite her to build it, or speak of her minutes — never a built thing
  // waiting. Never reference absence or missed days. Renamed `daily.ready`
  // → `daily.fourAnswers`; the old key name itself made the false claim.
  notifications: {
    rationale: {
      line: "One quiet note a day, an invitation to build today's session. That's all we'd ever send.",
      allow: "Sounds good",
      decline: "Not now",
    },
    // These four are the NOTIFICATION BODIES of the one daily invitation —
    // the ui-engineer rotates or picks among them when scheduling. Keep
    // them interchangeable: any of them must stand alone on a lock screen.
    daily: {
      fourAnswers:
        "Today's session is four answers away. Ten, twenty or thirty minutes — your call.",
      quietTen: "Ten quiet minutes, whenever you are.",
      fitsToday: "A workout that fits today. Ready when you are.",
      yourMinutes: "Somewhere in today there are ten minutes. They're yours.",
    },
    // COPY-WRITER: new keys (2026-09-02, owner decision). After she allows
    // notifications, one more tap picks the slot for the daily invitation.
    // This is HER convenience — when the note suits her day — not our
    // engagement lever, so the question asks what she'd like, nothing
    // about habits or consistency. The labels name the hour (8:00, 12:30,
    // 18:30 local — fixed by the scheduler) because the tap sets a real
    // arrival time and she deserves to know it before choosing: "Evening"
    // alone could mean bedtime. 24-hour clock: British-neutral, compact,
    // unambiguous, consistent across all three. If the scheduled hours
    // ever change, these labels must change with them — they state a fact.
    // Settings reuses these three labels for changing the slot.
    time: {
      question: "When would you like your daily note?",
      morning: "Morning (8:00)",
      midday: "Midday (12:30)",
      evening: "Evening (18:30)",
    },
  },
  resume: {
    // From docs/copy/draft-strings.md ("Resume prompt"). Both paths keep
    // her work: "Finish here" applies the blocks she completed — it is
    // never a discard (fither-voice: no guilt about the interruption).
    headline: "You're mid-session",
    line: "Completed exercises are saved. Carry on, or call it complete here.",
    continueLabel: "Keep going",
    finishLabel: "Finish here",
  },
  finish: {
    headline: "Session complete",
    note: "That counts.",
    savingHeadline: "Saving your session",
    savingNote: "Keeping your progress safe.",
    failedHeadline: "Your session is safe",
    // Superseded by pointsUnit below (2026-09-04, the "two copy nits" in
    // docs/STATE.md). Kept only for readers not yet moved over; do not
    // add new callsites. Remove once every reader uses pointsUnit.
    pointsLabel: "points",
    // COPY-WRITER (2026-09-04): the unit word under the numeral — "+35"
    // on the finish screen, "70" on Progress. Parameterised so a single
    // point reads "point", not "1 points" (which is why one point used
    // to render unitless). Same plural rule as profile.points.total,
    // which owns the full-sentence form; this is the bare unit only.
    pointsUnit: (points: number) => (points === 1 ? "point" : "points"),
    continueLabel: "Continue",
    // COPY-WRITER: honest close states (2026-09-02, ADR-0012 §2 and the
    // audit's wave 2). Three distinct truths, zero guilt in any of them.
    // She chose to stop. Completed work is saved and counts — full stop,
    // no "but".
    endedEarly: {
      headline: "Finished here",
      note: "Everything you completed is saved. It counts.",
    },
    // The session reached its chosen length (+10% tolerance) and wrapped
    // up at a phase boundary. This is the time promise KEPT, not a
    // shortfall — say so plainly. Headline takes the chosen minutes.
    outOfTime: {
      headline: (minutes: SessionMinutes) => `That's your ${minutes} minutes`,
      note: "We keep to the time you chose. Everything you completed counts.",
    },
    // A session closed with zero completed blocks. Never false success —
    // no "complete", no "counts" — but warm and forward-looking. No
    // reference to what was missed.
    nothingDone: {
      headline: "Today didn't fit",
      note: "That happens. Ready when you are.",
    },
  },
  unlock: {
    heading: "New skill",
    // ADR-0012 §3: the celebration marks tier ENTRY. Honest framing —
    // the movement has joined her training; never a claim she has
    // performed it.
    note: "Now in your training.",
    continueLabel: "Continue",
  },
  // Share — the unlock screen's share sheet and card (2026-09-01).
  // Gamification rules: the card states the skill, never anything about
  // the body's appearance. The sheet text is HERS — she is sending it,
  // so it speaks in first person, not the app bragging on her behalf.
  share: {
    action: "Share this",
    // Under 140 characters with any skill name from the library. No
    // link and no store ask — there is no listing yet, and begging
    // isn't the voice anyway. FITHER named once, at the end, quietly.
    // ADR-0012 §3: earned entry, not claimed mastery — she reached the
    // tier; the skill is now what she's training, not yet what she's
    // performed.
    message: (skill: string) =>
      `${skill} — now in my training. With FITHER.`,
    card: {
      // Rendered beneath the skill name. Honest tier-entry framing
      // (ADR-0012 §3), and still proud — she earned her way here.
      line: "Now in training.",
    },
  },
  // Settings (2026-09-01). The restore ACTION and its result messages
  // already live under paywall.restore / restoreError / restoreEmpty —
  // the settings screen reuses those; only the section heading is new
  // here. Do not duplicate them.
  settings: {
    title: "Settings",
    // Quiet footer line — the brand name carries it; "Version" would
    // just be furniture. e.g. "FITHER 1.2.0".
    version: (v: string) => `FITHER ${v}`,
    // Persistent work-arounds, same body areas as the daily prompt
    // (reuse prompt.soreness.areas for the labels). No medical framing,
    // no caution-speak: this is a preference she sets, not a condition
    // she declares.
    avoid: {
      title: "Always work around",
      body: "Anything you pick here is quietly built into every day's plan. Change it whenever you like.",
    },
    restore: {
      title: "Subscription",
      // COPY-WRITER (2026-09-05): action row beside "Restore purchase" that
      // opens Apple's subscription management (RevenueCat Customer Center
      // when the store is connected, else the App Store subscriptions
      // page). Names the action plainly, parallel to paywall.restore.
      // Deliberately not "Cancel subscription": cancelling is one of
      // several things the page does, and naming it reads as an
      // invitation to leave.
      manage: "Manage subscription",
    },
    // COPY-WRITER: new keys (2026-09-02, owner decision). The Settings
    // section for the daily invitation: change the slot (reuse
    // notifications.time.morning/midday/evening for the option labels —
    // never duplicate them) or turn it off. `off` sits as a fourth option
    // with equal dignity: it names the plain state, no loss framing, no
    // "are you sure", nothing about what she'd be missing. The title
    // says "Daily invitation", the framing notifications.rationale
    // already established — not "Reminders": a reminder implies she
    // forgot; an invitation implies she's welcome.
    reminders: {
      title: "Daily invitation",
      off: "No invitation",
      // COPY-WRITER (2026-09-04, the "two copy nits" in docs/STATE.md).
      // Rendered inside this card, under the four rows, only after she
      // tapped a slot here and iOS reported a hard denial — the OS
      // dialog no longer appears, so her tap was answered by nothing
      // except "No invitation" staying selected. Two plain facts, no
      // guilt, nothing about what she'd miss: where the switch is (the
      // iPhone's Settings app — capitalised, it is the app's name), and
      // that flipping it there is what makes a slot work. Says nothing
      // about the app asking again, because it can't. Not an error —
      // she may well have chosen this.
      denied:
        "Notifications for FITHER are off in your iPhone's Settings. Turn them on there and the slot you pick here will work.",
    },
    // COPY-WRITER: coach voice (2026-09-04). The one recorded voice reads
    // each movement's cue aloud during a session — the same cue lines
    // already on screen, nothing extra. Off by default; she turns it on
    // here. The body states two facts and stops: what it reads, and that
    // it stays silent on a day she answered "Keep it quiet" in the daily
    // prompt (same words as prompt.quiet.yes, on purpose — one promise,
    // kept where she made it). No voice name, no provider, no "coming
    // soon", nothing sold. The heading is one word because the body does
    // the explaining. The two rows name the plain state she gets —
    // "Spoken" / "Silent" — with equal dignity: off is not a loss, and
    // neither row mentions the other.
    voice: {
      title: "Voice",
      body: "Reads each movement's cue aloud during your session. Stays silent on any day you keep it quiet.",
      on: "Spoken",
      off: "Silent",
    },
    // COPY-WRITER: care journal (2026-09-02, ADR-0012 §4). Her heavy-day
    // notes, listed with delete. The privacy line is care.notePrivacy —
    // reuse it at the callsite, never duplicate it. Deleting is confirmed
    // once, calmly: the body is one factual line, because the note lives
    // only on this phone. No drama, no "are you sure?" theatre.
    careNotes: {
      title: "Your notes",
      empty: "No notes yet. Anything you write on a heavy day is kept here.",
      // Editing her own note is mundane (ADR-0012 §4): a quiet affordance
      // and a plain commit, no ceremony, no confirmation.
      editAction: "Edit note",
      saveEdit: "Save",
      deleteAction: "Delete note",
      deleteConfirmTitle: "Delete this note?",
      deleteConfirmBody: "This removes the only copy.",
      keepIt: "Keep it",
    },
    // Dev builds only, but still in-voice: plain, no jargon-wink.
    dev: {
      title: "Developer tools",
    },
  },
  // Progress screen (2026-09-01). Titled "Progress", not "Profile":
  // this screen shows what her body can do — pattern tiers, named
  // skills, points — not who she is. "Profile" invites identity/body
  // framing the product refuses.
  profile: {
    title: "Progress",
    patterns: {
      title: "Patterns",
      // Row labels for the five ladders. "Hip hinge", not bare "Hinge":
      // to a non-gym reader "Hinge" alone is ambiguous (it's also a
      // dating app), and "Hip hinge" names exactly what the pattern
      // trains — a movement, never a body-shape word.
      names: {
        push: "Push",
        pull: "Pull",
        squat: "Squat",
        hinge: "Hip hinge",
        core: "Core",
      } satisfies Record<Pattern, string>,
    },
    skills: {
      title: "Skills",
      // Forward-looking, zero guilt: says where skills come from,
      // never when, and never what's absent. "counts" echoes
      // finish.note ("That counts.").
      empty: "Named skills land here as you reach new tiers. Every session counts toward the first.",
    },
    points: {
      // A record of work done, never a balance: points buy nothing and
      // gate nothing (gamification.md), so no "balance"/"spend" shape.
      // finish.pointsLabel ("points") stays the in-session unit label;
      // this is the full ledger line.
      total: (points: number) =>
        points === 1 ? "1 point earned" : `${points} points earned`,
    },
    // Ladder length comes from the engine's MAX_TIER at the callsite —
    // copy never hardcodes product structure.
    tier: (tier: number, max: number) => `Tier ${tier} of ${max}`,
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
