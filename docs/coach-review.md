# FITHER movement library — coach review packet

Prepared for an external strength & conditioning review, 31 August 2026.
One pass through the full library before the app ships. Nothing here
assumes you have seen the app or the codebase; this document is
self-contained. Sections: context (one page), the five ladders in full,
eight numbered review questions, and how to send your answers back.

---

## 1. Context

**Who the users are.** Women with almost no discretionary time — careers,
kids, caring responsibilities. English-speaking, iPhone. They usually
train at home, often while someone sleeps in the next room, or in an
office or hotel room. They are not "beginners" as an identity; they are
busy, and many are detrained. A secondary audience is frequent travelers.
Postpartum mothers are a planned **future** audience, explicitly gated on
a specialist review of this library and the program rules — they are not
targeted in version 1, but realistically some users will be within a year
or two of giving birth and will never tell the app.

**The format.** Every workout is 10, 20 or 30 minutes — the user picks
one of those three each day, and a 10-minute session is treated as a
complete workout, never a cut-down one. Before each session the app asks
four quick questions: how much time (10/20/30), energy (low/okay/strong),
"do you need to be quiet right now?" (yes/no), and "anything sore or
off-limits today?" (tap body areas, or "all good"). The answers filter
and shape that day's session.

**Equipment and constraints.** There is deliberately no gear. The only
"equipment" values a movement can carry are **none**, **chair** (an
ordinary household chair, always braced against a wall per the coaching
cues) and **wall** (which includes a doorframe — every home has one).
Every movement in the current library is tagged **silent**: no jumping,
no impact, nothing that would wake a child in the next room. The library
guarantees that even under the strictest combination — silent, no gear
beyond a chair and a wall — a full session exists at tiers 1–4 of every
movement pattern.

**How a session is built.** Five movement patterns: push, pull, squat,
hinge, core. Each pattern is a ladder of six difficulty tiers. A session
is a handful of movement blocks chosen from the user's current tier in
each pattern, prioritising whichever patterns she has trained least
recently (no pattern is allowed to disappear for more than 7 of her
training days). The standard dose per block is **3 sets** (2 sets on
low-energy days, or when trimming to fit the time budget), with **45–90
seconds of rest** between sets and about 20 seconds allowed for setup
between blocks. Single-side movements are done on both sides, so they
take double the work time. The reps/seconds shown in the tables below
are the per-set defaults.

**How she progresses.** A pattern's tier goes up after **3 clean
sessions** at the current tier — clean meaning every block of that
pattern completed without her marking it "struggled". Going down is
gentler and slower: two consecutive sessions of struggling in a pattern
first **reduce volume at the same tier**; only a third consecutive one
drops her a tier, and she lands there at reduced volume. Time away never
demotes her — someone training twice a week, or coming back after a
break, keeps every tier she earned.

**"Sore or off-limits" filtering.** Each movement lists the body areas it
loads (shoulders, wrists, elbows, back, hips, knees, ankles, midsection).
When the user flags an area, every movement loading it is excluded that
day; the engine falls to lower tiers of the same pattern if the current
tier empties, and drops the pattern for the day if nothing survives.
These tags do a lot of safety work, so several questions below are about
whether they are tagged correctly.

**Tier-4 milestones.** Reaching tier 4 in a pattern is presented to the
user as earning a named skill — "Full Push-Up", "Full Plank" and so on —
one of the app's two celebration moments per pattern (the other is
tier 6, framed as mastery). So the tier-4 movements carry more meaning
than their neighbours: they should genuinely be worth naming, and the
step from tier 3 to tier 4 should feel earned but reachable. They are
marked ★ in the tables.

*A wording note:* the coaching cues quoted below are being copy-edited in
parallel, so treat exact phrasing as indicative. The structure — which
movements exist, their tiers, reps, seconds, holds, load tags and
progression links — is stable and is what we are asking you to review.

---

## 2. The five ladders

Each table is one pattern, tier by tier. "Per set" is the default dose
for one set (standard prescription: 3 sets). "One side at a time" means
the dose is per side. "Progresses to" is the next rung the app moves her
to. ★ = tier-4 milestone (becomes a named skill unlock).

### Push (13 movements)

