# ADR-0019: The figures move, as a two-pose loop

- Status: accepted
- Date: 2026-09-07
- Refines: ADR-0013 (every movement has a face), ADR-0017 (figure tones)

## Context

The owner approved the line figures on 2026-09-06 and asked whether they
could move. Brief 6's commissioned animation is not started, the app
must add no dependency for this, and the figures are already generated
from pose data (`scripts/generate-movement-figures.py`). The owner chose
"option 1 now": two keyframes per movement, crossfaded on a loop.

## Decision

1. **Two keyframes per movement, from the same pose data.** The generator
   draws frame A (the pose every surface has shown) and frame B, the
   other end of the movement's range of motion: push-up top and bottom,
   squat standing and deep, bridge down and up, hinge upright and folded.
   Holds get a small honest shift (the free limb, a hip), never a broken
   pose. Files are `<id>.png` and `<id>-b.png`; frame A files are
   byte-identical to before, so nothing already reviewed changed.
2. **The Animated API, nothing else.** `MovementFigure` takes `animate`;
   when set it draws both frames stacked and crossfades opacity on a
   loop, 1.4 s per half, ease in and out, on the native driver. No Lottie,
   no Reanimated, no video.
3. **Reduce Motion shows frame A, still.** So does a missing second
   frame. The loop stops on unmount.
4. **Hero figures only.** The player's block intro and work phase and the
   unlock moment animate. Lists, rows, the ladder strip and the share
   card (captured to an image) stay still: a page of breathing figures
   is noise, one is a coach.
5. **Brief 6 replaces the rendering, not the pose.** The commissioned
   animation lands behind the same component and the same ids; the
   keyframe pair stays as the fallback and as the brief's reference.

## Consequences

- 120 PNG assets instead of 60 (about 0.4 MB more in the bundle).
- A test pins that every library movement has both frames and that the
  component is still under Reduce Motion.
- The frame-B poses are craft, not coaching: the movement-author's cues
  and the coach review remain the truth of how a movement is performed.
