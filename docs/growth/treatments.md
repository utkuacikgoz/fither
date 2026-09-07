# Three marketing treatments

Wave 6 (docs/implementation-checklist.md). Three short pieces, each one
real constraint, the adaptation the app shows for it, and an honest
finish. Each treatment names the exact in-app scenario it promises, so
the person who taps through sees on her phone what she saw in the film.

Every word here passes `.claude/skills/fither-voice/SKILL.md`. Every
on-screen app string is the app's own string, named by its key in
`app/src/copy/strings.ts`, captured from a device build, never typeset.

## Rules for all three

- **The phone is real.** Every app screen in a treatment is a screen
  recording from a TestFlight build with a real profile. If the engine
  does not emit a line for that profile, the shot is not faked; the
  profile is changed until the line is real, or the line is cut.
- **The constraint is the subject.** The camera stays on the clock, the
  door, the carpet, the chair, the phone, the movement. It never frames a
  body as the point of the shot. No mirror shots, no comparison shots of
  bodies, no numbers about anyone.
- **Nothing is promised except the format.** 10, 20 or 30 minutes, no
  equipment, adapted daily. No claims about what weeks of training do to
  anyone. No testimonials, real or written. Nobody on camera says what
  the app did for them.
- **The finish is the app's finish.** `finish.headline` "Session
  complete" over `finish.note` "That counts." Nothing added.
- **Ten minutes is complete.** No treatment calls a session quick, short,
  mini, or a version of a longer one.
- **The people asleep are unnamed.** In "Keeping the house quiet" the
  sleeper is a door and a night light. No newborns, no claims about new
  mothers; postpartum is not a v1 audience (fither-domain).
- **In-session audio** is the app's own cue audio from `data/movements.json`
  (movement-author), not ad voice-over. The narrator speaks only over
  the constraint and the preview.