| Tier | Movement | Per set | Loads | Progresses to |
|---|---|---|---|---|
| 1 | Wall Push-Up | 10 reps, ~4s each | shoulders, elbows, wrists | Incline Push-Up |
| 1 | Wide Wall Push-Up | 10 reps, ~4s each | shoulders, elbows, wrists | Wide Incline Push-Up |
| 1 | Wall Push-Up Hold | 20s hold | shoulders, elbows, wrists | Incline Push-Up Hold |
| 2 | Incline Push-Up (hands on chair) | 8 reps, ~4s each | shoulders, elbows, wrists | Kneeling Push-Up |
| 2 | Wide Incline Push-Up | 8 reps, ~4s each | shoulders, elbows, wrists | Wide Kneeling Push-Up |
| 2 | Incline Push-Up Hold | 20s hold | shoulders, elbows, wrists | Incline Pike Push-Up |
| 3 | Kneeling Push-Up | 8 reps, ~4s each | shoulders, elbows, wrists | Full Push-Up |
| 3 | Wide Kneeling Push-Up | 8 reps, ~4s each | shoulders, elbows, wrists | Full Push-Up |
| 3 | Incline Pike Push-Up (hands on chair) | 6 reps, ~4s each | shoulders, elbows, wrists | Pike Push-Up |
| 4 ★ | Full Push-Up | 6 reps, ~4s each | shoulders, elbows, wrists, midsection | Decline Push-Up |
| 4 ★ | Pike Push-Up | 6 reps, ~4s each | shoulders, elbows, wrists | Decline Push-Up |
| 5 | Decline Push-Up (feet on chair) | 6 reps, ~4s each | shoulders, elbows, wrists, midsection | Archer Push-Up |
| 6 | Archer Push-Up | 4 reps, ~5s each | shoulders, elbows, wrists, midsection | — (top of ladder) |
| 1 | Forearm Wall Push (wrist-neutral) | 10 reps, ~3s each | shoulders, elbows | Chair Grip Push-Up |
| 1 | Fist Wall Push-Up (wrist-neutral) | 10 reps, ~4s each | shoulders, elbows | Chair Grip Push-Up |
| 2 | Chair Grip Push-Up (wrist-neutral) | 8 reps, ~4s each | shoulders, elbows | Fist Kneeling Push-Up |
| 3 | Fist Kneeling Push-Up (wrist-neutral) | 8 reps, ~4s each | shoulders, elbows | Full Push-Up |

Note: the four wrist-neutral variants (added 2026-09-07, question 7)
are the only push movements that do not load the wrists. A wrist
avoider trains push at tiers 1 to 3 and plateaus at tier 3; a tier 4
fist push-up was left for your call (knuckle load on a hard floor).

### Pull (10 movements)

With no bar, bands or table in the product, the loaded half of this
ladder is carried entirely by **doorframe rows** (grip the frame, lean
back, row the body in), alongside an unloaded prone-raise track.

| Tier | Movement | Per set | Loads | Progresses to |
|---|---|---|---|---|
| 1 | Shoulder Blade Squeeze | 12 reps, ~3s each | back, shoulders | Prone W Raise |
| 1 | Wall Slide | 10 reps, ~4s each | back, shoulders | Doorframe Lean Row |
| 2 | Prone W Raise | 10 reps, ~3s each | back, shoulders | Prone Y Raise |
| 2 | Doorframe Lean Row (shallow lean) | 10 reps, ~4s each | back, shoulders, elbows | Doorframe Row |
| 3 | Prone Y Raise | 10 reps, ~3s each | back, shoulders | Prone Y-T-W Raise |
| 3 | Doorframe Row | 8 reps, ~4s each | back, shoulders, elbows | Deep Doorframe Row |
| 4 ★ | Prone Y-T-W Raise | 5 reps, ~6s each | back, shoulders | Single-Arm Doorframe Row |
| 4 ★ | Deep Doorframe Row (strong lean) | 8 reps, ~4s each | back, shoulders, elbows | Single-Arm Doorframe Row |
| 5 | Single-Arm Doorframe Row | 6 reps/side, ~4s each | back, shoulders, elbows, wrists | …Row with Pause |
| 6 | Single-Arm Doorframe Row with Pause | 5 reps/side, ~6s each | back, shoulders, elbows, wrists | — (top of ladder) |

This ladder is the subject of questions 1 and 2.

### Squat (13 movements)

