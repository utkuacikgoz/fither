# ADR-0030: Haptics, behind a port, at the moments a state change is hers

- Status: accepted
- Date: 2026-09-14

## Context

The feedback audit (owner, 2026-09-14) found every action in the app
answered with motion only: press-surface scales and fades, but nothing
is felt. On iOS a tap that changes state and is not felt reads as a tap
that may not have landed. The owner asked for feedback at six moments:
a choice registered, a set begun (by her tap or by a hand-off), a skip
landing, a session closing, a purchase or restore granting, a note
kept, and the voice switched on.

## Decision

1. **`expo-haptics` sits behind `app/src/haptics/haptics.ts`.** Call
   sites name a moment, never the SDK: `haptic("tap" | "commit" |
   "success")`. `tap` is the selection engine, `commit` a medium impact,
   `success` the success notification. The call is synchronous and
   swallows everything; nothing waits on it and nothing can fail because
   of it (Simulator, an old phone, System Haptics off). Reduce Motion
   does not gate it: the OS's own System Haptics switch does.
2. **Where it fires, and only there.**
   - `tap`: inside `row-button` and `option-row`, so every prompt answer,
     feedback answer and settings choice is felt once, in one place.
   - `commit`: the player on every transition INTO work (her Begin, her
     set-done into the next set, and the rest or side-switch counting
     out on its own), and when a skip lands (the second tap, never the
     arming one). The preview's care note, when Continue keeps a
     non-empty note.
   - `success`: the finish screen once the close settles, unless the
     close is the honest nothing-done; the entitlement store when a
     purchase or a restore grants, so every screen that asks (paywall,
     lifetime offer, Settings restore, the gated day) feels the same
     grant from one line.
3. **Switching the voice on answers in the voice.** `session/voice-sample.ts`
   picks the first in-set cue in the library that has a bundled file and
   `speakCue`s it from the Settings voice page and the voice ask. No
   recording exists for the sake of a demo; the sample is a real cue.
4. **Tests read the port's call log** (`test-utils/haptics.ts`), never
   the SDK; the jest mock is in `jest-setup.ts`.

## Consequences

- One native module added to the app (`expo-haptics ~55`); the next
  build is a rebuild (prebuild already runs in `pnpm ship`).
- A new feedback moment is a one-line call naming one of three kinds;
  a fourth kind is an edit to this ADR first.
- Nothing about the engine, the data, or the offline rule changes.
