# FITHER — App Store listing (1.0)

Promoted from `docs/copy/draft-strings.md` §5 on 2026-09-05. Written to
`fither-voice`; every line below has passed the forbidden-word filter
(weight, calorie, burn, fat, slim, streak, chain, tone, sculpt, bikini,
guilt, "miss you", "no excuses", "just a quick", "mini") and the
ten-minutes-is-complete rule. Prices follow ADR-0014. The lifetime plan is
never advertised and does not appear here.

Each fenced block is paste-ready for App Store Connect. Character counts
were measured by hand on the exact block contents; re-check in the
Connect field before saving (Connect counts newlines).

Locale: English (U.K.) is the primary locale. English (U.S.) can reuse
every block unchanged except the keyword field (see the note there).

---

## 1. Name

Limit 30. Measured: **26**.

```
FITHER: Strength That Fits
```

Kept from the draft. It carries the brand tagline's first two words, the
brand name is searchable on its own, and nothing shorter said more.

## 2. Subtitle

Limit 30. Measured: **27**.

```
Home workouts, no equipment
```

No word repeats the name (Apple indexes both fields; a repeat is a wasted
character). "Home" and "workouts" are the two highest-value search terms
the name does not already cover.

## 3. Keyword field

Limit 100. Comma-separated, no spaces, no words repeated from name or
subtitle. Measured: **100**.

```
calisthenics,bodyweight,women,exercise,fitness,minutes,quiet,travel,core,pushup,busy,mum,daily,plank
```

Apple combines terms across name, subtitle and keywords automatically, so
"10 minute workout" and "home exercise" are covered without spending
characters on phrases.

For the English (U.S.) locale, swap `mum` for `mom` (same length; the
count stays 100). Everything else is identical.

## 4. Promotional text

Limit 170. Editable without a new review. Measured: **149**.

```
A workout that fits today: 10, 20 or 30 minutes, no equipment, adapted daily to your time, energy and surroundings. Works fully offline. 7 days free.
```

This is the one line that can change between releases without a review.
If the trial or the offline claim ever changes, change it here first.

## 5. Description

Limit 4,000. Measured: **1,058** characters of text, **1,072** including
the seven paragraph breaks. The first two lines carry the value; they are
all most people see before "more".

```
A workout that fits today. 10, 20 or 30 minutes, no equipment, adapted every day to the day you're actually having.

FITHER builds your strength session in four taps: how much time you have, how your energy is, whether you need to be quiet right now, and anything to work around. Then you move.

No equipment, no gym. Sessions use your body and the floor you're standing on — quiet enough for a sleeping child in the next room, small enough for a hotel room.

Real progression. Sixty expert-authored movements across five patterns, six levels each. You advance when you're ready, and training twice a week is enough to keep moving forward.

Ten minutes is a complete workout here. Not a shorter version of a longer one — a session built to fit its time exactly.

Everything runs on your phone, so it works in airplane mode, in a basement, anywhere. No account needed.

Progress is what your body can do: your first full push-up, your first full plank. We will never ask what you want to look like.

$59.99 a year or $12.99 a month after a 7-day free trial. Cancel anytime.
```

<!--
Pricing: USD reference prices per ADR-0014. Apple localises the price
tiers per storefront, but the description text is static per locale, so
when pasting into a non-US locale (en-GB shows GBP) substitute that
storefront's tier price for the same two products, yearly then monthly.
Never add the lifetime plan to this field.
-->

Changes from the draft, and why:

- Pricing line moved from GBP (ADR-0002) to USD per ADR-0014, annual
  first.
- "a busy fortnight never sets you back" removed. It names lost progress
  in negation, which rule 3 (no guilt, ever) bars; the claim that stays —
  "training twice a week is enough to keep moving forward" — is the same
  engine rule stated as capability.
- "your first sixty-second hold" replaced with "your first full plank".
  Skill names come from the movement library; Full Plank is a real
  milestone (core, tier 4) and a sixty-second hold is not one.
- "across five patterns" added to the movements line so the number is
  legible; "on your device" became "on your phone", which is how she
  would say it.
- "No account needed." added. It is true (ADR-0011: guest is first-class)
  and it is a value claim a busy reader acts on.

## 6. What's New (1.0)

Limit 4,000. Measured: **241** including three line breaks.

```
First release.
10, 20 or 30 minute strength sessions, no equipment, built from four quick questions each day.
Sixty movements, five patterns, six levels each — you advance as you get stronger.
Works fully offline, with or without an account.
```