| Tier | Movement | Per set | Loads | Progresses to |
|---|---|---|---|---|
| 1 | Supported Sit-to-Stand (hands assist) | 8 reps, ~5s each | knees, hips | Sit-to-Stand |
| 1 | High Wall Sit (shallow angle) | 20s hold | knees, hips | Wall Sit |
| 1 | Partial Squat | 10 reps, ~4s each | knees, hips | Half Squat |
| 2 | Sit-to-Stand | 8 reps, ~5s each | knees, hips | Air Squat |
| 2 | Wall Sit | 30s hold | knees, hips | Paused Squat |
| 2 | Half Squat | 10 reps, ~4s each | knees, hips | Sumo Squat |
| 3 | Air Squat | 10 reps, ~4s each | knees, hips, ankles | Split Squat |
| 3 | Sumo Squat | 10 reps, ~4s each | knees, hips, ankles | Split Squat |
| 3 | Paused Squat (2-breath pause at the bottom) | 8 reps, ~6s each | knees, hips, ankles | Reverse Lunge |
| 4 ★ | Split Squat | 8 reps/side, ~4s each | knees, hips, ankles | Elevated Split Squat |
| 4 ★ | Reverse Lunge | 6 reps/side, ~5s each | knees, hips, ankles | Elevated Split Squat |
| 5 | Elevated Split Squat (rear foot on chair) | 6 reps/side, ~4s each | knees, hips, ankles | Single-Leg Sit-to-Stand |
| 6 | Single-Leg Sit-to-Stand | 4 reps/side, ~6s each | knees, hips, ankles | — (top of ladder) |

The paused squat is the subject of question 5.

### Hinge (12 movements)

Kept separate from squat on purpose: posterior-chain work is what this
audience most lacks, and merging the patterns would let the program drift
into all-quad weeks.

| Tier | Movement | Per set | Loads | Progresses to |
|---|---|---|---|---|
| 1 | Glute Bridge | 10 reps, ~4s each | hips | Glute Bridge March |
| 1 | Glute Bridge Hold | 20s hold | hips | Paused Glute Bridge |
| 1 | Standing Hip Hinge | 10 reps, ~4s each | hips, back | Hinge and Reach |
| 2 | Glute Bridge March | 10 reps, ~3s each | hips, midsection | Single-Leg Glute Bridge |
| 2 | Paused Glute Bridge | 8 reps, ~5s each | hips | Feet-Elevated Glute Bridge |
| 2 | Hinge and Reach | 10 reps, ~4s each | hips, back | Single-Leg Glute Bridge |
| 3 | Single-Leg Glute Bridge | 8 reps/side, ~4s each | hips, midsection | Single-Leg Hip Hinge |
| 3 | Feet-Elevated Glute Bridge (heels on chair) | 10 reps, ~4s each | hips | Hip Thrust |
| 4 ★ | Single-Leg Hip Hinge | 6 reps/side, ~5s each | hips, back, ankles | Single-Leg Elevated Bridge |
| 4 ★ | Hip Thrust (shoulders on chair seat) | 10 reps, ~4s each | hips | Single-Leg Elevated Bridge |
| 5 | Single-Leg Elevated Bridge (heels on chair) | 6 reps/side, ~4s each | hips, midsection | Single-Leg Hip Thrust |
| 6 | Single-Leg Hip Thrust | 6 reps/side, ~4s each | hips, midsection | — (top of ladder) |

Chair-supported thrusts are question 4; the load tags on bridges are
question 6.

### Core (12 movements)

The floor planks (tiers 3–4) are cued on forearms, which is why they do
not carry a wrist tag; the tier 5–6 movements are on hands and do.

