# Demonstration assets: the first-session set

The two-pose crossfade (ADR-0019) shows a movement's shape. It is not
evidence that she can perform the movement from it. Brief 6 commissions
real demonstrations; this file names the few that matter most for the
first session and briefs each, so the first clips are the right ones.

## Which movements, and why these

The first session of a fresh profile draws from tier 1 of every pattern.
The coverage audit (docs/engine-decision-tree.md) shows which tier-one
movements appear most across the whole prompt space; the first six clips
should be the ones a beginner meets first and is most likely to do
wrong.

| movement | pattern | why first |
|---|---|---|
| Wall Push-Up | push | in almost every first session; elbows flare, hips sag |
| Glute Bridge | hinge | the most common hinge; back arches instead of hips lifting |
| Partial Squat | squat | depth and knee tracking are invisible in a still |
| Shoulder Blade Squeeze | pull | the movement is small; a still shows nothing |
| Wall Plank | core | the body line is the whole cue |
| Supported Sit-to-Stand | squat (chair) | the chair path; how to sit back quietly |

## Brief per clip

- Length: 6 to 8 seconds, two full repetitions, seamless loop.
- Framing: side on for push, hinge and squat; three-quarter front for
  pull and plank. Whole body in frame, feet visible, phone-height
  camera (about 30 cm off the floor, the angle she sees the phone from).
- Subject: one woman, ordinary clothes, ordinary room, no gym. No
  music, no voice on the clip (the coaching voice is separate).
- Colour: neutral so the app's tint works; export as looping MP4 (H.264,
  720x720, under 1.5 MB) plus a poster PNG at the first frame.
- Cue alignment: each clip's two repetitions must match the movement's
  `cues` in data/movements.json in order; the coach signs off the clip
  against the cues.
- Delivery: `app/assets/demos/<movement-id>.mp4` and `.png`; the figure
  component gains a `demo` source that the player's intro uses when the
  file exists and falls back to the two-pose figure otherwise.

## Not in this set

Everything at tier 2 and above waits for the first six to be validated
on a device with two real beginners (the Gate 3 sessions are the
natural place).
