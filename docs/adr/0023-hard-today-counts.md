# ADR-0023: "Hard today" counts as showing up

- Status: accepted
- Date: 2026-09-07
- Amends: ADR-0018 §1 (trained day), ADR-0012 (the nothing-done close)

## Context

After each block the player asks how it went; "Hard today" records the
block as struggled. The engine awards points and tier credit only for
completed blocks (ADR-0008), and the finish screen, the hub's done state
and the streak all keyed off the same "completed" fact. So a woman who
did every block and answered "Hard today" on each saw "Today didn't fit.
That happens.", zero points, no figures, and no day on her streak. She
showed up and did the work. The phase-3 reviewer surfaced it; the owner
decided on 2026-09-07.

## Decision

1. **Attempted is done.** A block she completed or struggled through is
   attempted; only a skipped block is not. The finish closes as a
   session ("Session complete", "Finished here", or the minutes kept)
   whenever at least one block was attempted, and draws every attempted
   block's figure. The nothing-done close is for a session with every
   block skipped.
2. **The day counts.** The hub's done state (`todayTraining`) and the
   engine's streak (`computeStreak`) count a day with an attempted block.
   The daily invitation follows, since it reads the same two.
3. **Points and progression are unchanged.** A struggled block earns
   nothing and still eases the ladder (ADR-0008). A session of struggled
   blocks shows no points row rather than "+0". The trial stamp still
   waits for a completed block (ADR-0014 §6), because that is the
   engine's own "session" event.

## Consequences

- Engine: one line in `streak.ts`; the sim gates do not read the streak.
- App: the close decision in `session-store`, the figure filter on the
  finish, `todayTraining`. Copy unchanged: "That counts." was already
  true for her; now the screen agrees.
