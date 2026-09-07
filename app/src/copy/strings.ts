// Every user-facing string in the app lives here — components never hold
// literal user text. Written to fither-voice: calm coach, second person,
// short sentences, no guilt, forbidden list respected. Polished by
// copy-writer (2026-08-31); flag any new keys for review before release.

import type { BodyArea, Energy, Pattern, SessionMinutes } from "@fither/engine";

// COPY-WRITER (2026-09-07, weekly rhythm): headline and share-card counts
// are spelled out ("Three sessions this week."), the way the coach would
// say them. Words up to twenty and the three session lengths; anything
// beyond falls back to the numeral rather than inventing a word.
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
] as const;
const numberWord = (n: number): string => {
  if (n === 30) return "thirty";
  return NUMBER_WORDS[n] ?? String(n);
};
const capitalised = (word: string): string =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
// "Three sessions this week." / "One session this week." / 0 is a quiet
// week, never an empty one. Shared by the recap headline and the recap
// share card so the two never drift.
const sessionsThisWeek = (count: number): string => {
  if (count === 0) return "A quiet week.";
  if (count === 1) return "One session this week.";
  return `${capitalised(numberWord(count))} sessions this week.`;
};

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
  // COPY-WRITER (2026-09-06, owner decision): FITHER has a day streak —
  // consecutive calendar days with a completed block; one missed day per
  // run is a rest day the streak survives, the second ends it; best run kept.
  // Register: rule 3 stands. A missed day is a rest day, never a failure.
  // No "don't break", no "don't lose", no "we miss you"; the streak is a
  // plain count she can read, and today is only ever an invitation.
  streak: {
    // Hub and Progress, compact. Hyphenated compound, so 1 reads cleanly.
    label: (days: number) => `${days}-day streak`,
    best: (days: number) => (days === 1 ? "Best: 1 day" : `Best: ${days} days`),
    // Under the label once this run's one rest day is spent. "Taken", as
    // in hers to take — a fact, not a warning that the next one counts.
    restDayUsed: "Rest day taken.",
    // Hub, streak alive, nothing trained yet today. Names what today does,
    // never what a miss would cost.
    atRiskToday: "Today's session keeps it going.",
    // Finish screen. Day 1 is a start, not a run of one.
    finish: (days: number) => (days === 1 ? "Day 1." : `Day ${days} in a row.`),
    title: "Streak",
    // Progress card with no current run. Forward only: how one begins,
    // nothing about one that ended.
    none: "Any day you train starts one.",
    // Lock-screen bodies for the daily invitation; each stands alone and
    // stays under 90 characters at any day count. keepsGoing fires on an
    // untrained day while a run of `days` is alive — including the day
    // after a rest day, which is why it says "still". nextDay fires the
    // day after she trained; `days` is what today's session would make,
    // so it is always 2 or more.
    notification: {
      keepsGoing: (days: number) =>
        `Your ${days}-day streak is still going. Ten minutes today keeps it that way.`,
      nextDay: (days: number) =>
        `Today's session would make it ${days} in a row. Whenever you're ready.`,
    },
  },
  // COPY-WRITER (2026-09-07, weekly rhythm; mockups home-week and
  // weekly-recap): the Home tile and the recap's day strip. The week is a
  // plain count against a target she set herself (see `intention`), and
  // the count is only ever hers to read: nothing here names a shortfall,
  // a debt, or a day that went untrained. Days she did not train are
  // simply not filled in.
  //   · progress: the tile's first sentence, and the receipt's "This
  //     week" value. Full stop on purpose: the tile follows it with
  //     `nextLine`. Count may pass the target ("4 of 3 sessions."), which
  //     is honest and reads as pride, not error.
  //   · progressNoTarget: same slot with no target set. "so far" faces
  //     forward; 0 is a plain state with the smallest possible invitation.
  //   · nextLine: only while a target remains. Names the day, not the gap.
  //   · met: target reached. States the count and stops; a further
  //     session is still counted by `progress`, and this line never says
  //     "enough" or "stop".
  //   · dayLetters / dayNames: Monday first, the strip's labels and their
  //     accessibility names.
  week: {
    title: "This week",
    daysLabel: "Days trained",
    progress: (count: number, target: 2 | 3) => `${count} of ${target} sessions.`,
    progressNoTarget: (count: number) =>
      count === 0
        ? "Nothing yet. Any day counts."
        : count === 1
          ? "1 session so far."
          : `${count} sessions so far.`,
    nextLine: (weekday: string) => `${weekday}'s is next.`,
    met: (target: 2 | 3) => `${capitalised(numberWord(target))} this week. Done.`,
    dayLetters: ["M", "T", "W", "T", "F", "S", "S"],
    dayNames: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
  },
  // COPY-WRITER (2026-09-07, weekly rhythm; mockup weekly-intention): the
  // one question after her first session, and the Settings row that holds
  // the answer. `lead` says two facts and stops: it is a plan for the
  // week, and where she changes it. The draft's "Never a debt" is gone:
  // naming the debt is how it enters the room. Nothing about what a
  // target does for her; the options are three plain states with equal
  // dignity, and "No target" is not a lesser one.
  intention: {
    question: "How many sessions this week?",
    lead: "A plan for the week. Change it any time in Settings.",
    two: "Two",
    three: "Three",
    none: "No target",
    settingsRow: "Sessions a week",
    settingsValue: (target: 2 | 3 | null) =>
      target === 2 ? "Two" : target === 3 ? "Three" : "No target",
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
      // COPY-WRITER (2026-09-07, wave 1 "first use"): restrictions are asked
      // once. On a first session, when she has picked areas, a toggle row
      // under the grid offers to keep the picks as the permanent list
      // (settings.avoid, "Always work around"). A toggle label, so it
      // names what the switch does and stops: no caption under it. No
      // "these"/"this": the row also renders on a single pick, where
      // "these" breaks (same reason as onboarding.avoid.confirm). Off is
      // the plain state; the label never says what she'd lose by leaving
      // it off.
      remember: "Remember for every session",
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
    // COPY-WRITER (2026-09-07, owner feedback): the no-session screen
    // recommends, it does not describe. The engine reports which of the
    // avoided areas would, set aside for today only, let a session build.
    // Order on screen: `headline` (the situation, count is always 3 or
    // more), `instruction`, one `setAside` row per unblocking area (the
    // caller passes the area label lowercased), `settingsNote` only when
    // at least one avoided area came from Always work around, then
    // preview.changeAnswers. Setting aside is today only; the Settings
    // list is never touched, and settingsNote says so in the list's own
    // name. `none` replaces the rows when no single area unblocks;
    // errors.noSession stays the fallback below it. No blame: the areas
    // are named as a count, never as her choices, and nothing is wrong.
    noSession: {
      headline: (count: number) => `No session fits around ${count} areas.`,
      instruction: "Set one aside for today and your session builds.",
      settingsNote: "Today only. Always work around in Settings stays as it is.",
      setAside: (area: string) => `Set aside ${area} today`,
      none: "Set two aside today, from your answers or from Always work around in Settings.",
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
    // COPY-WRITER (2026-09-07, redesign mockups): top-right caption on the
    // block intro and the feedback question, which exercise this is of how
    // many today. Bare numerals as the mockup shows ("1 of 3"): the screen
    // is already the exercise, so no noun, and it stays distinct from
    // setCounter beside it. If a noun is ever needed it is "exercise", the
    // word she already reads in skipBlock, never "block".
    blockCounter: (current: number, total: number) => `${current} of ${total}`,
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
      // COPY-WRITER (2026-09-07, redesign mockups): value revised, key
      // unchanged. This is the one line under "Switch sides", so no
      // sibling `sideSwitch.line` key: one slot, one key. Six words, read
      // aloud in a pause. Side neutral on purpose: it no longer presumes
      // the right side comes second, so it stays true whichever side led.
      // "Same again" says the set is identical, nothing new to learn.
      switchBody: "Same again on the other side.",
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
    // COPY-WRITER (2026-09-07, redesign mockups): the care moment is now
    // its own screen before the preview, so it carries two buttons.
    // `continue` names where the tap goes (the preview, whose headline is
    // "Your session is ready"), never "Start": nothing starts here.
    // `skip` (pinned 2026-09-07) skips the note only: the quiet button
    // goes straight on to the same preview as `continue`, and nothing is
    // declined. The label names exactly that, so it never reads as
    // turning down today's session. If the quiet button ever declines
    // the session instead, this label is wrong and must change.
    continue: "See today's session",
    // COPY-WRITER (2026-09-07): the same button when the engine could NOT
    // build around today's areas. `continue` would be false here: there is
    // no session yet. The tap goes to daily.noSession ("No session fits
    // around N areas." with the set-aside rows), a screen that recommends,
    // so the label promises a next step, not a session. Same "See ..."
    // shape as `continue` so the two buttons feel like one control.
    // Rejected "Find a way through": too dramatic for the care beat, and
    // it promises a way exists when noSession.none may say it does not.
    continueNoSession: "See what to do",
    skip: "Skip the note",
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
    // COPY-WRITER (2026-09-07, wave 1 "first use"): the preview explains
    // today's session as a short list of engine facts, one line each,
    // under `factsTitle`. Every line is a fact the engine actually
    // reports (Session.adaptations plus the prompt's own answers); the
    // UI maps, it never re-derives. Caption: "Why it fits", three words
    // that name the list's job (the domain's "show the adaptation": why
    // today's session fits her answers) and echo the tagline's verb. Not
    // "Built for today": the eyebrow above already says "Made for today",
    // and the two would sit on one screen saying the same thing twice.
    //   · minutes: a count, full stop. "movements" is the word she reads
    //     for the library everywhere else ("Every movement stays quiet",
    //     voice.body); singular handled.
    //   · avoid: `areas` arrives lower case ("knees and back"). "loads" is
    //     the plain verb; no "protect", no "injury", no caution-speak.
    //   · lowEnergy: the real numbers (spec: 3 sets per block, 2 on low
    //     energy, same tier). Cause named last, as her answer, not a state.
    //   · quiet: only ever emitted when the filter removed something.
    //   · floorOnly / withChair: her equipment answer, read back. The wall
    //     is ambient in the engine (every room has one) so neither line
    //     names it; the two lines are parallel so the chair reads as one
    //     more thing in the same room, never as "better".
    //   · softLanding: `pattern` lower case ("push", "hip hinge"). "since"
    //     makes the hard set a reason, not a verdict; she said "Hard today"
    //     and this is that answer kept.
    //   · staleFocus: fires at 3 or more training days without the
    //     pattern, so "a few sessions" is literal. Counted in her sessions,
    //     never in days away (rule 3: absence is never named).
    //   · taste: `movement` is the library name ("Full Push-Up"). One set,
    //     optional, both stated; "first look" as in adaptations.tasteBlock.
    // No dashes; each line under 50 characters at any input.
    factsTitle: "Why it fits",
    facts: {
      minutes: (minutes: number, blocks: number) =>
        `${minutes} minutes, ${blocks} ${blocks === 1 ? "movement" : "movements"}.`,
      avoid: (areas: string) => `Nothing that loads your ${areas}.`,
      lowEnergy: "Two sets instead of three, for low energy.",
      quiet: "Every movement stays quiet.",
      floorOnly: "Just you and the floor.",
      withChair: "You, the floor and a chair.",
      softLanding: (pattern: string) => `Lighter on ${pattern}, since last time was hard.`,
      staleFocus: (pattern: string) =>
        `${pattern.charAt(0).toUpperCase()}${pattern.slice(1)} is back today. It's been a few sessions.`,
      taste: (movement: string) => `Ends with a first look at ${movement}. One set, optional.`,
    },
  },
  // Onboarding — docs/copy/draft-strings.md §1, wired verbatim. Three
  // screens, one decision each, then the handoff eyebrow atop the first
  // daily-prompt question. Nothing else may spend Gate 3 budget.
  onboarding: {
    welcome: {
      headline: "Strength that fits your life.",
      // COPY-WRITER (2026-09-06, owner review): body departs from the
      // draft-strings wording. On a first run this screen follows the
      // sign-in line directly, and `auth.welcomeSub` now owns the terms
      // (the three lengths, no equipment, adapted daily) — so this line
      // does the other job: what "fits" means. The daily mechanic (four
      // quick answers build today's session) and the arc (stronger over
      // weeks). "Four" sets up `handoff.line` ("Four answers to today's
      // plan."). No "10, 20 or 30", "no equipment", "adapted", "actually"
      // or "built for". 19 words; the headline stays the brand tagline
      // (ADR-0006) and the CTA stays "Begin".
      body: "Each day, four quick questions build your session: time, energy, quiet, anything sore. Week by week, you get stronger.",
      cta: "Begin",
    },
    equipment: {
      // COPY-WRITER (2026-09-07, wave 1 "first use"): a fresh install opens
      // here as a guest, so this is now the first screen she reads. The
      // brand headline (welcome.headline, ADR-0006) sits above; `lead`
      // does what auth.welcomeSub used to do on a first run, the terms in
      // one breath (three lengths, adapted daily), then turns toward the
      // question below with the room she is standing in. Numerals, the
      // same shape as the prompt's own buttons. No "no equipment": the
      // question that follows says it better than a claim would. 15 words.
      lead: "10, 20 or 30 minutes, adapted to you every day. First, the room you're in.",
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
  // second-class for skipping an account. The Apple wording is the
  // platform-sanctioned convention — do not restyle it. Google sign-in
  // was removed by owner decision (2026-09-07).
  auth: {
    // COPY-WRITER (2026-09-06, owner review): the first words she reads.
    // Black ground, the mark, FITHER, this line, two buttons — so it sells
    // the product in one breath, not the choice below. Two lines split
    // the promise so neither repeats a word of the other: `welcome` is
    // the outcome (stronger, anywhere, on her clock), `welcomeSub` is
    // the concrete terms (the three lengths, no equipment, adapted daily).
    // Not the tagline: onboarding's welcome headline owns the brand
    // moment (ADR-0006) and follows this screen directly on a first run,
    // so the pair is written to sit beside it, not echo it — different
    // verbs, no "actually", no "built for". Every claim is one the app
    // keeps offline today; nothing about accounts or sync (ADR-0011 §5).
    welcome: "Get stronger anywhere, on your own time.",
    welcomeSub: "10, 20 or 30 minutes. No equipment. Adapted to you, every day.",
    apple: "Continue with Apple",
    guest: "Continue without an account",
    // Owner review (2026-09-06): the two captions that used to sit under
    // the buttons (what an account does today; that training lives on
    // the phone) were cut — a choice screen carries its options and one
    // line of framing, nothing under the buttons.
    error: "Couldn't sign you in. Try again in a minute, or continue without an account.",
  },
  // COPY-WRITER (2026-09-06, owner review: "uninspiring copy, not enough
  // images"). The screen is rebuilt around one picture: the push ladder,
  // six line figures from wall push-up to full push-up, the tiers she
  // has reached in green. The words now frame that picture instead of
  // explaining everything in a letter. Order on screen: letterhead,
  // `headline` (the promise, capability only: the first full push-up,
  // never a body), `lead` (one line that captions the ladder: six tiers
  // per movement, her pace), the image, three `benefits` (each a fact
  // the app keeps offline today), `trialLine`, the plan rows, `cta`.
  // Still annual led, plain prices, no countdowns, no strikethroughs,
  // no user counts, no "transform". `letter` is kept in place because
  // paywall-screen.tsx and the expired variant still read the key shape;
  // drop it with the screen, not before.
  paywall: {
    headline: "Your first full push-up starts here.",
    lead: "Six tiers for every movement. You climb at your own pace.",
    letter:
      "FITHER is one subscription and it covers everything: every session, every length, adapted daily to your time, energy and surroundings. It works offline, on a plane or in a quiet house at 6am. No ads, nothing sold separately.",
    benefits: {
      adapts: "10, 20, 30 minutes, adapted daily.",
      anywhere: "Works offline, wherever you are.",
      simple: "No equipment. No ads.",
    },
    trialLine: "7 days free. Cancel before the week ends and pay nothing.",
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
        "You've had the full seven days: every session, every length, adapted daily. A subscription covers exactly what you've been using: works offline, no ads, nothing sold separately.",
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
      "10, 20 and 30 minutes, all of them",
      "Works fully offline",
      "Skill milestones as you get stronger",
      "No ads, ever",
    ],
  },
  // COPY-WRITER (2026-09-06, owner decision; ADR-0014 §2): the one-time
  // offer screen, reshaped to match the redesigned paywall rather than
  // its letter. Shown ONCE, on day 3 of her free week, and only after
  // she has switched off the trial's auto-renew. Order on screen:
  // `headline` (the promise: keeping the climb she has started, the
  // same ladder image the paywall uses), `lead` (two plain facts: her
  // free week still ends free with nothing charged, and this is the one
  // other way to keep FITHER), `body` (one sentence, what one payment
  // covers), `priceLine`, `cta`, `decline`. Her auto-renew choice is
  // acknowledged as a fact in "still ends free", never questioned. No
  // urgency, no countdown, no "last chance", no "only today", no
  // strikethrough, no "best value". `priceLine` is the amount in prose
  // form; if the screen also renders the paywall.plans.lifetime row,
  // show one or the other, not both. `cta` names the outcome she gets.
  // `decline` names the plain state she is already in, with equal
  // dignity: it is the default path, not a loss. The old "We'll only
  // ask once" line is dropped with the letter; the once-only rule is
  // enforced by the ask record, not by the copy.
  lifetimeOffer: {
    headline: "Keep the climb.",
    lead: "Your free week still ends free, nothing charged. One other way to keep FITHER.",
    body: "One payment covers every session, every length, adapted daily, for good.",
    priceLine: "$99, once.",
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
      // COPY-WRITER (2026-09-07, redesign mockups): the headline above
      // `line`. A question, because the screen is asking: four words, the
      // coach's voice, answered by "Sounds good" below. "Daily note" is
      // already her term for it (notifications.time.question asks "your
      // daily note"), so the ask and the slot picker name one thing.
      headline: "Want a daily note?",
      line: "One quiet note a day, an invitation to build today's session. That's all we'd ever send.",
      allow: "Sounds good",
      decline: "Not now",
    },
    // These four are the NOTIFICATION BODIES of the one daily invitation —
    // the ui-engineer rotates or picks among them when scheduling. Keep
    // them interchangeable: any of them must stand alone on a lock screen.
    daily: {
      fourAnswers:
        "Today's session is four answers away. Ten, twenty or thirty minutes. Your call.",
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
    // COPY-WRITER (2026-09-07, weekly rhythm): the daily invitation
    // reworded for a week target. Each body stands alone on a lock screen,
    // stays under 90 characters, and states nothing that could be stale
    // by the time it fires: no "yesterday", no "still", no "new week".
    // Every number in `onTrack` is a fact at scheduling time, so the
    // scheduler must rebuild it after any session is saved. Conditional
    // "would", as in streak.notification.nextDay: today is an invitation,
    // never a due date. `met` never says "enough" or "done for the week":
    // a further session counts just as much, and the line says so.
    weekly: {
      onTrack: (count: number, target: number) =>
        count === 0
          ? `Today's session would be your first of ${target} this week.`
          : `${count} of ${target} this week. Today's session would make it ${count + 1}.`,
      noTarget: "Ten minutes today, if today fits.",
      met: "Your week's target is met. Another session counts just as much.",
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
    // COPY-WRITER (2026-09-07, weekly rhythm; mockup finish-receipt): the
    // four-row receipt under the movement figures. Labels left, values
    // right, no full stops on values (they are column entries, not
    // sentences). "Hard today" reuses the feedback answer's own words
    // (player.feedback.options.hard) so the row names exactly what she
    // said. `length` says "planned" because the app does not measure
    // active time; it must never claim minutes she spent. The "This week"
    // row's value is week.progress / week.progressNoTarget, which carry a
    // full stop for the Home tile; the callsite trims it here. `share`
    // is the quiet button; same words as share.action, a separate key so
    // this screen stays free to diverge.
    receipt: {
      doneLabel: "Done",
      done: (n: number) => (n === 1 ? "1 movement" : `${n} movements`),
      hardLabel: "Hard today",
      hard: (n: number) => (n === 1 ? "1 movement" : `${n} movements`),
      lengthLabel: "Session length",
      length: (minutes: number) => `${minutes} minutes planned`,
      weekLabel: "This week",
      share: "Share this",
    },
  },
  // COPY-WRITER (2026-09-07, weekly rhythm; mockup weekly-recap): the
  // week's page. `title` is the date range the app formats ("1 to 7
  // September"), rendered as the caption; nothing added to it. `headline`
  // is the count in words; 0 is "A quiet week.", a fact with no verdict.
  // The rows are receipts for the week: minutes are "planned" for the same
  // reason as finish.receipt.length, movements are counted as done.
  // `tierLabel` is the pattern's own name (profile.patterns.names) and
  // `tierValue` uses "reached", the honest tier-entry verb (ADR-0012 §3).
  // `noChange` replaces the tier rows on a week with no new tier: it
  // never invents improvement and never hedges the sessions with "still".
  recap: {
    title: (range: string) => range,
    headline: (count: number) => sessionsThisWeek(count),
    minutesLabel: "Minutes planned",
    movementsLabel: "Movements done",
    tierLabel: (pattern: string) => pattern,
    tierValue: (tier: number) => `Tier ${tier} reached`,
    noChange: "No new tier this week. Each session counts.",
    share: "Share this week",
    settingsRow: "Weekly recaps",
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
      `${skill}, now in my training. With FITHER.`,
    card: {
      // Rendered beneath the skill name. Honest tier-entry framing
      // (ADR-0012 §3), and still proud — she earned her way here.
      line: "Now in training.",
      // COPY-WRITER (2026-09-07, redesign mockups): the quiet button
      // beside share.action on the share screen. Never drawn on the card
      // image itself. Same two words as notifications.rationale.decline,
      // deliberately a separate key: a notifications key imported into
      // the share screen would read as a bug at review, and the two
      // surfaces must stay free to diverge. Not "Skip" (nothing is being
      // passed over) and not "Maybe later" (no promise to ask again).
      notNow: "Not now",
    },
    // COPY-WRITER (2026-09-07, weekly rhythm; mockup share-receipt): share
    // from a finish receipt or a recap, with one optional public context.
    // The card says where, how long, and that it was complete: three
    // fragments, each a fact, nothing about the body. Minutes in words
    // (Ten, Twenty, Thirty) because the card is read, not tallied. `skip`
    // is the fourth context chip: it passes over the question, which is
    // exactly what it does. `message` is hers, first person, and names
    // no minutes because the card beside it already does; the app appends
    // the URL. `card.week` is the recap card's headline, same words as
    // recap.headline so the page and its card agree.
    context: {
      question: "Where were you?",
      home: "Home",
      hotel: "Hotel",
      meetings: "Between meetings",
      skip: "Skip",
      card: {
        headline: (
          context: "home" | "hotel" | "meetings" | null,
          minutes: number,
        ) => {
          const time = `${capitalised(numberWord(minutes))} minutes. Session complete.`;
          if (context === "hotel") return `Hotel room. ${time}`;
          if (context === "meetings") return `Between meetings. ${time}`;
          if (context === "home") return `At home. ${time}`;
          return time;
        },
        sub: (movements: number) =>
          movements === 1
            ? "One movement, no equipment."
            : `${capitalised(numberWord(movements))} movements, no equipment.`,
        week: (count: number) => sessionsThisWeek(count),
      },
      message: (url: string) =>
        `Built for the room I was in. No equipment. Try yours: ${url}`,
      notNow: "Not now",
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
    // COPY-WRITER (2026-09-07, redesign mockups): Settings is a grouped
    // list, values at the right, chevrons to subpages. Four section
    // eyebrows; three of them REUSE the subpage titles so the eyebrow is
    // the word she lands on:
    //   · invitation → reminders.title ("Daily invitation")
    //   · subscription → restore.title ("Subscription")
    //   · account → account.title ("Account")
    // Only `training` is new. One word, the plain name for the group that
    // shapes every session (work-arounds, equipment, voice).
    sections: {
      training: "Training",
    },
    // Row labels and right-hand values. Labels that already exist as
    // subpage titles are reused, never duplicated: the work-around row is
    // avoid.title ("Always work around"), the voice row is voice.title
    // ("Voice", with voice.on / voice.off as its values; the mockup's
    // "Coach voice" is dropped, the page heading is one word and the row
    // matches it), the notes row is careNotes.title ("Your notes"), and
    // the invitation slot values are notifications.time.morning / midday
    // / evening. Values are short because the column is narrow: they
    // state the setting, they never sell it.
    rows: {
      equipment: "Equipment",
      // The onboarding options ("Just me and the floor", "A sturdy chair
      // too") are a question's answers and too long for a value column;
      // these are the same two facts as settings, flat.
      equipmentValue: {
        floorOnly: "Floor only",
        chair: "Floor and a chair",
      },
      // Work-around row value. One area is the caller's job (it shows the
      // area's own label from prompt.soreness.areas); this covers none
      // and several. A count, never "restrictions" or "problems": these
      // are her preferences. Stays total for 1 anyway.
      avoidValue: {
        none: "None",
        many: (count: number) => (count === 1 ? "1 area" : `${count} areas`),
      },
      // The invitation slot row. `timeOff` is the value when there is no
      // invitation; the subpage keeps reminders.off ("No invitation") as
      // its fourth option, this is the same state in column width.
      time: "Time",
      timeOff: "Off",
      // Notes row value. "No notes" over "None": beside "Your notes" a
      // bare "None" reads as an error state; this reads as an ordinary one.
      notesValue: (count: number) =>
        count === 0 ? "No notes" : count === 1 ? "1 note" : `${count} notes`,
      // Subscription row. Its value is the plan's own label
      // (paywall.plans.*.label), or plan.trial / plan.none below.
      plan: "Plan",
    },
    // The subscription subpage. Order on screen: title (restore.title),
    // `intro`, then the rows: the Plan row (reuse rows.plan) with the
    // plan's label, `renews` with the date, `price` with the amount, then
    // restore.manage and paywall.restore as the actions. `intro` is one
    // line of plain fact, ten words: where the subscription lives and
    // that she can change or cancel it there. No terms recap, no upsell.
    // `trial` is the Plan value during an active free week (same words as
    // the paywall: "your free week"). `none` is the Plan value before any
    // purchase: not an error, not a prompt. Never render `renews` beside
    // the lifetime plan, it has no renewal (see paywall.plans.lifetime).
    plan: {
      intro: "Managed through the App Store. Change or cancel there anytime.",
      renews: "Renews",
      price: "Price",
      none: "None yet",
      trial: "Free week",
    },
    // The header under the account status (account.status.*). One fact,
    // the day her record began; the caller formats the date. "Training
    // since", not "Member since": it names what she does, not a
    // membership, and it holds for a guest with equal dignity.
    profile: {
      since: (date: string) => `Training since ${date}`,
    },
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
    // COPY-WRITER: account (2026-09-05, App Review 5.1.1(v)). No server, so
    // status says how she is continuing (guest with equal dignity), and
    // "Erase" is the honest name, not "delete account": the confirm lists
    // what goes from this phone, once, and that no copy exists elsewhere.
    account: {
      title: "Account",
      status: {
        apple: "Signed in with Apple",
        guest: "Continuing without an account",
      },
      // COPY-WRITER (2026-09-07, wave 1 "first use"): Sign in with Apple
      // moves here from the retired sign-in screen. `signIn` is the row,
      // in Apple's own sanctioned wording, do not restyle. `signInLead` is
      // the one line above it for a guest, and it is deliberately honest:
      // there is no server, so an account keeps nothing, syncs nothing and
      // restores nothing today. It states the fact (no account needed) and
      // leaves the door open, with no reason attached because none exists
      // yet. "Sign in", not "Sign in with Apple": the row directly below
      // says the provider, and one screen should not say it twice. When a
      // real benefit ships (backup, a second phone) this line changes to
      // name it, and only then.
      signIn: "Sign in with Apple",
      signInLead: "No account needed. Sign in if you like.",
      signOut: "Sign out",
      signOutNote: "Your training stays on this phone.",
      erase: "Erase everything on this phone",
      eraseConfirmTitle: "Erase everything on this phone?",
      eraseConfirmBody:
        "This removes your training history, points and skills, notes and settings from this phone. There is no copy anywhere else.",
      keepIt: "Keep it",
      eraseAction: "Erase everything",
    },
    // Dev builds only, but still in-voice: plain, no jargon-wink.
    dev: {
      title: "Developer tools",
    },
  },
  // COPY-WRITER: feedback (2026-09-07, owner decision). One row under the
  // Account group in Settings, one subpage: a text field, an optional
  // email, a Send button. It posts to a small endpoint that emails the
  // owner, and queues on the phone while offline. The lead says two
  // things and stops: it reaches a person, and what is useful to write.
  // No "we value your feedback": the fact that a person reads it is the
  // valuing. `sentNote` promises a real inbox, never a reply time. `queued`
  // is a plain state, not an apology. `privacy` lists exactly what goes
  // (her words, app version, phone model) and what never does (anything
  // about her training), and that no name or account rides along unless
  // she types one. `failed` keeps her words on screen and names the
  // retry: the Send button stays, so it says "Send again", not
  // errors.tryAgain. Every line under 90 characters except lead and
  // privacy.
  feedback: {
    row: "Send feedback",
    title: "Tell us what you think",
    lead: "This goes to the person who makes FITHER. Most useful: what got in the way, and what you wish it did.",
    placeholder: "What's on your mind?",
    send: "Send",
    sent: "Sent. Thank you for taking the time.",
    sentNote: "It lands in a real inbox, read by one person, so a reply can take a while.",
    queued: "Saved on this phone. It sends on its own when you're back online.",
    privacy:
      "Your words go with the app version and your phone model. Nothing about your training. No name or account is attached unless you write one.",
    includeEmail: "Your email, if you'd like a reply",
    emailPlaceholder: "Optional",
    failed: "Couldn't send this just now. Your words are still here. Try Send again in a minute.",
    // COPY-WRITER TO REVIEW (ui-engineer, 2026-09-07): the one button on the
    // sent state, per the approved mockup settings-feedback-sent.
    done: "Done",
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
      // COPY-WRITER (2026-09-07): caption above the Progress tab's
      // next-skill tile (the movement she is climbing toward, with the
      // tile's own "N tiers ahead" line). Was reusing `title`, which
      // named the earned list, not the one ahead. Capability framing:
      // it is a skill she reaches, never a goal she is behind on.
      nextTitle: "Next skill",
      // Forward-looking, zero guilt: says where skills come from,
      // never when, and never what's absent. "counts" echoes
      // finish.note ("That counts.").
      empty: "Named skills land here as you reach new tiers. Every session counts toward the first.",
      // COPY-WRITER TO REVIEW (ui-engineer, 2026-09-07): the name of a
      // milestone when the movement library is absent (a degraded build
      // only). Says the ladder and the rung in her own vocabulary
      // ("Push", "Tier 4 of 6") instead of a raw pattern id.
      unnamed: (pattern: string, tier: string) => `${pattern}, ${tier}`,
    },
    points: {
      // A record of work done, never a balance: points buy nothing and
      // gate nothing (gamification.md), so no "balance"/"spend" shape.
      // finish.pointsUnit stays the in-session unit label; this is the
      // full ledger line.
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
    // COPY-WRITER (2026-09-06): verified — the pool only empties at three
    // or more areas combined across today's answer and settings.avoid.
    noSession: "No session fits around this many areas. Drop one from today's answers, or from Always work around in Settings.",
    preparing: "Getting your progress ready…",
    storageUnavailable: "Couldn't load your progress. Please reopen the app.",
    saveUnavailable: "Couldn't save this session. Try again in a minute.",
    tryAgain: "Try again",
  },
} as const;

export type Strings = typeof strings;
