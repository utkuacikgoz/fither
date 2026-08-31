# Gamification — points, skills, and what is forbidden

Progress in FITHER is framed as **capability**: what your body can do that
it couldn't before. Every mechanic below exists to make capability visible.
Any mechanic that motivates through loss, shame, or body appearance is out,
permanently.

## Points ledger

- Points are earned for completed work: finishing a session, finishing a
  block, completing a first session at a new tier.
- Points are **only ever added**. No decay, no deductions, no expiry.
  The ledger is append-only — implement it as one, so a bug can never
  silently take points away.
- Points buy nothing and gate nothing. They are a visible record of work
  done, not a currency.
- Values (decided, ADR-0003): **1 point per minute** — 10/20/30 points
  per completed session by length; **+5** per block completed at a
  newly-reached tier; **+25** per skill unlock. Simple mental math,
  longer sessions visibly count more, nothing gameable. The values live
  in one table in the engine so tuning is a data change, not a logic
  change.

## Skills (named unlocks)

- Each pattern's tier milestones map to named, human-meaningful skills —
  e.g. reaching push tier 4 unlocks "Full Push-Up". Names come from
  `data/movements.json` / Brief 5, not invented ad hoc in UI code.
- Unlocks trigger an unlock screen and a shareable card. The share card
  states the skill, never stats about the body.
- Skills are never lost. A tier regression (an engine event) does not
  revoke a skill — you did it, it happened.

## Forbidden mechanics (restating the domain list, mechanically)

- **No streaks.** Nothing counts consecutive days. Nothing resets when the
  user misses a day. Notifications never reference absence ("we miss
  you", "don't lose your progress" — both forbidden).
- **No weight, no calories, no measurements.** Not as optional fields, not
  in analytics events, not in the data model. If a table has a `weight`
  column, that is a bug.
- **No body-shape language** anywhere a mechanic surfaces text — unlock
  names, share cards, notifications.
- **No leaderboards, no comparison to other users.** The only comparison
  is to your own past capability.

## Why so strict

The retention thesis is that adherence comes from visible capability gains
and zero guilt. Streaks and body metrics buy short-term engagement by
charging interest in shame, and this audience has been overcharged by every
other fitness app. The forbidden list is the product's moat; treat a
violation as a shipped bug of the highest severity.
