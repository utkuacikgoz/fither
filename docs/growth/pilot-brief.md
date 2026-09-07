# Friend pilot: three sessions this week, with a friend

Wave 6 (docs/implementation-checklist.md). A bounded test of one
sentence: **"Three sessions this week, with a friend. Each on your own
schedule."** Nothing is built for it beyond what waves 2 and 3 already
build. It runs on invitations and on each phone's own week view.

Owner runs it. Ten to twenty pairs. Two weeks. Then a decision about
whether shared state is worth an ADR.

## What is being tested

Whether a friend's invitation, with no shared state at all, coincides
with two people each reaching three trained days in the same Monday to
Sunday week. Not whether the invitation caused it; that cannot be
measured here and is not claimed (see "What cannot be measured").

## Preconditions

All of these must be `built` before the first invitation goes out:

- Wave 2: the receipt on the finish screen, the weekly intention (2, 3,
  none), the week view on Home, the weekly recap, share from receipts and
  recaps. The engine side already exists: `weekOf`, `trainedDay`,
  `weekParticipation`, `weeklyIntentionMet` in `packages/engine/src/week.ts`.
- Wave 3: share image with a chosen public context, the recipient web
  page, scenario identifiers, universal links where infrastructure exists.
- `friends_week` added to the `scenario_entry` allowlist in
  `app/src/analytics/events.ts` (ADR-0024 §3). That is a ui-engineer
  change; this brief only names the id.
- A TestFlight build carrying all of the above, and the recipient page
  reachable at the domain. Until the domain exists nothing here is `live`
  and the pilot does not start.

## The invitation

**Where it comes from.** The share action on a receipt or a weekly recap.
It is the same share sheet wave 3 builds, with one added option or one
added link (DECIDE below). The sender chooses it herself; the app never
sends anything on its own.

**What it carries.** A link whose path is the scenario id and nothing
else: `https://fither.app/s/friends_week`. No query string, no token, no
sender identifier, none of her inputs. Not her minutes, energy, quiet
answer, restrictions, tier, points, intention or week count. The path is
the only thing either side of the link ever records (`deep_link_open`
drops the query unread; web analytics take path and scenario only).

**What it says.** The share text is fixed. The sender can add her own
words in Messages; the app's part is:

> Three sessions this week, with a friend. Each on your own schedule.
> https://fither.app/s/friends_week

**What the sender sees after sending.** Nothing. iOS reports nothing
after the share sheet opens (`share_start` is the last event), and there
is no backend to tell her the friend opened it, installed, or trained.
The share sheet's source screen says so in one line, so she is not
waiting for a signal that will never come. Proposed string for wave 3
(strings.ts, ui-engineer wires it; not added by this brief):

> This link carries nothing about your sessions, and you won't see hers.

## Participant consent

Each person learns exactly one thing about the other: that a friend
invited her. Beyond that, nothing.

| | sender sees | recipient sees |
|---|---|---|
| The other's sessions, days, week count | no | no |
| The other's answers or restrictions | no | no |
| Whether the other opened, installed, trained | no | no |
| A feed, a chat, a leaderboard, a nudge | no | no |
| Who invited her | n/a | only what Messages already shows |

No shared state, no feed, no chat, no notifications about the other
person. No backend beyond what exists, which is none until ADR-0022
ships, and the pilot does not wait for it. The recipient page says this
plainly, so consent is informed before she taps anything:

> A friend sent you this. She won't see what you do here, and you won't
> see her sessions. Your week is yours.

Participants who agree to report to the owner (below) consent to that
separately and by name, in a message, not in the app. The app never
knows the pair exists.

## Personal adaptation

Each participant answers her own four questions before each session
(ADR-0003): time, energy, quiet, anything sore. Her own equipment
answer, her own remembered restrictions, her own tier per pattern. The
invitation changes none of it. Two friends on the same Tuesday may train
10 minutes quiet on a hotel floor and 30 minutes strong with a chair, and
both count the same way: a trained day is a day with at least one
attempted block (`trainedDay`, ADR-0023).

The word "with" in the invitation means the same week, not the same
room, the same time, or the same session.

## What the recipient's phone does with `friends_week`

The least it does, and the default for this pilot: the app opened through the
link fires `scenario_entry { scenario: "friends_week" }` once and shows
the ordinary first-use flow. Nothing is prefilled. If she is already a
user, it opens Home.

DECIDE (owner): whether the scenario also surfaces the wave 2 weekly
intention question with "3 days" highlighted, one tap to accept, so the
invitation and the intention are the same gesture. It is one screen that
already exists; it is still a product decision and this brief does not
take it. Whichever way it goes, she can decline and nothing is set.

## Success measures

Everything is measured as each participant's own week on her own phone,
plus aggregate counts. Nothing joins one person to another.

**Pair success.** Both participants' week views show three or more
trained days in the same Monday to Sunday week (`weekParticipation.count
>= 3`, which is `weeklyIntentionMet` with target 3). The week view's own
definition is used, not the analytics definition, because it is the only
number each phone shows and the only number a participant can read out.

**How it is known.** By report, not by data. On the Monday after each
pilot week, each participant who agreed to report sends the owner one of:
a screenshot of her week view, or the answer to one question: "How many
days did your week view show?" The owner records pairs by first name,
keeps screenshots for two weeks, then deletes them. The write-up carries
counts only.

