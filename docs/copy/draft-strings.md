> STATUS (2026-09-01): the app-facing sections (onboarding, resume,
> paywall incl. expired variants, notifications, adaptation lines) are
> WIRED into app/src/copy/strings.ts — that file is now the source of
> truth for them; edit there, not here. The store-facing sections
> (App Store listing, review responses) remain staged here until
> docs/store/ opens in Phase 4.

# FITHER — draft strings for wiring

Drafted by copy-writer, 2026-08-31. Written to fither-voice; every string
below has passed the forbidden-word filter. Key paths follow the naming
style of `app/src/copy/strings.ts` (nested camelCase, arrow functions for
parameterised strings). The ui-engineer wires these; renaming a key is a
code change that goes back through them.

Store-facing material (sections 5–6) belongs in `docs/store/` when that
phase opens — included here so the whole surface is reviewed as one voice.

---

## 0. Replacements for existing keys — `preview.adaptations`

These replace the current values in `app/src/copy/strings.ts` (same keys,
same signatures). Rendered verbatim on the session preview, so each line
must read like the coach explaining today in one breath.

| Key path | Current | Proposed replacement |
|---|---|---|
| `preview.adaptations.soreness` | `(areas) => \`Works around ${areas}.\`` | `(areas) => \`Works around your ${areas} today.\`` |
| `preview.adaptations.quiet` | `"Every movement stays quiet."` | `"Quiet mode: nothing here makes a sound."` |
| `preview.adaptations.lowEnergy` | `"Less volume. Same level."` | `"Low energy: same movements, lighter volume."` |
| `preview.adaptations.softLanding` | `"A little less volume where you need it."` | `"Slightly lighter where last session was hard."` |
| `preview.adaptations.staleFocus` | `"Brings a movement pattern back into focus."` | `"One movement pattern rotates back in today."` |
| `preview.adaptations.tasteBlock` | `"Ends with one optional look at what comes next."` | `"Ends with a first look at your next level. Optional."` |

Rationale: the domain file's own examples use the "Cause: effect" shape
("Low energy: same movements, lighter volume") — these match it, and each
reads aloud in under three seconds.

---

## 1. Onboarding — `onboarding.*`

Three screens plus a handoff line, then straight into the existing daily
prompt. One decision per screen, auto-advance on tap, no Next buttons
(ADR-0006). Gate 3 budget: roughly 12–15 seconds of onboarding before the
daily prompt's own 10–15 seconds.

### Screen 1 — Welcome

| Key | String |
|---|---|
| `onboarding.welcome.headline` | `Strength that fits your life.` |
| `onboarding.welcome.body` | `10, 20 or 30 minutes. No equipment. Built for the day you're actually having.` |
| `onboarding.welcome.cta` | `Begin` |

> **Gate 3 note:** ~4 seconds, one tap. The only screen that earns its
> place without collecting an answer — a first-open needs one line of
> orientation or the questions that follow feel arbitrary. Nothing else
> may join it. No account, no name, no goals screen.

### Screen 2 — Equipment on hand

| Key | String |
|---|---|
| `onboarding.equipment.question` | `What's within reach?` |
| `onboarding.equipment.options.floorOnly` | `Just me and the floor` |
| `onboarding.equipment.options.chair` | `A sturdy chair too` |

> **Gate 3 note:** ~3 seconds, one tap. The engine must know before the
> first session whether chair-supported tiers are available — guessing
> wrong means prescribing a movement she can't set up for on day one.
> Two options only; the app never needs more.

### Screen 3 — Anything to always avoid

| Key | String |
|---|---|
| `onboarding.avoid.question` | `Anything we should always work around?` |
| `onboarding.avoid.nothing` | `Nothing` |
| `onboarding.avoid.confirm` | `Noted. Every session will work around it.` |

Body-area options reuse `prompt.soreness.areas` — same labels, same
order, so the daily prompt feels familiar on day two.

> **Gate 3 note:** ~3 seconds on the default path ("Nothing" is the
> single pre-focused tap). This is the safety question: a persistent
> injury must be known before the first movement, not discovered after
> it. Distinct from the daily soreness question, which is transient.

