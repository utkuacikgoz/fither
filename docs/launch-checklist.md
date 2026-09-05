# Launch checklist

Between "development complete" and "live on the store" is where most apps
die. Work this list top to bottom before submitting; nothing here is
optional. FITHER is iOS-first, so this is written for the App Store — the
Play Store addendum at the bottom applies if/when Android ships.

## Foundations (weeks before, not days)

- [ ] **Apple Developer Program enrolled well ahead** — enrollment can
  take days and nothing ships without it.
- [ ] **Launch KPIs written down before launch day**, so success is
  measurable, not vibes: downloads, trial starts, trial→paid conversion,
  D1/D7 retention, crash-free session rate. Targets on paper.
- [ ] **v1.0 scope frozen.** Cut anything not essential to the core loop;
  the TestFlight beta exists to find launch-blockers, and issues found
  there cost an update to 20 friendly users — after launch they cost
  one-star reviews in the exact window rankings are decided.
- [ ] **Landing page + email capture live**, linked from the TikTok
  channel's bio from week one. The channel builds the audience; the
  waitlist turns it into day-one downloads, and day-one clustering is
  what early store ranking reacts to. (Waitlist mails go through Resend.)

## Pre-launch technical essentials

- [ ] **Every merged SHA has remote evidence.** After pushing `main`, wait for
  GitHub CI to finish and record the successful run for that exact commit. If
  an Expo/EAS build was triggered or is required by the step, verify that build
  separately and retain its build URL. Local tests, a green prior commit, or an
  unverifiable account-gated build do not count. Stop the next implementation
  step while a required check is pending or red.
- [ ] **EAS build visibility is available to the release operator.** Authenticate
  the release machine with `eas login` or a least-privilege `EXPO_TOKEN`, then
  confirm `eas build:list` can read this project. This is currently blocked on
  owner-provided Expo access; GitHub CI visibility alone cannot diagnose an EAS
  build failure.
- [x] **Build variants are source-controlled.** Simulator development,
  registered-device development, internal preview, and production store builds
  use isolated EAS environments; production build numbers auto-increment.
  Account linking, signing, and the first signed build remain below.
- [ ] **Test beyond your own device.** The simulator and your phone are not
  a test matrix. Cover at minimum: an older small iPhone (SE-class), a
  current base model, a Pro Max, and the oldest iOS version you support
  (set the floor deliberately, then test ON it). Borrow devices or use a
  device cloud. Watch specifically for: session player timing drift when
  backgrounded, audio behaviour with silent switch on, and low-power mode.
- [ ] **Size and startup.** Keep the initial download lean — audio and
  animation assets are the risk; ship the smallest viable set and
  lazy-load the rest. Cold start to usable in under 3 seconds on the
  OLDEST supported device, or users leave before the first session.
  Test on cellular, not just WiFi — and in airplane mode, which for this
  product is a hard rule, not an edge case.
- [ ] **Crash reporting live BEFORE TestFlight.** You want to know about
  errors before users tell you — or worse, before they silently never
  come back. Error monitoring wired, symbolication (source maps/dSYMs)
  verified with a deliberate test crash, alerts reaching your phone.
- [ ] **Analytics live and clean.** The four events (ADR-0015) are
  built and tested; the owner creates the PostHog project and sets the
  key (docs/posthog-setup.md), then verifies one real session arrives.
  App Privacy: Product Interaction + anonymous Device ID, not linked,
  not used for tracking.
- [ ] **Ops accounts done**: transactional email provider with your own
  sending domain (SPF/DKIM verified — receipts and trial-ending mails
  that land in spam are support tickets), feedback board created and
  linked from the app's settings screen.

## Store listing (ASO)

- [ ] **Name (30 chars)** carries the primary keyword naturally.
  **Subtitle (30 chars)** is the one-line pitch — it shows in search, make
  it earn its place. **Keyword field (100 chars)**: no wasted commas, no
  words already in the name/subtitle.
- [ ] **Icon** distinctive and legible at small sizes — it is the first
  impression and the tap target in search results.
- [ ] **Screenshots tell the story, not the screens.** First two carry the
  message on their text overlays alone (10 minutes, no equipment, adapts
  daily); most viewers never swipe. All copy through the copy-writer and
  the fither-voice filter — the forbidden list applies to the listing.