**Aggregate cross-checks (PostHog, per docs/measurement.md):**

- `scenario_entry` where `scenario = friends_week`: recipient entries on
  the phone.
- Web page views for `/s/friends_week`: recipient entries before install.
- `share_start` with `source` in {receipt, recap} during the pilot weeks:
  an upper bound on invitations, since a sheet opened is not a message
  sent.
- `weekly_intention_set` with `target = 3` during the pilot weeks, if wave
  2 ships that event.
- The candidate activation and week-two retention cohorts, unchanged,
  for the pilot's calendar window, quoted with the note that pilot
  participants are a handful inside a small population.

Windows close three days after the week ends before any number is read
(offline queue). Nothing above is cut per person or per pair.

**Also recorded, from the sender's own phone:** her previous four weeks
from `weeksParticipation`, as she reads them off Progress. If most senders
were already at three days a week, the pilot has learned less than it
looks.

## Run size and duration

- **Pairs:** 10 to 20. One sender per pair, drawn from TestFlight
  testers already training; she picks one friend. Recipients may be new
  installs. Fewer than 10 reporting pairs and the pilot is a set of
  anecdotes; it is written up as such.
- **Duration:** two weeks, both Monday to Sunday. Invitations go out
  Thursday to Sunday before week 1, so the recipient can install and
  answer her own questions before the week starts. Week 2 is a second
  attempt and a first look at whether it repeats.
- **Read-out:** the Thursday after week 2 (three-day close), one page,
  counts and quotes, no names.

## Exit questions

Asked once, after week 2, by message. Five questions, short answers.

1. Did you reach three days in either week? Which?
2. Did knowing a friend was training the same week change anything about
   when or whether you trained? What?
3. Did you talk to each other about it? Where?
4. Would you want to see anything about her week in the app? If so, what
   exactly?
5. Was there any moment it felt like pressure?

Question 5 is the one that can stop the whole idea.

## What would make shared state worth building

Shared state means anything where one phone shows something about
another person's training. It needs ADR-0022 sync, accounts on both
sides, and its own ADR. The pilot is worth that only if all of these hold:

1. **It happened.** At least half of reporting pairs both reached three
   days in the same week, in at least one of the two weeks.
2. **It was not already happening.** Most senders' previous four weeks
   were below three days more often than not.
3. **They wanted more than a link.** At least half of participants,
   asked question 4, name something specific they would want to see, and
   what they name is a presence signal (days she trained), not a gap.
4. **Nobody felt pushed.** No more than two participants answer yes to
   question 5. One clear account of pressure from a friend's absence or
   presence is a design constraint; three is a stop.
5. **The recipient side moved.** `/s/friends_week` page views and
   `scenario_entry` counts are not near zero relative to `share_start`
   during the pilot, allowing for the sheet-not-sent gap.

If built, the shape is already bounded by the no-guilt rule: a friend's
week shows days trained and nothing else. Never days missed, never a
streak, never a tier, never her answers. Opt-in on both sides, revocable
by either, and a missed day on one phone is invisible on the other.

If 1 or 4 fails, the answer is not "try again with more pairs". The
answer is that an invitation and a week view were the right amount of
social for this product, and the sharing loop from wave 3 stands as is.

## What cannot be measured

Stated so nobody quotes a number this pilot cannot produce.

- **Cause.** Whether the invitation caused anyone to train. There is no
  control group, no assignment, and ten to twenty pairs.
- **Attribution.** Which sender's link a `scenario_entry` came from.
  Anonymous ids reset on reinstall and sign-out; recipient numbers come
  from the web page and cannot be joined to the sender.
- **Invitations sent.** `share_start` is a sheet opened. Messages,
  WhatsApp and Mail report nothing back.
- **Silent recipients.** A friend who does not agree to report is
  invisible except as one aggregate entry, if she installed at all.
- **Self-report.** A screenshot is honest; a number typed from memory
  may not be. Both are accepted and the write-up says which.
- **"Together."** Whether the two trained on the same day, talked, or
  cared. Only the exit questions touch this and they are answers, not
  measurements.
- **Retention beyond week 2.** Two weeks says nothing about week four.
  The standard cohorts keep running; the pilot does not claim them.

## Open decisions

- DECIDE: whether the friend invitation is a distinct option on the
  receipt and recap share sheet, or the ordinary share with
  `friends_week` in the path. Distinct is clearer for the sender and
  gives a cleaner count; ordinary is less UI.
- DECIDE: whether `friends_week` surfaces the weekly intention question
  on the recipient's phone (above).
- DECIDE: whether the recipient page for `friends_week` links to
  TestFlight during the pilot or waits for the store listing. If
  TestFlight, `scenario_entry` still fires through the universal link
  once the build is installed; if universal links are not ready, only web
  page views count and the brief says so in the read-out.

## Recipient page copy for `friends_week`

- Headline: **Three sessions this week, with a friend.**
- One line: Each on your own schedule. 10, 20 or 30 minutes, built for
  the day you're having.
- Button: **Try your first session**
- Consent line under the button: A friend sent you this. She won't see
  what you do here, and you won't see her sessions. Your week is yours.

No testimonials, no numbers about anyone's body, no promise about what
two weeks will do. The first session is never behind the paywall
(ADR-0014), so the button is honest.