| Tier | Movement | Per set | Loads | Progresses to |
|---|---|---|---|---|
| 1 | Wall Plank (hands on wall) | 20s hold | midsection, shoulders, wrists | Incline Plank |
| 1 | Seated Knee Lift (on chair) | 10 reps, ~3s each | midsection, hips | Kneeling Balance Reach |
| 1 | Lying Heel Slide | 10 reps, ~4s each | midsection | Lying Heel Tap |
| 2 | Incline Plank (hands on chair) | 20s hold | midsection, shoulders, wrists | Knee Plank |
| 2 | Kneeling Balance Reach | 8 reps, ~4s each | midsection, back | Knee Side Plank |
| 2 | Lying Heel Tap | 10 reps, ~4s each | midsection | Knee Plank |
| 3 | Knee Plank (forearms) | 25s hold | midsection, shoulders | Full Plank |
| 3 | Knee Side Plank (forearm) | 20s hold/side | midsection, shoulders | Side Plank |
| 4 ★ | Full Plank (forearms) | 30s hold | midsection, shoulders | Plank Shoulder Tap |
| 4 ★ | Side Plank (forearm) | 20s hold/side | midsection, shoulders | Plank Shoulder Tap |
| 5 | Plank Shoulder Tap (on hands) | 10 reps, ~3s each | midsection, shoulders, wrists | Plank Walkout |
| 6 | Plank Walkout | 5 reps, ~8s each | midsection, shoulders, wrists | — (top of ladder) |

The lying heel movements are question 3.

---

## 3. Review questions

Questions 1–6 were flagged by the library's original author at the moment
of writing; 7 and 8 came out of later analysis. Please answer all eight,
and add anything we did not think to ask.

**1. Doorframe rows — grip and structural assumptions.** The entire
loaded pull progression (tiers 2–6) depends on gripping the trim of an
ordinary interior doorframe with the fingers and leaning back, feet
walking further forward as tiers rise (a "dry your hands, grip firm" cue
appears at the deep version). Are we right that a typical household
doorframe offers enough purchase for this population at a strong lean —
including smaller hands, longer nails, painted or shallow trim? At what
lean does the risk of grip slip (a backwards fall onto the floor)
outweigh the training value? If doorframe rows are unsound as the load-
bearing pull track, what would you substitute given the hard constraint
of no gear beyond a chair and a wall — is there a safe no-equipment
rowing pattern we are missing?

**2. Is pull tier 6 too modest?** The ladder tops out at a single-arm
doorframe row with a pause. Compare the other patterns' ceilings: archer
push-ups, single-leg sit-to-stands, single-leg hip thrusts, plank
walkouts. Users can sit at tier 6 for months (the program runs
indefinitely; tier 6 progress is volume and density). Is this ceiling
enough pulling stimulus for someone training consistently for six months
or more, and does presenting it as a "mastery" achievement oversell it?
Related: the jump from two-arm (tier 4) to single-arm (tier 5) rows looks
like the biggest single step in the library — is it too big?

**3. Lying heel slides and taps — postnatal suitability.** Core tiers
1–2 were deliberately kept conservative (heel slides, heel taps, wall
and incline planks) partly with postnatal users in mind. Postpartum
mothers are not the version-1 audience, but some users will inevitably be
months out from giving birth and will never say so — the app only asks
about time, energy, quiet and today's soreness. Are lying heel slides
and heel taps (knees above hips, one heel lowered to tap the floor,
"lower back settled" cue) safe defaults for an undisclosed postnatal
user, including one with abdominal separation? Would you change the cue,
the rep count, the leg position, or the movement itself? More broadly: is
there anything in tiers 1–2 of any ladder you would not hand to an
unscreened recently-postnatal woman?

**4. Hip thrusts on a household chair.** Hinge tiers 3–6 use a chair
three ways: heels on the seat (elevated bridges), and shoulders on the
seat with hips driving up (hip thrusts, including single-leg). The cue
requires the chair backed against a wall, but we cannot control what
chair she owns — kitchen chairs, desk chairs with wheels, folding chairs,
low stools. Is "chair against a wall" sufficient to make shoulder-
elevated thrusting safe, or do these movements need a stricter setup
requirement (seat height range, no wheels, cushioned edge), a different
support (e.g. shoulders on the front edge of a sofa), or removal in
favour of floor-only progressions?

**5. Paused squats and pre-existing knee pain.** Squat tier 3 includes a
paused squat: sit to the bottom, hold for two slow breaths, stand — 8
reps at roughly 6 seconds each, typically 3 sets. The daily soreness
question removes the whole squat ladder when she taps "knees", but that
only catches days she reports; chronic, low-grade knee pain that she
considers normal is never screened. Is a full-depth bottom-pause squat
appropriate as a standard tier-3 rung for an unscreened population with
this profile, or should tier 3 offer a knee-friendlier route (box/chair
depth target, reduced range, shorter pause)? Would you change the depth
cue?

