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
// COPY-WRITER (2026-09-07, wave 4, place preset): the two places, named
// once. place.home / place.hotel and place.value read from here so the
// Settings row's value and the page's options can never disagree.
const PLACE_LABELS = {
  home: "Home",
  hotel: "Hotel",
} as const;
// COPY-WRITER (2026-09-08, owner decision): what the recorded voice says
// at 5, 4, 3, 2 and 1 seconds left on a timed hold or a rest. Each string
// is also the key of its own bundled audio file, which is why this is a
// table and not arithmetic on NUMBER_WORDS: whoever records the voice
// reads the exact text here. player.countdown reads from it.
// COPY-WRITER (2026-09-09, preview rebuild): the work-around areas as a
// spoken list, "elbows, knees and core". Commas, "and" before the last,
// no serial comma, no dashes. Areas arrive lower case from the caller,
// the same contract preview.facts.avoid already used.
//
// Four or more areas stop being a list a person can hear in one breath,
// so the phrase names the first two and counts the rest: "shoulders,
// wrists and two more". Every area is still accounted for, none is
// singled out, and the sentence keeps its length whatever she picked.
// Never called with an empty list: preview.facts.opening drops the whole
// clause when there is nothing to work around.
const areaPhrase = (areas: string[]): string => {
  const [first = "", second = "", ...rest] = areas;
  if (areas.length === 1) return first;
  if (areas.length <= 3) {
    return `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1] ?? ""}`;
  }
  return `${first}, ${second} and ${numberWord(rest.length)} more`;
};
const COUNTDOWN_WORDS = {
  5: "Five seconds",
  4: "Four",
  3: "Three",
  2: "Two",
  1: "One",
} as const;

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
    // COPY-WRITER (2026-09-12, owner decision, approved mockup): the ONE
    // caption line under the Progress streak tile's numeral, carrying both
    // facts where `label` and `best` used to stack two lines. Two lines made
    // the pair lopsided beside the points tile's single "points"; one line
    // per tile is what the mockup always had.
    //
    // The numeral above is the current run, so this line never repeats it:
    // "day streak" is the bare unit, the same shape and the same lower case
    // as the points tile's `finish.pointsUnit`. The compound is invariant, so
    // a run of 1 reads "1 / day streak" and needs no singular guard.
    //
    // `best` is only named when it is a HIGHER number than the run, because
    // that is the only case where it is a fact she cannot already read off
    // the numeral. When her best IS this run (every day she extends her
    // record, which for a new user is most days) the line is the unit alone:
    // honest, and it keeps the proudest case free of a duplicated number.
    // No superlative there either ("your best yet" every other day stops
    // meaning anything, and at a run of 1 it is hollow); the finish screen
    // owns pride, this tile is a readout. Numerals on both halves, as the
    // mockup reads and as the other counted captions do. Middle dot, not a
    // dash (owner rule).
    //
    // It must never name a run that ended, a gap, or what a missed day would
    // cost: no "was 9", no "9 to beat", no "best ever". The best is a thing
    // she has done, never a target set for her.
    //
    // VOICE-OVER NOTE for the callsite: StatTile speaks only the
    // accessibilityLabel the caller builds, never the numeral, so this line
    // must not be the spoken reading on its own ("day streak · best 9" has
    // no count in it). Keep the spoken label built from `streak.title` plus
    // `label(current)` plus `best(best)` when best is higher. Both those
    // keys stay live for that, and for the hub (home/streak-line.tsx).
    tileCaption: (days: number, best: number) =>
      best > days ? `day streak · best ${best}` : "day streak",
    // RETIRED (COPY-WRITER 2026-09-12, owner: "rest-day taken is
    // unnecessary"). It was the third caption line on the Progress streak
    // tile, which made the two stat tiles lopsided, and it reported a
    // mechanic she never asked about. Progress is its only callsite
    // (progress-screen.tsx streakLines, plus two assertions in
    // progress-screen.test.tsx), so this key is dead copy the moment the
    // ui-engineer drops that line and its tests. Do not render it
    // anywhere new, and do not replace it with a warmer version: the rest
    // day needs no caption at all.
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
  //
  // `count` is distinct DAYS trained, not sessions (owner rule: two
  // sessions on one day never read as two planned training days). So
  // every line here says "days". The intention still asks "How many
  // sessions this week?" because its answer means sessions on different
  // days; that is the one place the word stays. recap.headline counts
  // sessions and says so; it is a different number and must not share
  // these lines.
  //   · progress: the tile's first sentence, and the receipt's "This
  //     week" value. Full stop on purpose: the tile may follow it with
  //     `remaining`. Count may pass the target ("4 of 3 days trained."),
  //     which is honest and reads as pride, not error.
  //   · progressNoTarget: same slot with no target set. "so far" faces
  //     forward; 0 is a plain state with the smallest possible invitation.
  //   · remaining: only while a target remains. Names the small weekly
  //     commitment without assigning a calendar day she never chose.
  //   · met: target reached. States the count and stops; a further day
  //     is still counted by `progress`, and this line never says "enough"
  //     or "stop".
  //   · dayLetters / dayNames: Monday first, the strip's labels and their
  //     accessibility names.
  week: {
    title: "This week",
    daysLabel: "Days trained",
    progress: (count: number, target: 2 | 3) => `${count} of ${target} days trained.`,
    remaining: (count: number) =>
      count === 1
        ? "One more session completes your week."
        : `${capitalised(numberWord(count))} sessions still fit this week.`,
    progressNoTarget: (count: number) =>
      count === 0
        ? "Nothing yet. Any day counts."
        : count === 1
          ? "1 day trained so far."
          : `${count} days trained so far.`,
    met: (target: 2 | 3) => `${capitalised(numberWord(target))} days this week. Done.`,
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
      // COPY-WRITER (2026-09-07, wave 4, place preset): caption on this
      // question when Where I train has Quiet movements set to Always,
      // so "Keep it quiet" arrives already selected. A line is needed:
      // an answer she did not tap, with nothing said about it, reads as
      // a slip. Two facts. Why it is set ("Always" is the setting's own
      // word, "this place" is the page's), and that today is still hers,
      // in the words place.lead already used. Nothing about where the
      // setting lives: she is a few taps from a session and Settings can
      // wait. Renders only when the preset made the choice, never on
      // "Ask me each day".
      presetLine: "Always quiet for this place. Today's answer is still yours.",
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
    // avoided areas would, included again for today only, let a session
    // build. Order on screen: `headline` (the situation, count is always
    // 3 or more in production), `instruction`, one `setAside` row per
    // unblocking area (the caller passes the area label lowercased),
    // `settingsNote`, then preview.changeAnswers. `none` replaces the
    // rows when no single area unblocks; errors.noSession stays the
    // fallback below it. No blame: the areas are named as a count, never
    // as her choices, and nothing is wrong.
    //
    // COPY-WRITER (2026-09-08, owner live-device feedback: "why they need
    // to remove something should be crystal clear, show do not tell").
    // The rows used to read "Set aside hips today", which reads as the
    // OPPOSITE of the tap: tapping means hips are worked today after all,
    // gently, at her tier. Every line is now built on "include", the plain
    // antonym of "work around" she already knows from the prompt. Rejected
    // "Work hips today": too close to the preview's "Works around your
    // hips today" to be safe. The key name `setAside` is unchanged (typed,
    // tested); only its words are. `instruction` is one line pointing at
    // the rows ("one of these"), so the rows do the showing. `settingsNote`
    // is the shortest true line: the tap is today only and never edits
    // Settings. `headline` keeps its shape and gains a singular guard.
    noSession: {
      headline: (count: number) =>
        `No session fits around ${count} ${count === 1 ? "area" : "areas"}.`,
      instruction: "Include one of these and your session builds.",
      settingsNote: "Today only. Settings stay as they are.",
      setAside: (area: string) => `Include ${area} today`,
      none: "Include two areas today, from your answers or Settings.",
    },
  },
  player: {
    sessionProgress: "Session progress",
    begin: "Begin",
    setDone: "Done",
    skipBlock: "Skip exercise",
    // COPY-WRITER (2026-09-12, owner decision: the skip confirmation screen
    // is deleted). The quiet skip button is now a two-tap control. At rest
    // it reads `skipBlock`; the first tap swaps in this label, the second
    // tap skips, and the button returns to `skipBlock` by itself after a
    // few seconds. No dialog, no paragraph, nothing else on screen moves.
    //
    // This label is therefore the ONLY warning she gets, which is why it
    // spends a fourth word: it names the exact gesture that does the thing
    // ("again") and the thing itself ("skip"), so the consequence of the
    // second tap cannot be misread. Shorter candidates all lost something
    // load-bearing: "Tap to skip" does not say a second tap, "Again to
    // skip" is not a sentence, "Skip: tap again" reads like an app
    // explaining itself rather than a coach.
    //
    // What it must never become: a countdown ("Tap again within 3 seconds",
    // "3..."), because the disarm is a convenience, never a clock she is
    // racing; a threat or a cost ("You'll lose this exercise", "This won't
    // count"), because skipping costs her nothing and a warning label is
    // the worst possible place to imply otherwise; a question ("Sure?"),
    // because the deleted screen was the question and the owner rejected
    // it twice; or a plea ("Keep going?"), because the armed state must not
    // argue with her. It states the gesture and stops.
    skipBlockArmed: "Tap again to skip",
    // COPY-WRITER (2026-09-12, owner decision, owner's own phrase): the
    // brief toast after a skip lands, a couple of seconds, then gone. It
    // confirms what happened by naming where she is now, which is all a
    // toast can usefully do. Forward only: it never congratulates her for
    // skipping (nothing was achieved) and never marks it as a loss
    // (nothing was). It does not name the movement she skipped, so the
    // line never reads as a record of what she did not do.
    //
    // `skipped` is the owner's wording verbatim, with the full stop the
    // sentence already had; it survives the voice filter unchanged.
    // `skippedLast` exists because the toast also fires on the final
    // exercise, where "the next one" would be false: the only thing after
    // it is the close of the session. It states that plainly, in the past
    // tense, and claims nothing about the session itself. The finish
    // screen that follows owns the honest close (finish.endedEarly.note /
    // finish.nothingDone.note) and may say "Today didn't fit", so this
    // line must never imply completion ("All done", "That's the session
    // complete") and never imply a shortfall either.
    skipped: "Onto the next one.",
    skippedLast: "That was the last one.",
    repsLabel: "reps",
    holdLabel: "seconds",
    rest: "Rest",
    restNote: "Breathe.",
    // COPY-WRITER (2026-09-12, owner decision: the rest screen loses both
    // its buttons). The rest has always counted itself down and started the
    // next set by itself (player-machine: rest ticks to zero and work
    // begins), so "I'm ready" and the quiet skip were offering her a tap for
    // something already on its way. This one quiet line at the foot of the
    // screen replaces them: a promise being kept, stated once.
    //
    // Deliberately the same "starts on its own" as `player.autoStart` and
    // `player.sides.autoStart`, so the three hand-offs in the session speak
    // one phrase and she learns it once. Its own key, because this slot has
    // no seconds in it: the big numeral above is already the count, and
    // repeating it in words would turn a reassurance into a clock. The next
    // set is the grammatical subject, not the object, because the subject is
    // the true one here: the set arrives, she does nothing. Rest only ever
    // precedes another set of the same movement (the last set goes straight
    // to the feedback question, no trailing rest), so "the next set" is
    // always true and never has to guard a final case.
    //
    // What it must never become: a countdown or anything with "in", "left"
    // or "remaining" (the numeral is the clock; this line is the promise, and
    // `countdown` refuses "left" for the same reason); an instruction or any
    // imperative ("Get ready", "Stay down", "Breathe until it starts") — she
    // is breathing, and this line asks nothing of her; permission framing
    // ("No need to tap", "You can just rest"), which names the buttons that
    // were removed and hands her back the decision the owner took away; or a
    // nudge out of the rest ("Almost time", "Nearly there"). It states what
    // happens next and stops.
    restAutoStart: "The next set starts on its own.",
    // DEAD (COPY-WRITER 2026-09-12, owner decision: the rest screen shows no
    // buttons). This was the outlined "I'm ready" that ended the rest early.
    // Its one and only callsite is the rest phase (player-phases.tsx
    // RestPhase, `player-end-rest`); no test and no other screen reads it,
    // so it is dead copy the moment the ui-engineer drops that button.
    // `player.skipBlock` above is NOT dead: the same rest screen stops
    // rendering it, but the block intro and the work phase still do.
    // Do not revive this label anywhere: ending the rest early is still
    // allowed by the machine, but it is no longer something the screen asks
    // her to decide, and a button that says she is ready would put the
    // decision back on the calmest screen in the app.
    restDone: "I'm ready",
    // COPY-WRITER (2026-09-08, owner decision): the recorded voice counts
    // down the last five seconds of every timed hold and every rest. Five
    // is the warning: "Five seconds" says a count is coming, the way a
    // coach says it before counting a hold out. Four to one are the bare
    // number words. Each string is also the key of its own audio file, so
    // no digits, no punctuation, no dashes, each under three words; the
    // table is COUNTDOWN_WORDS above `strings`. Never "Five seconds left"
    // ("left" turns a count into a clock), never "Go" at the end: the
    // function has no zero, and the screen moves on by itself.
    countdown: (seconds: 1 | 2 | 3 | 4 | 5): string => COUNTDOWN_WORDS[seconds],
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
    // COPY-WRITER (2026-09-09, owner device pass: "I have to manually click
    // a lot of stuff to get the application going"): the block intro now
    // starts the work by itself, and this is the line that says so, sitting
    // under `blockPlan`. It is a hand-off, not a clock. "Starts on its own"
    // names the app taking the tap off her hands; the seconds are only how
    // long she has to get into position, never a deadline she is being held
    // to. Never "left" or "remaining" ("left" turns a count into a clock,
    // the same reason `countdown` refuses it), never "Get ready", never
    // "Hurry", never any imperative at all: this line asks her to do
    // nothing, which is the whole point of it. Numerals, not number words:
    // the value changes every second and belongs with the player's other
    // counted captions (setCounter, blockCounter, the rest numeral).
    // Singular guarded, because the count reaches 1. `begin` above stays
    // exactly as it is: that button starts the work sooner, and "Begin" is
    // still the honest name for the tap. If this line ever acquires urgency,
    // a target, or anything about her body, it has become the thing it was
    // written against.
    autoStart: (seconds: number) =>
      `Starts on its own in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`,
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
      // COPY-WRITER (2026-09-09, owner device pass): the side switch hands
      // off the same way, under `switchBody`. Deliberately the same words as
      // `player.autoStart` and deliberately its own key: two screens, two
      // slots, free to diverge later, and one shared key would couple the
      // intro's pacing to the switch's. Side neutral like the line above it
      // (it never names which side is next, so it stays true whichever side
      // led) and equally free of pressure: she is settling into position for
      // the second side, not racing a timer. Same rules as autoStart. Never
      // "left", never an imperative, numerals only, singular guarded.
      // `startRight` below keeps its label: that button starts the second
      // side sooner, and a countdown beside it makes it no less honest.
      autoStart: (seconds: number) =>
        `Starts on its own in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`,
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
    // DEAD (COPY-WRITER 2026-09-12, owner decision: the skip confirmation
    // screen is deleted, rejected twice). All four keys below are dead copy
    // the moment the ui-engineer removes that phase. Replaced by the
    // two-tap control above: `skipBlockArmed` carries the warning,
    // `skipped` / `skippedLast` carry the confirmation. Kept, not deleted,
    // until player-phases.tsx and session-player-screen.test.tsx stop
    // reading the key shape.
    //
    // The old body's reassurance ("it won't set you back") is NOT moved
    // anywhere. It is still true of progression (ADR-0012 §1: skip is
    // progression-neutral) but it is no longer true without qualification:
    // a skipped block is not training for the day streak (ADR-0018), so a
    // session she skips end to end does not count as a training day. A
    // one-line reassurance cannot hold both facts, and the screen that had
    // room for the distinction is the screen being deleted. The honest
    // close still says what is kept, after the fact and without a claim:
    // finish.endedEarly.note, "Everything you completed is saved. It
    // counts." Do not revive any of these four strings as a caption, a
    // subtitle under the armed button, or a first-skip one-time note.
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
    // COPY-WRITER (2026-09-08, owner live-device feedback: "why should
    // they do that, they don't trust you"). The old prompt asked without
    // saying what the note was for. Now it says: her own record, kept for
    // her to read back (Settings > Your notes). The app never reads it
    // for anything, so nothing more is promised. Optional stays implied
    // by `skip` below; the prompt itself stays one line.
    notePrompt: "Note what happened, for your own record.",
    // COPY-WRITER (2026-09-08): same fact, two words shorter. "Never sent"
    // is complete on its own; "anywhere" added nothing. Also read alone
    // at the foot of Settings > Your notes.
    notePrivacy: "Stays on your phone. Never sent.",
    // COPY-WRITER (2026-09-08, owner live-device feedback): "See what to
    // do" oversold the tap, and the "See ..." pair with it went. Both
    // primaries are now the plainest honest name for what the tap does:
    // keep whatever she wrote and move on. `continue` goes to the preview
    // ("Your session is ready"); `continueNoSession` goes to the
    // no-session screen, where "Continue" promises nothing. Two keys are
    // kept so the paths may still diverge. Never "Start": nothing starts
    // here. Never "Save note": the field may be empty, and the tap still
    // moves on.
    continue: "Continue",
    continueNoSession: "Continue",
    // COPY-WRITER (2026-09-08): shorter. Skips the note only; the quiet
    // button goes to the same place as the primary and nothing is
    // declined. The label names the note, so it never reads as turning
    // down today's session. If the quiet button ever declines the
    // session instead, this label is wrong and must change.
    skip: "Skip note",
  },
  preview: {
    // COPY-WRITER (2026-09-09, preview rebuild; mockup preview-b, owner
    // approved: "too busy, less inspiring — make it exciting, easier,
    // empowering"). The screen is now one headline, one paragraph, and
    // the plan. Three labelled sections are gone: `eyebrow`, `factsTitle`
    // and `planTitle` below are dead, and so are the facts lines the
    // bordered tile carried on separate rows.
    //
    // `title` is the whole top of the screen: two lines built on the one
    // thing she just chose, her minutes. First line is the fact, second
    // line is hers, and the screen colours the second in the accent.
    // "All yours" is the coach's own phrase from fither-voice ("Short and
    // steady today. Ten minutes, all yours."), not a new slogan coined
    // here. Minutes in words, sentence-cased, because this is spoken
    // scale, not a readout: "Ten minutes." reads as a fact she owns,
    // "10 minutes" as a status. The pair replaces "Your session is
    // ready", which described the app's state rather than her day.
    //
    // Second line is invariant across 10, 20 and 30 on purpose: ten
    // minutes is complete (domain rule), so a shorter session may never
    // earn a smaller second line, and a longer one may never earn a
    // prouder one. It still returns from this function so the two halves
    // live in one key and can never drift apart on screen.
    //
    // What the second line must never become: a slogan (no tagline
    // variants, no "Own it", no exclamation), a promise about her body,
    // or a command. It is a statement about the time, and nothing else.
    // If it ever tells her to do something, it has become the thing it
    // was written against.
    title: (minutes: SessionMinutes) => ({
      first: `${capitalised(numberWord(minutes))} minutes.`,
      second: "All yours.",
    }),
    changeAnswers: "Change today's answers",
    start: "Start session",
    // DEAD (2026-09-09, preview rebuild): the caption above the old
    // headline. The rebuilt screen opens on `title`; nothing labels it.
    eyebrow: "Made for today",
    // DEAD (2026-09-09, preview rebuild): replaced by `title`. Kept until
    // the rebuilt screen and its test stop reading it.
    headline: "Your session is ready",
    // DEAD (2026-09-09): unused before the rebuild, and the minutes now
    // live in `title`, the count in `facts.opening`.
    summary: (minutes: SessionMinutes, movements: number) =>
      `${minutes} minutes · ${movements} ${movements === 1 ? "block" : "blocks"}`,
    // DEAD (2026-09-09): the old fallback fit line, unused since the
    // facts list landed.
    defaultFit: "Built around your time and current level.",
    // DEAD (2026-09-09, preview rebuild): the plan is the only list left
    // on the screen, so it needs no caption to name it.
    planTitle: "Today's plan",
    // DEAD (2026-09-09): the pre-facts adaptation lines. Nothing has
    // rendered them since `facts` landed (2026-09-07); kept only because
    // docs/copy/draft-strings.md §0 still cites the key shape.
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
    // COPY-WRITER (2026-09-09, preview rebuild; mockup preview-b): the
    // same engine facts, no longer rows in a bordered tile. They are now
    // ONE PARAGRAPH of soft body text under `title`, run together with a
    // single space, in the display order set out below (which keeps
    // sessionFacts' own order, with the two rules that follow it). Every
    // line is still a fact the engine actually reports; the UI maps, it
    // never re-derives, and this block stays the only source of the words.
    //
    // Written to be read aloud as continuous prose, so every line is now
    // exactly one sentence ending in a full stop. Two lines changed for
    // that reason (`staleFocus`, `taste` — see below); the rest already
    // read as prose and are untouched.
    //
    // ORDER AND STOP (the paragraph's shape, so it never becomes the wall
    // of text the owner rejected):
    //   1. `opening` always comes first, and always renders.
    //   2. Then at most TWO of the middle sentences, in this order of
    //      keeping: lowEnergy, softLanding, quiet, staleFocus, taste.
    //      Anything past the second is dropped, not squeezed in. The
    //      order is what she most needs to hear first: her own answer
    //      about energy, then why today is lighter, then the room.
    //   3. The equipment sentence (floorOnly / withChair) always closes,
    //      as it does in the approved mockup. It is the settling note,
    //      and it is the one sentence that may be absent instead: when
    //      the library has not loaded, no claim about the room is made
    //      and the paragraph simply ends earlier.
    // Four sentences is the ceiling. That is two to four lines in the
    // mockup's column, and it is where I would stop: a fifth sentence
    // pushes the plan below the fold and turns the reassurance back into
    // a list she has to read.
    //
    // Plainest case, nothing adapted at all:
    //   "Four movements. Just you and the floor."
    // Heavy case, areas plus low energy plus an eased pattern:
    //   "Four movements, around your elbows, knees and core. Two sets
    //    instead of three, for low energy. Lighter on push, since last
    //    time was hard. Just you and the floor."
    //
    // The old per-line notes still hold and are kept below.
    //
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
    // No dashes; each line was under 50 characters at any input.
    // COPY-WRITER (2026-09-09): that 50-character rule was the tile's
    // row width and no longer binds. The paragraph's budget is the
    // four-sentence ceiling above; the longest single sentence is now
    // `taste` at 57 characters with the longest library name.
    // DEAD (2026-09-09, preview rebuild): the list has no caption now.
    // The paragraph explains itself in her own words.
    factsTitle: "Why it fits",
    facts: {
      // COPY-WRITER (2026-09-09, preview rebuild): the paragraph's first
      // sentence, and the owner-approved words from the mockup: "Four
      // movements, around your elbows, knees and core." It replaces BOTH
      // `minutes` (the headline says the minutes now, so repeating them
      // here would be a duplicate) and `avoid` (whose clause is folded in
      // with a comma, exactly as the mockup reads).
      //
      // Count in words, singular guarded, sentence-cased: it opens the
      // paragraph and matches the headline's spoken register. With no
      // areas the sentence is the count alone, "Four movements." — a
      // complete sentence, never a stub waiting for a clause.
      //
      // "around your knees" over the old "Nothing that loads your knees":
      // in a paragraph the old line read as a warning, and it named the
      // area as something to be protected FROM the session. The areas are
      // what the session respects, never a weakness, never an injury,
      // never a problem area. Never "despite", never "even with", never
      // any word that makes her list a cost. `areas` arrives lower case
      // from the caller, as it always has; four or more collapse to
      // "your shoulders, wrists and two more" (see areaPhrase above), so
      // the sentence stays one breath long whatever she picked.
      opening: (movements: number, areas: string[]) => {
        const count = `${capitalised(numberWord(movements))} ${
          movements === 1 ? "movement" : "movements"
        }`;
        return areas.length === 0
          ? `${count}.`
          : `${count}, around your ${areaPhrase(areas)}.`;
      },
      // DEAD (2026-09-09, preview rebuild): minutes moved to `title`, the
      // count and the areas moved into `opening`.
      minutes: (minutes: number, blocks: number) =>
        `${minutes} minutes, ${blocks} ${blocks === 1 ? "movement" : "movements"}.`,
      // DEAD (2026-09-09, preview rebuild): folded into `opening` as
      // "around your knees", the mockup's approved wording.
      avoid: (areas: string) => `Nothing that loads your ${areas}.`,
      lowEnergy: "Two sets instead of three, for low energy.",
      quiet: "Every movement stays quiet.",
      floorOnly: "Just you and the floor.",
      withChair: "You, the floor and a chair.",
      softLanding: (pattern: string) => `Lighter on ${pattern}, since last time was hard.`,
      // COPY-WRITER (2026-09-09, preview rebuild): one sentence, was two.
      // "It's been a few sessions." was a tile row; read inside a
      // paragraph its "It's" reaches for whatever sentence sits before it.
      // Same two facts, joined by the comma that always meant "because":
      // the pattern is back, and how long it has been. Still counted in
      // her sessions, never in days away (rule 3: absence is never named).
      staleFocus: (pattern: string) => `${capitalised(pattern)} is back today, after a few sessions.`,
      // COPY-WRITER (2026-09-09, preview rebuild): one sentence, was two.
      // "One set, optional." is a column entry, not prose. The colon does
      // the same work in running text and keeps both facts: it is a first
      // look (as in adaptations.tasteBlock), it is one set, and it is
      // hers to decline. "Optional" stays in the sentence, never in a
      // footnote: the paragraph must never imply she owes the last set.
      taste: (movement: string) => `Ends with a first look at ${movement}: one optional set.`,
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
    // scheduler must rebuild it after any session is saved. `count` is
    // distinct DAYS trained, as in `week`, and the line says "days" so
    // two sessions on one day never read as two. It only fires on an
    // untrained day, which is why "today would make it" holds. Conditional
    // "would", as in streak.notification.nextDay: today is an invitation,
    // never a due date. `met` never says "enough" or "done for the week":
    // a further day counts just as much, and the line says so.
    weekly: {
      onTrack: (count: number, target: number) =>
        count === 0
          ? `Today would be your first of ${target} days this week.`
          : `${count} of ${target} days this week. Today would make it ${count + 1}.`,
      noTarget: "Ten minutes today, if today fits.",
      met: "Your week's target is met. Another day counts just as much.",
    },
  },
  // COPY-WRITER (2026-09-08, owner decision): the voice is no longer
  // silently off. The app asks ONCE, on the way into her first session,
  // and never again; the once is enforced by the ask record, not by the
  // copy. Same four-key shape as notifications.rationale (headline, line,
  // allow, decline), and the screen renders these four strings and
  // nothing else. She is one tap from her first movement, so every word
  // here spends Gate 3.
  //   · headline: four words, a question, the shape of "Want a daily
  //     note?". "Cues" is the word settings.voice.body already owns;
  //     `line` defines it at once for someone who has not had a session.
  //   · line: two sentences. First, what the voice does, as two facts: the
  //     cue as a set starts, a countdown as a hold or rest ends (the last
  //     five seconds; the number waits for Settings). Second, the two
  //     facts about control: the phone's silent switch still mutes it,
  //     and it is hers to change in Settings. "Silent" is
  //     settings.voice.off's own word. Nothing about sending: the audio
  //     is bundled in the app and nothing leaves the phone, so there is
  //     no privacy line to write and no wording that implies one is
  //     needed. A quiet day does not mute the voice (place.note), and
  //     this line names only the phone's switch, so it cannot be read
  //     as saying otherwise.
  //   · allow: the filled button names the outcome, never "Yes".
  //     Imperative, like every primary button in the app.
  //   · decline: the plain state she is already in (settings.voice.off,
  //     "Silent"), with equal dignity. Not "No thanks" (nothing offered
  //     is being turned down), not "Not now" (no promise to ask again,
  //     because we don't).
  // No dashes; each sentence of `line` under 80 characters.
  voiceAsk: {
    headline: "Want the cues spoken?",
    line: "The cue as each set starts, a countdown as each hold and rest ends. Silent when your phone is on silent, and yours to change any time in Settings.",
    allow: "Speak the cues",
    decline: "Stay silent",
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
    first: {
      title: "Your starting point is set.",
      next: (skill: string, tiers: number) =>
        `${skill} is ${tiers === 1 ? "1 tier" : `${tiers} tiers`} ahead.`,
    },
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
      // COPY-WRITER (2026-09-08): new key. Left label of the receipt row
      // whose value is the session's points ("+35", in the accent). One
      // plain noun, same shape as the labels above it; the value carries
      // the number, so the label never repeats it. Not "Points earned":
      // the receipt states what happened, it never frames a reward, and
      // "earn" sits next to a forbidden phrase.
      pointsLabel: "Points",
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
    noChange: "Every session added to your training.",
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
    // already on screen, nothing extra. Asked once, on the way into her
    // first session (voiceAsk); this page holds the answer either way.
    // The body states two facts and stops: what it reads, and how
    // it sits with a quiet day. No voice name, no provider, no "coming
    // soon", nothing sold. The heading is one word because the body does
    // the explaining. The two rows name the plain state she gets —
    // "Spoken" / "Silent" — with equal dignity: off is not a loss, and
    // neither row mentions the other.
    //
    // COPY-WRITER (2026-09-07, wave 4, place preset): second sentence
    // replaced. It used to promise silence on any day she kept it quiet.
    // Quiet movements and the voice are now separate (place.note), so
    // that promise would be false: the voice plays on a quiet day too,
    // and headphones are how it stays hers alone. Nothing about the
    // place preset here; the voice is one setting whatever the place.
    //
    // COPY-WRITER (2026-09-08, owner decision): first sentence revised,
    // key unchanged. The voice now also counts down the last five seconds
    // of every timed hold and every rest (player.countdown), so the body
    // says so, in the owner's own words ("every hold and rest"). "during
    // your session" went: the sentence is on the Voice page, and nothing
    // else it could mean. Still two sentences; "quiet days included"
    // still covers the whole first one. The old "Off by default" line in
    // the 2026-09-04 note above is corrected in place, since it was no
    // longer true. Nothing about the silent switch here: voiceAsk says it
    // once, and this page is the setting, not the phone.
    voice: {
      title: "Voice",
      body: "Reads each movement's cue aloud and counts down the last five seconds of every hold and rest, quiet days included. With headphones, no one else hears it.",
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
  // COPY-WRITER (2026-09-07, wave 4; mockups settings-presets and
  // settings-place): the place preset. One row under Training, one page.
  // She picks Home or Hotel, and each place keeps its own equipment and
  // its own quiet default. The voice is one setting for both places; it
  // sits on this page only because `note` says how it relates to quiet.
  //   · row / title: the same three words, so the row is the page she
  //     lands on; they must never diverge. First person, as the mockups:
  //     it is her statement of fact, and "Where you train" would read as
  //     us asking a question the page does not ask.
  //   · lead: two facts. Switching is the whole mechanic, and the daily
  //     questions are untouched by it: a preset only sets what the quiet
  //     question starts from, the answer is still hers each day.
  //     "Each day's", not the draft's "Today's": a settings page is not
  //     tied to a day. prompt.quiet.presetLine keeps the same promise in
  //     the same words when the preset shows up in the prompt.
  //   · home / hotel: same words as share.context.home / hotel, separate
  //     keys on purpose (a share key on a settings page reads as a bug at
  //     review). `value` is the Settings row's right-hand value; it and
  //     the two options read from one constant so they cannot drift.
  //   · quietAsk / quietAlways: the quiet default's two states, equal
  //     dignity. "Ask me each day" is the plain state (the daily question
  //     asks, as it always has). "Always" sits beside the row label and
  //     reads "Quiet movements: Always". The value is never "Never": on
  //     Ask the question is still there, nothing is switched off.
  //   · sectionVoice / voiceRow: "Voice" is settings.voice.title, and the
  //     row's values are settings.voice.on / off ("Spoken" / "Silent"),
  //     never the mockup's "Off". The caption differs from the row so the
  //     page does not say "Voice" twice.
  //   · note: the one fact this page and the Voice page share. Quiet
  //     movements keep the room quiet; the voice is a separate choice,
  //     and headphones are how it stays hers alone on a quiet day.
  // No dashes; every line under 100 characters.
  place: {
    row: "Where I train",
    title: "Where I train",
    lead: "Switch when you travel. Each day's answers stay yours.",
    sectionPlace: "Place",
    home: PLACE_LABELS.home,
    hotel: PLACE_LABELS.hotel,
    sectionAtHome: "At home",
    sectionAtHotel: "At a hotel",
    equipmentRow: "Equipment",
    quietRow: "Quiet movements",
    quietAsk: "Ask me each day",
    quietAlways: "Always",
    sectionVoice: "Coaching audio",
    voiceRow: "Voice",
    note: "Quiet movements and the voice are separate. Headphones can carry the voice through a quiet session.",
    value: (place: "home" | "hotel"): string => PLACE_LABELS[place],
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
      from: (movement: string) => `From ${movement}`,
      // COPY-WRITER (2026-09-07): caption above the Progress tab's
      // next-skill tile (the movement she is climbing toward, with the
      // tile's own "N tiers ahead" line). Was reusing `title`, which
      // named the earned list, not the one ahead. Capability framing:
      // it is a skill she reaches, never a goal she is behind on.
      nextTitle: "Next skill",
      // COPY-WRITER (2026-09-12, owner): one line UNDER the named skill in
      // the Progress next-skill tile, shown until her first skill lands.
      // It says what the climb is made of, in the engine's real terms:
      // three clean sessions per tier (CLEAN_SESSIONS_TO_ADVANCE), clean
      // meaning she finished and did not answer "Hard today"
      // (player.feedback.options.hard). Scales honestly whether the skill
      // is one tier ahead or five: it prices ONE tier, she can do the
      // arithmetic.
      //
      // What it must never become: a description of the tile. The figure,
      // the eyebrow ("2 tiers ahead") and the skill's name are already on
      // screen, so never name the skill, never restate the distance,
      // never explain that skills "land here as you reach new tiers" —
      // that was the line the owner called slop, and it explained the
      // interface where a fact about her training belongs. Also never
      // promise a date or a number of weeks: advancement also waits on
      // ADR-0008's time floor, which this line deliberately does not
      // price. "takes" states what is needed, never "and then you're up".
      // No "in a row", no "keep it up": three sessions, stated plainly,
      // so there is nothing here she can be told she broke.
      empty: "Every tier takes three sessions that don't feel hard.",
      // COPY-WRITER (reviewed 2026-09-12): the name of a milestone when
      // the movement library is absent (a degraded build only). Says the
      // ladder and the rung in her own vocabulary ("Push", "Tier 4 of 6")
      // instead of a raw pattern id. Approved as written: it is a fact,
      // not an apology, and it must never become an error message.
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