### Handoff into the first workout

Not a separate screen — an eyebrow and one line atop the first daily
prompt question. A standalone interstitial would spend ~5 seconds to
convey no information.

| Key | String |
|---|---|
| `onboarding.handoff.eyebrow` | `Last step` |
| `onboarding.handoff.line` | `Now, today. Four taps and you're moving.` |

> **Gate 3 note:** zero taps, zero screens. Sets the expectation that the
> end of questions is seconds away, which is what keeps her tapping.

---

## 2. Resume prompt — `resume.*`

Shown when the app opens with a session interrupted mid-workout. What
she did is already banked, and both buttons say so — neither path reads
as the wrong choice.

| Key | String |
|---|---|
| `resume.headline` | `You're mid-session` |
| `resume.line` | `Everything you've done is saved. Carry on, or call it complete here.` |
| `resume.continueLabel` | `Keep going` |
| `resume.finishLabel` | `Finish here` |

Note for ui-engineer: the discard path is labelled "Finish here", not
"Discard" — the completed blocks count toward points and history either
way. If the underlying behaviour actually throws her work away, that's a
product conflict to raise before wiring, not a label to soften.

---

## 3. Paywall — `paywall.*`

Reads like an honest letter (design-system). Annual led (ADR-0002). No
countdowns, no strikethroughs, no scarcity. The `£3.33 a month` line is
plain arithmetic on the real price, not a discount theatric.

| Key | String |
|---|---|
| `paywall.headline` | `The honest version` |
| `paywall.letter` | `FITHER is one subscription and it covers everything: every session, every length, adapted daily to your time, energy and surroundings. It works offline — on a plane, in a quiet house at 6am. No ads, nothing sold separately.` |
| `paywall.trialLine` | `The first 7 days are free. If it doesn't fit your life, cancel in Settings before the week ends and pay nothing.` |
| `paywall.plans.annual.label` | `Yearly` |
| `paywall.plans.annual.price` | `£39.99/year` |
| `paywall.plans.annual.note` | `£3.33 a month, billed once a year` |
| `paywall.plans.monthly.label` | `Monthly` |
| `paywall.plans.monthly.price` | `£5.99/month` |
| `paywall.cta` | `Start my free week` |
| `paywall.afterTrialNote` | (fn) `(price: string) => \`7 days free, then ${price}. Cancel anytime.\`` |
| `paywall.restore` | `Restore purchase` |
| `paywall.restoreError` | `Couldn't restore your purchase. Try again in a minute.` |
| `paywall.legal.autoRenew` | `Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store settings.` |
| `paywall.legal.termsLabel` | `Terms of Use` |
| `paywall.legal.privacyLabel` | `Privacy Policy` |

Optional included-list (if the letter alone tests too sparse):

| Key | String |
|---|---|
| `paywall.included.0` | `Every session, adapted daily` |
| `paywall.included.1` | `10, 20 and 30 minutes — all of them` |
| `paywall.included.2` | `Works fully offline` |
| `paywall.included.3` | `Skill milestones as you get stronger` |
| `paywall.included.4` | `No ads, ever` |

Prices are GBP reference; other storefronts display Apple's localised
tier via RevenueCat, so wire `price` from the offering, with these as
the GBP fallback strings.

---

## 4. Notifications — `notifications.*`

Invitations, never nags. Nothing references yesterday, absence, or
anything undone. All lines work on a lock screen read at a glance.

### Pre-permission rationale (shown after the first completed session)

| Key | String |
|---|---|
| `notifications.rationale.line` | `One quiet note a day when your session is ready. That's all we'd ever send.` |
| `notifications.rationale.allow` | `Sounds good` |
| `notifications.rationale.decline` | `Not now` |

### Daily invitation pool (rotate; never more than one per day)

| Key | String |
|---|---|
| `notifications.daily.ready` | `Today's session is ready. Ten, twenty or thirty minutes — your call.` |
| `notifications.daily.quietTen` | `Ten quiet minutes, whenever you are.` |
| `notifications.daily.fitsToday` | `A workout that fits today. Ready when you are.` |
| `notifications.daily.yourMinutes` | `Somewhere in today there are ten minutes. They're yours.` |