- [ ] **Preview video** if feasible — the core experience in seconds;
  the TikTok content pipeline should make this nearly free.
- [ ] **Category** chosen deliberately (Health & Fitness), because it
  determines who discovers the app. Age rating and storefront
  availability set correctly.
- [ ] **Accessibility basics**: Dynamic Type doesn't break layouts,
  contrast is readable, session player usable with VoiceOver, captions
  or text equivalents for anything audio-only. This audience trains in
  suboptimal conditions by definition.

## Legal and compliance

- [ ] **Privacy policy hosted at a stable URL** on your own domain. States
  plainly what is collected, why, and how to get it deleted. The App
  Privacy "nutrition labels" in App Store Connect must match what the
  analytics and monitoring SDKs actually collect — mismatches get apps
  rejected or pulled.
- [ ] **Permissions minimal and explained.** Notifications is likely the
  only prompt — ask in context (after the first completed session, when
  the value is obvious), never at first open. Every permission string
  says why, in the product voice.
- [x] **Account/data deletion** path exists if any account exists at all —
  Apple requires in-app deletion. Built: Settings → Account → "Erase
  everything on this phone" signs out at the provider and wipes every
  local store; there is no server copy to delete. No confirmation email
  is needed while nothing is stored off the phone.

## Launch strategy

- [ ] **v1.0 is stable, not complete.** Core loop flawless beats feature
  count. Anything wobbly is cut, not shipped — features can arrive in
  updates; first impressions cannot.
- [ ] **Soft launch first.** Release to a small set of English-speaking
  storefronts (e.g. NZ/IE/CA) before the main market, and use phased
  release when going wide. Watch crashes, feedback and conversion for a
  week before opening up.
- [ ] **Submit for review 1–2 weeks before the target date.** Apple
  reviews take a day to a few days and rejections happen; the buffer is
  the cheapest way to protect the launch date. Review Apple's guidelines
  first (health claims, subscriptions, privacy) rather than discovering
  them via rejection.
- [ ] **Review response plan.** Reply to store reviews within 24 hours,
  in the product voice — professional, specific, never defensive.
  Templates prepared by the copy-writer before launch. Fix what reviews
  report and say so in update notes.
- [ ] **Launch day is an active shift, not a finish line.** Confirm the
  listing is live and correct, email the waitlist, post on the channel,
  then spend the day watching crashes, reviews and the funnel, ready to
  hotfix. Support inbox and feedback board answered same-day.

## Post-launch monitoring

- [ ] **Days 1–7 are the algorithm's first impression.** Watch crash rate,
  hang rate, and day-1/day-7 retention daily. Store ranking reacts to
  these immediately; a bad first week compounds.
- [ ] **Rating prompt at the right moment.** Ask after experienced value —
  a completed session or a skill unlock — never at first open and never
  interrupting a session. Use the system prompt (it rate-limits itself).
  Per the domain rules, the ask is an invitation, no guilt framing.
- [ ] **First update within 2–3 weeks**, planned before launch. Bug fixes,
  small improvements, and update notes that acknowledge user feedback —
  it signals to users and the store that the app is alive.
- [ ] **Funnel analysis in week one**: where do new users drop between
  install → onboarding → first session → second session → trial → paid?
  Fix the biggest leak before adding anything new.
- [ ] **Iterate ASO with real data**: test screenshots, keywords and
  description against actual conversion once the store shows numbers.
- [ ] **Feedback board triage** is a weekly habit, and TestFlight/launch
  feedback gets an answer, even a short one. A steady cadence of small
  fixes in month one compounds into rankings and retention; one big
  update later doesn't.

## Play Store addendum (only when Android ships)

The same structure applies, plus:

- Test on at least 10 devices across price points, screen sizes and
  Android 9–15 — Samsung, Xiaomi, OnePlus at minimum, including low-RAM
  devices; they are still common.
- Data-sensitive markets care about size and bandwidth: initial download
  under 50MB, assets optimized, tested on 3G-class networks.
- Play listing: 30-char title, 80-char short description that must sell in
  search results; Play's Data safety form replaces Apple's labels.
- Google's algorithm weighs ANR (Application Not Responding) rates
  alongside crashes — monitor both obsessively in week one.
- Soft launch by country/region first; monitor before going global.