**6. Bridges on sore-back days.** The load tags drive the daily filter,
and none of the bridge or thrust variants carry a "back" tag — only the
standing hinges (standing hip hinge, hinge and reach, single-leg hip
hinge) do. Practical effect: on a day she reports her back as sore, the
app will still prescribe glute bridges, elevated bridges and hip
thrusts. Our reasoning was that bridges are commonly recommended with a
sore lower back and that removing the whole hinge pattern would cost her
the posterior-chain work she most needs. Do you agree? Go through the 12
hinge movements: which are appropriate on an acutely sore-back day, which
should be excluded (i.e. gain a "back" tag), and are the standing hinges
correctly excluded?

**7. Wrists and the push pattern.** Every push movement, wall to archer,
carries a wrist tag — correctly, since all are palms-flat extended-wrist
positions. Consequence: a user who reports sore wrists every day (common
in this demographic — desk work, carrying children, de Quervain's,
pregnancy-related carpal tunnel) gets **no push work at all, ever**, and
the app never tells her why. Are wrist-neutral push variants worth
adding — for example a forearm wall lean, fist push-ups on a rolled
towel-free knuckle base, or neutral-grip variations you would trust
without equipment? Which specific variants would you add, at which
tiers, and would you trust them for the same progression credit as the
palm versions?

**8. Do the timing assumptions match how this population moves?** Every
dose in the app is computed from per-movement timing data, because the
10/20/30-minute promise is a hard ceiling. The current numbers: reps at
3–6 seconds each for nearly everything (one outlier: plank walkouts at 8
seconds per rep); holds of 20–30 seconds; 45–90 seconds of rest between
sets; ~20 seconds allowed to set up each movement; 3 sets standard, 2 on
low-energy days. Advancement needs 3 clean sessions at a tier. For
detrained, time-poor women moving at home without supervision: are the
seconds-per-rep figures realistic (too fast risks rushed reps; too slow
under-fills the session)? Are 45–90-second rests right for this style of
work, or would shorter rests suit the lower tiers? Any movement whose
default reps, hold length, or tempo looks wrong in the tables above,
please flag it.

---

## 4. How to respond

- **Answer by question number**, 1 through 8. A verdict plus a sentence
  or two of reasoning is ideal: *fine as is / change X / remove and
  replace with Y*.
- **Flag individual movements by their id** (the kebab-case name in
  parentheses works too — e.g. `deep-doorframe-row`, `lying-heel-tap`,
  `paused-squat`). For each red flag, say what is wrong and what you
  would do: change the cue, change the reps/tempo/hold, move it to a
  different tier, add a prerequisite, or cut it.
- Everything is changeable at this stage — tiers, doses, cues, load
  tags, whole movements — except the frame itself: no equipment beyond a
  chair and a wall, everything silent, five patterns of six tiers, and
  tiers 1–4 of every pattern must survive the silent + chair + wall
  filter.
- Two things we already know and would value your view on, beyond the
  numbered questions: reporting **sore shoulders** currently removes all
  push, all pull, and everything in core above tier 2 (only squat and
  hinge survive in full); reporting **sore hips** removes both leg
  patterns entirely. If the tags are right, that is the correct clinical
  outcome — but if some of those movements are actually fine on a
  sore-shoulder or sore-hip day, loosening their tags would keep more of
  the program available. Tell us which, if any.
- If anything in the library is unsafe for this population as a whole —
  not just a subgroup — say so plainly and first. That single sentence
  is worth more than the rest of the review.

---

## 5. Addendum, 8 September 2026: in-set corrections

Since the packet above, every movement carries a second cue list,
`inSetCues`: one or two short lines the app speaks and shows DURING a
set (one per set, rotating), on top of the setup cues read at the
intro. They name the movement's most common fault as the thing to do
instead ("If your back rounds, hinge less far"), and where range is the
lever they ask for less range rather than pushing through.

**9. In-set corrections.** Please read them with the same eye as the
setup cues, and two things in particular. First, they are the lines
most likely to touch pelvic floor and diastasis territory — bracing,
breath holding, rib flare on bridges and hip thrusts — for the users
who never tell the app they are within a year of giving birth; flag any
line that should be softened or cut for that reason. Second, a
correction arrives mid-effort, unsupervised, without a demonstration:
flag any that could be misread into a worse position than the fault it
corrects. Same format as before: verdict per movement id, and what you
would say instead.
