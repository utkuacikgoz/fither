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
- Values (decided, ADR-0008, superseding ADR-0003's per-minute rule):
  **20 / 25 / 30 points per completed session** for 10/20/30 minutes —
  a 15-point base for showing up plus 5 per ten minutes. Ten minutes is
  complete, so the base dominates (the spread is 1.5x, not 3x), while
  longer sessions still visibly earn more. **+5** per block completed
  at a newly-reached tier; **+25** per skill unlock. The values live in
  one table in the engine so tuning is a data change, not a logic
  change.
- Skill unlocks are paced honestly (ADR-0008): tier advancement requires
  both clean sessions AND minimum calendar time at the tier, so the
  first named skill lands around week 7 of consistent training and the
  ladder lasts beyond six months. Never add a mechanic that lets someone
  buy speed with extra volume — the time floor is also an overuse guard.

## Skills (named unlocks)

- Each pattern's tier milestones map to named, human-meaningful skills —
  e.g. reaching push tier 4 unlocks "Full Push-Up". Names come from
  `data/movements.json` / Brief 5, not invented ad hoc in UI code.
- Milestone tiers (decided, ADR-0005): **tier 4** (the capability
  milestone — the ladder's namesake movement) and **tier 6** (mastery).
  Two unlocks per pattern, ten in total; scarcity keeps them meaningful.
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