- **No dashes** in any on-screen text or narration (voice rule 8).
- **Adaptation lines are conditional.** `preview.facts.quiet` ("Every
  movement stays quiet.") is emitted only when quiet mode actually
  removed a movement from the pool; `preview.facts.lowEnergy` only when
  low energy cut a block to two sets. Energy "Okay" emits no line. The
  equipment line (`floorOnly` or `withChair`) is always read back. The
  movement count in `preview.facts.minutes` is whatever the engine builds
  for that profile; the scripts below state the expected count and the
  shoot uses the one on the screen.
- **Scenario ids** are low-cardinality allowlisted identifiers for
  `scenario_entry` (ADR-0024 §3). Proposed here, added to
  `app/src/analytics/events.ts` by the ui-engineer, never by this doc:
  `between_meetings`, `away_from_home`, `quiet_house`. The link path is
  `/s/<id>`; no query string. On the phone the scenario is counted and
  the ordinary first-use flow runs. DECIDE (owner): whether a scenario
  preselects the equipment option the film showed (chair or floor). This
  doc assumes it does not; she answers her own questions.

---

## Treatment 1: Between meetings

**Constraint:** ten minutes between two meetings, in a meeting room with
a fixed chair. **Adaptation shown:** the count, and the chair read back.

### In-app scenario

| daily prompt | answer (strings.ts key) |
|---|---|
| How much time do you have? | `prompt.time.minutes[10]` "10 minutes" |
| How is your energy? | `prompt.energy.options.okay` "Okay" |
| Do you need to be quiet right now? | `prompt.quiet.no` "Sound is fine" |
| Anything sore or off-limits today? | `prompt.soreness.allGood` "All good" |

- **Equipment:** `onboarding.equipment.options.chair` "A sturdy chair
  too". The chair in the film is a meeting-room chair with four legs. Not
  a desk chair on wheels; the library's chair movements need a chair that
  does not move.
- **Preview states (engine facts, `preview.facts`):**
  - `minutes`: "10 minutes, 3 movements." Expected at tier 1 with three
    sets, 45 second rests and a 20 second transition per block inside a
    600 second budget. If the profile builds 2 or 4, the film shows that.
  - `withChair`: "You, the floor and a chair."
  - No energy line (Okay), no quiet line (sound is fine), no soreness
    line (All good).
- **Finish:** "Session complete" / "That counts."
- **Share context** (wave 3 `share_start.context`): `meetings`.
- **Scenario id:** `between_meetings`.

### Script, 27 seconds

| time | shot | on-screen text | narration |
|---|---|---|---|
| 0 to 3 | Laptop calendar, close. A block ends 11:50, the next begins 12:00. She closes the lid. | Ten minutes before the next one. | Ten minutes between meetings. |
| 3 to 7 | Phone in hand. The four prompts, four taps: 10 minutes, Okay, Sound is fine, All good. Real speed. | none; the prompt's own labels are the text | Four answers. |
| 7 to 11 | Preview screen, held. `preview.headline` "Your session is ready". Under `factsTitle` "Why it fits": "10 minutes, 3 movements." then "You, the floor and a chair." | none | A chair and the floor. That's a workout. |
| 11 to 15 | Movement one, using the chair. Low angle: chair legs, her hands, the phone propped against the laptop. App cue audio only. | none | none |
| 15 to 19 | Movement two, on the carpet between table and wall. Same framing. App cue audio. | none | none |
| 19 to 22 | Movement three. Wide: the meeting room, one person, one chair. App cue audio. | none | none |
| 22 to 25 | Finish screen, held. "Session complete" / "That counts." She opens the laptop. The clock reads 12:00. | none | Session complete. That counts. |
| 25 to 27 | End card: FITHER wordmark, `home.today.line`. | A workout that fits today. | none |

### Recipient page (`/s/between_meetings`)

- Headline: **Ten minutes between meetings.**
- One line: A chair and the floor. Ten minutes, complete.
- Button: **Try 10 minutes**

---

## Treatment 2: Away from home

**Constraint:** a hotel room she has never seen, nothing in it but the
floor, the bed and a wall. **Adaptation shown:** floor only, read back.

### In-app scenario

| daily prompt | answer (strings.ts key) |
|---|---|
| How much time do you have? | `prompt.time.minutes[20]` "20 minutes" |
| How is your energy? | `prompt.energy.options.okay` "Okay" |
| Do you need to be quiet right now? | `prompt.quiet.no` "Sound is fine" |
| Anything sore or off-limits today? | `prompt.soreness.allGood` "All good" |

- **Equipment:** `onboarding.equipment.options.floorOnly` "Just me and
  the floor". This is the wave 4 Hotel preset once it ships; until then
  it is the floor-only answer. The wall is always available to the engine
  (engine-spec: "wall is always considered available"), so a wall
  movement is honest and expected in the film.
- **Preview states (engine facts, `preview.facts`):**
  - `minutes`: "20 minutes, N movements." N is what the engine builds
    for the profile; a 20 minute session covers every pattern
    (`generate.test.ts`), so expect 5 or more.
  - `floorOnly`: "Just you and the floor."
  - No energy line, no quiet line, no soreness line.
  - If the shoot chooses "Keep it quiet" for realism, the preview may
    add "Every movement stays quiet." and the film must show it. This
    script does not.
- **Finish:** "Session complete" / "That counts."
- **Share context:** `hotel`.
- **Scenario id:** `away_from_home`.

### Script, 28 seconds

| time | shot | on-screen text | narration |
|---|---|---|---|
| 0 to 3 | Keycard in the door. The door opens on a room: bed, desk, a strip of carpet, a wall. Suitcase set down. | A room you've never seen. | A room you've never seen. |
| 3 to 7 | Phone. Four taps: 20 minutes, Okay, Sound is fine, All good. | none | Twenty minutes, before dinner. |
| 7 to 11 | Preview screen, held. "Your session is ready". "20 minutes, N movements." then "Just you and the floor." | none | Just you and the floor. |
| 11 to 15 | Movement one at the wall. Framed on hands and wall, the phone on the desk. App cue audio. | none | none |
| 15 to 19 | Movement two on the carpet between bed and desk. The bed edge in frame to show how little room there is. App cue audio. | none | none |
| 19 to 23 | Movement three, then a rest countdown on the phone screen, real seconds. App cue audio. | none | none |
| 23 to 26 | Finish screen, held. "Session complete" / "That counts." Curtains, the city, evening. | none | Session complete. That counts. |
| 26 to 28 | End card: FITHER wordmark, `onboarding.welcome.headline`. | Strength that fits your life. | none |

### Recipient page (`/s/away_from_home`)

- Headline: **Just you and the floor.**
- One line: Any room is enough. 10, 20 or 30 minutes, no equipment, built for today.
- Button: **Try 20 minutes**

---

## Treatment 3: Keeping the house quiet

**Constraint:** someone is asleep behind a door that does not quite
close, and the floor creaks. **Adaptation shown:** every movement stays
quiet.

### In-app scenario

| daily prompt | answer (strings.ts key) |
|---|---|
| How much time do you have? | `prompt.time.minutes[20]` "20 minutes" |
| How is your energy? | `prompt.energy.options.okay` "Okay" |
| Do you need to be quiet right now? | `prompt.quiet.yes` "Keep it quiet" |
| Anything sore or off-limits today? | `prompt.soreness.allGood` "All good" |

- **Equipment:** `onboarding.equipment.options.floorOnly` "Just me and
  the floor". Home preset once wave 4 ships; the film shows a living
  room rug, no chair, so the equipment line stays single.
- **Preview states (engine facts, `preview.facts`):**
  - `minutes`: "20 minutes, N movements."
  - `quiet`: "Every movement stays quiet." This is the line the treatment
    is built on and it is conditional: the engine emits it only when
    quiet mode removed at least one movement the profile would otherwise
    have been offered. Before the shoot, run the prompt on the device
    with the chosen profile and confirm the line appears. If it does not
    at tier 1, use a profile at a tier where it does. Never typeset it.
  - `floorOnly`: "Just you and the floor."
  - No energy line, no soreness line.
- **Coaching audio:** wave 4 separates quiet movements from coaching
  audio. In the film she wears one earphone; the app's cue audio is
  heard only as a faint leak, and the room stays as quiet as it is. If wave
  4 has not shipped, she uses the phone on silent with captions and the
  narration says nothing about audio.
- **Finish:** "Session complete" / "That counts."
- **Share context:** `home`.
- **Scenario id:** `quiet_house`.

### Script, 26 seconds

| time | shot | on-screen text | narration |
|---|---|---|---|
| 0 to 4 | Night. A hallway. A door ajar, a night light inside. She pulls it almost closed and stops when it creaks. No sound but the room. | Someone's asleep next door. | none |
| 4 to 8 | Living room, one lamp. Phone. Four taps: 20 minutes, Okay, Keep it quiet, All good. | none | Twenty minutes. Quiet. |
| 8 to 12 | Preview screen, held. "Your session is ready". "20 minutes, N movements." then "Every movement stays quiet." then "Just you and the floor." | none | Every movement stays quiet. |
| 12 to 16 | Movement one on the rug, socks, slow. Framed at floor level: the rug, her hands, the lamp. No sound but the room and a faint cue from the earphone. | none | none |
| 16 to 20 | Movement two. The hallway door in the background, still ajar, still dark. No sound but the room. | none | none |
| 20 to 23 | Movement three, then the rest countdown on the phone, screen dimmed. No sound but the room. | none | none |
| 23 to 25 | Finish screen, held. "Session complete" / "That counts." She looks toward the door. Nothing stirs. | none | Session complete. That counts. |
| 25 to 26 | End card: FITHER wordmark, `home.today.line`. | A workout that fits today. | none |

### Recipient page (`/s/quiet_house`)

- Headline: **Every movement stays quiet.**
- One line: Someone's asleep. Answer one question and the session is built for that.
- Button: **Try a quiet session**

---

## What the three have in common

Each one is a constraint, a preview that names the constraint back to
her in the engine's words, three movements filmed on the movement, and
the same two lines at the end. Nobody is a different person at the end
of the film, nothing is counted except minutes and movements, and the
person on screen is
having an ordinary evening or an ordinary Tuesday. That is the promise:
a workout that fits today, and it counts.

## Measurement

Per docs/measurement.md, "Recipient entry": `scenario_entry` by scenario
on the phone, page views by path on the web, neither joined to a person
or to a piece of media. Cut the standard funnel (first_use_entry,
onboarding_complete, session_preview, workout_start, workout_complete)
by the first `scenario_entry.scenario` per id. Three treatments give
three cohorts to compare against each other and against `none`; no
treatment is declared to work from a single week's numbers, and the
three-day close applies before any number is read.
