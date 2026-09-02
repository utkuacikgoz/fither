# ADR-0012: Four decisions from the exercise-experience audit

- Status: accepted
- Date: 2026-09-02

## Context

The exercise-experience audit (docs/review/2026-09-02-exercise-experience-audit.md)
listed decisions that block its remaining waves. The owner resolved four:

## Decisions

1. **Skip is progression-neutral.** A skipped exercise neither advances
   nor regresses anything — it does not count as completed, does not
   count as struggled, and contributes to no easing or tier-regression
   signal. This replaces the prior skipped-as-struggled treatment
   (ADR-0003's regression inputs are now struggled outcomes only). The
   no-guilt promise becomes mechanically true: "either way is fine" is
   only honest copy if the engine agrees. Engine change; ships with a
   full sim run.
2. **Session length is a ceiling with +10% tolerance.** 10/20/30 minutes
   is a promise the player enforces, not an estimate: the player tracks
   elapsed session time, and once elapsed time would exceed the chosen
   length plus 10%, it wraps up at the next phase boundary — remaining
   blocks are recorded as skipped (neutral, per §1), completed work
   counts, and the close says honestly that time was up. Generation
   already budgets to the length; this covers the tap-paced reality.
3. **Skills celebrate at tier entry with honest copy.** The unlock
   moment stays where it is (reaching the tier), but no copy may claim
   she has performed the movement. "Now in your training", not "my body
   can do this now". The share message changes accordingly.
4. **Care notes become a real journal.** The optional heavy-day note
   stays, and gains the lifecycle the audit demanded: her notes are
   viewable, editable, and deletable from Settings. Local-only remains
   absolute — the notes never leave the phone, and no analytics may
   reference their existence or content.

## Consequences

- Engine: `applySessionResult` treats skipped blocks as neutral;
  engine-spec reference updated to match; simulation gates re-verified
  (skip-neutrality slightly slows users whose sessions contain skips —
  gates must still pass).
- Player: elapsed-session tracking and the wrap-up path are part of the
  time-budget contract the audit's wave 2 requires; the +10% tolerance
  is the documented number Gate 3 and QA test against.
- Copy: unlock/share language, skip labels ("Skip exercise", counts-as
  disclosure), and the new ended-early / out-of-time / completed-today /
  zero-completion states all flow from these decisions.
- Settings gains a care-notes section (view/edit/delete). Deleting a
  note is destructive and confirmed once, calmly.