## 7. Screenshot overlays

Five screenshots. The first two must carry the message with no context;
the 10-minute preview gets the same visual dignity as a 30-minute one.
Carried forward from the draft unchanged; every line passed the voice
rules on re-read.

| # | Screen shown | Overlay text | Characters |
|---|---|---|---|
| 1 | Hero / brand mark | `Strength that fits your life.` | 29 |
| 2 | Session preview (10 min, full dignity) | `10, 20 or 30 minutes. Your call, every day.` | 43 |
| 3 | Daily prompt | `Four taps. Then you move.` | 25 |
| 4 | Session player, quiet adaptation line visible | `Quiet enough for nap time.` | 26 |
| 5 | Skill unlock (sage + gold) | `Your first full push-up. It counts.` | 35 |

Overlay 4 depends on the engine's quiet-mode adaptation line being
visible in the frame; the overlay must not repeat it word for word.

## 8. App Review notes

The "Notes" field under App Review Information. Plain facts. Measured:
**145 words**.

```
FITHER is an equipment-free strength training app. Everything runs on the device: session generation, progress, points and entitlements. It works fully offline, including airplane mode.

No account is required. On first launch, "Continue without an account" sits beside Sign in with Apple as an equal option, and every feature works identically either way. Sign in with Apple requests no name or email.

There is one subscription, offered yearly or monthly, each with a 7-day introductory free trial through the App Store. The first session is never paywalled. After the first completed session, new sessions require the trial or an active subscription. The paywall shows price, renewal terms, Terms of Use, Privacy Policy and Restore purchase.

Sign out and "Erase everything on this phone" are under Settings > Account.

Notifications are optional. The app asks once, after the first completed session; Settings can turn them off.
```

## 9. Privacy nutrition summary

Not for pasting. A working sheet for the App Privacy questionnaire in App
Store Connect. Answers are per build: declare each row only in the first
build that actually ships that SDK with its key set. Facts from
`docs/posthog-setup.md`, ADR-0011, ADR-0014 and `docs/feature-set.md`.

| Apple data type | Category | Collected via | Linked to identity | Used for tracking | Purpose | Notes |
|---|---|---|---|---|---|---|
| Product Interaction | Usage Data | PostHog | No | No | Analytics | Ten events only: `deep_link_open` (path), `first_use_entry`, `onboarding_complete` (equipment), `session_preview` (minutes, blocks), `workout_start` (minutes), `workout_complete` (minutes, close, first, streak), `paywall_view` (surface), `scenario_entry` (allowlisted scenario id), `experiment_exposure` (experiment, variant), `trial_start` (plan). No screen views, lifecycle, device model or locale. Autocapture, session replay, surveys and GeoIP are off. Events queue offline. Ships only when `EXPO_PUBLIC_POSTHOG_KEY` is set in the production build. |
| Device ID | Identifiers | PostHog | No | No | Analytics | PostHog's anonymous distinct id. `identify()` is never called; the id is reset on sign-out. |
| Crash Data | Diagnostics | Sentry | No | No | App Functionality | Sentry is still Planned (feature-set). Add this row in the build that wires it, after the deliberate test crash on the launch checklist. |
| Purchase History | Purchases | RevenueCat / App Store | No | No | App Functionality | Entitlement `fither_pro`; products yearly, monthly, lifetime. RevenueCat holds an anonymous app user id with the receipt. Confirm the row against RevenueCat's current App Privacy guidance before submitting; it may also ask for a User ID row under Identifiers, anonymous and not linked. |

Not collected, and worth being able to say so if asked: name, email
(Sign in with Apple is requested with no scopes; only an opaque user id
is kept, to notice a revoked credential), health and fitness data,
location, contacts, photos, browsing or search history, financial
information, any body metric. Training history, points, skills, care
notes and settings live on the phone only, and "Erase everything on this
phone" removes them; there is no copy anywhere else.

One judgement for the owner: `workout_start` / `workout_complete` carry a
session length (10/20/30). It is declared here as Product Interaction, as
`docs/posthog-setup.md` decided. If Apple's reviewer reads a session
length as "Fitness" data, the honest answer is the same row moved to
Health & Fitness with identical not-linked / not-tracking answers.

"Used for tracking" is No on every row: nothing is shared with a data
broker or joined with third-party data, and the app never shows the App
Tracking Transparency prompt.