---

## 5. App Store listing → `docs/store/listing.md` when that phase opens

### Name (30 char limit)

```
FITHER: Strength That Fits
```
26 characters.

### Subtitle (30 char limit)

```
Home workouts, no equipment
```
27 characters. No word repeats the name (Apple indexes both; repeats are
wasted characters).

### Keyword field (100 char limit, no spaces, no words already in name/subtitle)

```
calisthenics,bodyweight,women,exercise,fitness,minutes,quiet,travel,core,pushup,busy,mum,daily,plank
```
100 characters exactly. Apple combines terms automatically, so
"10 minute workout" is covered by name + subtitle + `minutes` without
spending characters on the phrase.

### Description (value in the first two lines — they're all most people see)

```
A workout that fits today. 10, 20 or 30 minutes, no equipment, adapted
every day to the day you're actually having.

FITHER builds your strength session in four taps: how much time you
have, how your energy is, whether you need to be quiet right now, and
anything to work around. Then you move.

No equipment, no gym. Sessions use your body and the floor you're
standing on — quiet enough for a sleeping child in the next room, small
enough for a hotel room.

Real progression. Sixty expert-authored movements, six levels per
pattern. You advance when you're ready, and training twice a week is
enough to keep moving forward — a busy fortnight never sets you back.

Ten minutes is a complete workout here. Not a shorter version of a
longer one — a session built to fit its time exactly.

Everything runs on your device, so it works in airplane mode, in a
basement, anywhere.

Progress is what your body can do: your first full push-up, your first
sixty-second hold. We will never ask what you want to look like.

£5.99/month or £39.99/year after a 7-day free trial. Cancel anytime.
```

### Screenshot overlays (first two must carry the message with no context)

| # | Screen shown | Overlay text |
|---|---|---|
| 1 | Hero / brand | `Strength that fits your life.` |
| 2 | Session preview (10 min, full dignity) | `10, 20 or 30 minutes. Your call, every day.` |
| 3 | Daily prompt | `Four taps. Then you move.` |
| 4 | Session player, quiet adaptation line visible | `Quiet enough for nap time.` |
| 5 | Skill unlock (sage + gold) | `Your first full push-up. It counts.` |

---

## 6. Store review responses → `docs/store/review-responses.md` when that phase opens

Reply within 24 hours. `[...]` are fill-ins; keep every reply specific to
the actual review — a template pasted verbatim reads as a template.

### 6.1 Bug report

```
Thank you for the clear report — you're right, [specific behaviour, e.g.
the timer pausing when a call comes in] shouldn't happen. A fix is in
[version, e.g. 1.2.1], due on the App Store around [date]. If it's still
wrong after updating, email [support address] and I'll look at your case
directly. — [name], FITHER
```

### 6.2 Feature request

```
Thanks for taking the time to suggest [feature]. [Honest status: "It's on
the list for a future release" / "We've decided against it because
[reason in one line]" / "It's being built now — look for it in
[version]".] Either way, it's genuinely useful to hear what would make
FITHER fit your day better. — [name], FITHER
```

### 6.3 One-star with a real complaint

```
You're right to be frustrated, and I'm sorry — [restate the actual
problem in their terms, e.g. "paying and then hitting a locked screen is
exactly what shouldn't happen"]. Here's what's changing: [concrete fix
and when]. If you email [support address] I'll make sure your account is
sorted personally. — [name], FITHER
```

Never argue, never explain why the reviewer is mistaken, never mention
other happy users.

### 6.4 Happy review

```
Thank you — this is exactly what FITHER is for. [One specific echo of
their situation, e.g. "Ten minutes while the house sleeps counts, and
you're proving it."] Glad it fits. — [name], FITHER
```

---

## Open flags (see session report)

- Store description differentiates by describing what FITHER measures,
  never by naming what it omits — the forbidden list bars the words even
  in negation. Commercial trade-off noted for the owner.
- `resume.finishLabel` assumes completed blocks are kept on discard;
  confirm with ui-engineer before wiring.
