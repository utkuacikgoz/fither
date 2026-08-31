---
name: fither-voice
description: >-
  FITHER voice and copy rules for every user-facing word: UI strings,
  onboarding, session coaching, notifications, paywall, App Store listing,
  share cards, and TikTok scripts. Read this before writing or editing ANY
  text a user might see or hear — even a button label or error message.
  Shared verbatim with the content repo; the same filter applies everywhere.
---

# FITHER voice

The voice is a calm, competent coach who respects your time. She tells you
what to do, tells you why in one line when it helps, and never manipulates.
This file is shared with the content repo — app copy and TikTok scripts
pass the identical filter.

## Who is speaking

A coach who assumes you are capable and busy. Not a cheerleader, not a
drill sergeant, not a girlboss meme account. She has seen you show up with
ten minutes and a sleeping toddler next door, and she thinks that counts.

## Rules

1. **Second person, present tense, short sentences.** "Lower slowly.
   Push through your palms." Instructional copy reads aloud well — much of
   it literally becomes voice audio.
2. **Capability language only.** Progress is what the body can do: "Your
   first full push-up." Never how the body looks or what it weighs.
3. **No guilt, ever.** Never reference absence, missed days, or lost
   progress. A returning user is greeted like she trained yesterday.
4. **No fitness jargon, no bro-speak.** No "crush it", "beast mode",
   "no excuses", "shredded". No unexplained acronyms (AMRAP, HIIT).
5. **Honest, specific claims.** "Ten minutes, no equipment, measurable
   strength" — never "transform your body in 30 days".
6. **Respect the clock.** Copy is as short as the sessions. If a sentence
   can go, it goes. Onboarding especially: every extra word delays the
   first movement (Gate 3 is open-to-moving in under 60 seconds).
7. **British-neutral English.** Plain international English; no
   region-locked slang.

## The forbidden list (from fither-domain, applied to words)

Never, in any surface, including notifications, store listing and scripts:

- weight, weigh-in, weight loss, fat, slim(ming), skinny
- calories, burn, earn your food, guilt-free
- streak, chain, don't break, "we miss you", "don't lose your progress"
- tone, sculpt, bikini body, problem areas, before/after framing
- shame-adjacent "motivation": no excuses, what's stopping you

## Surface notes

- **Notifications**: an invitation, never a nag. Good: "Ten quiet minutes
  available whenever you are." Bad: anything referencing yesterday.
- **Paywall**: state what's included and the price, plainly. No fake
  urgency, no countdown timers, no "only today".
- **Session player**: cue lines come from `cues` in `movements.json` and
  must work spoken aloud — read them out before committing.
- **Share cards**: name the skill ("First Full Push-Up"), nothing about
  the body.
- **Errors**: plain and actionable. "Couldn't restore your purchase.
  Try again in a minute." Never blame the user.

## Examples

| Situation | Not this | This |
|---|---|---|
| Unlock | "You crushed it! 🔥" | "That's your first full push-up. It counts." |
| Low energy day | "No excuses — push harder!" | "Short and steady today. Ten minutes, all yours." |
| Return after 2 weeks | "We missed you! Your streak reset." | "Ready when you are. Today: 10 minutes, push and core." |
| Paywall | "Unlock your dream body!" | "Every session, adapted daily. £X/month after your trial." |

Every string lives in `app/src/copy/strings.ts` — if you find user-facing
text hardcoded in a component, that placement is itself a bug to report.
