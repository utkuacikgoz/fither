# FITHER design system — premium, calm, clean

The design bar: the app should feel like a beautifully set table, not a
dashboard. Think Headspace's calm, Opal's restraint, a good hardcover's
typography. She opens it mid-chaos — the app is the quietest thing in her
day. Every UI session follows this file; tokens live in
`app/src/design/tokens.ts` and components consume ONLY tokens, never raw
values. One hardcoded hex in a screen is a bug.

## Principles

1. **Calm beats clever — but calm is not bare (ADR-0013).** One focal
   point per screen; if two calls to action compete, cut one. Whitespace
   must be COMPOSED, not left over: a screen with room to breathe and a
   screen that looks unfinished are different things, and the difference
   is whether what remains is crafted. Every screen carries at least one
   considered visual element — an illustration, a card, a rendered
   progress form. A wall of text is a bug, not restraint.
2. **The session is sacred.** During a workout the screen shows: the
   movement, the count/timer, the cue. Nothing else. No chrome, no tab
   bar, no points ticking up mid-set.
3. **Big, warm, unhurried type.** Body 17pt minimum. Timers and counts
   are huge (48–72pt). One type hierarchy per screen: an eyebrow
   caption, one title, body — never two competing titles or two
   competing captions in one content group; numerals live on their own
   scale. Type alone is never the whole design: if a screen's only
   content is set text, it is not finished (ADR-0013).
4. **Motion is breath — and it breathes everywhere (ADR-0013).**
   250–350ms ease-out fades and slides on screen transitions, list
   entrances, number changes and progress fills. Nothing bounces,
   nothing springs, nothing spins. The skill-unlock moment still gets
   the most generous animation in the product — it is the emotional
   payoff — but it is no longer the ONLY one; the previous rule produced
   a static app. Reduce Motion is honoured absolutely: every animated
   element renders in its final state, never a half-played frame.
5. **Touch targets 44pt+, everything reachable one-handed** at the bottom
   of the screen during a session — her hands may be shaking.

## Every movement has a face

No exercise screen shows a movement by name alone. A line figure drawn
from that movement's pose data accompanies it in the preview list, the
block intro and the work phase. Figures are generated (see
`scripts/generate-movement-figures.py`) so they regenerate rather than
drift, and are placeholder art with real intent: Brief 6's commissioned
animation replaces the rendering, not the pose data.

## Norman's principles — every screen answers all six

The owner reviews UX against Don Norman's principles; treat a violation
like a failing test. Before shipping any screen, walk it:

1. **Affordance** — can she tell what is tappable by looking? Buttons
   look pressable (fill or pill), rows that navigate look like rows that
   navigate. Nothing interactive disguised as text; nothing decorative
   dressed as a control.
2. **Signifiers** — does the screen point to the one next action?
   Selected states are unmistakable (check glyph, fill), the primary
   action names its outcome ("Start", never "OK"), and anything
   non-obvious carries its own one-line clue in place.
3. **Constraints** — is the wrong path hard? Disable-don't-hide is wrong
   here: prefer not rendering what can't apply. Impossible combinations
   are prevented upstream (the engine's honest adjust-answers state, the
   delayed skip), not error-messaged after.
4. **Mapping** — do controls sit where their effect happens? The thing a
   button changes is adjacent to the button; counts appear next to what
   was counted; per-option state lives on the option, not in a summary
   elsewhere.
5. **Feedback** — does every tap answer within 100ms? Selection renders
   immediately, async work shows its honest state (saving / retry), and
   completed work is acknowledged where she is looking. Silence after a
   tap is a bug.
6. **Conceptual model** — after one use, could she explain the screen to
   a friend? One decision per screen keeps the model small. If a flow
   needs explaining, restructure the flow instead of adding copy.

## Tokens (light theme; the app is light-first, dark supported)

```ts
// color
bg:        "#FAF7F2"  // warm bone — never pure white
surface:   "#FFFFFF"  // cards, sparingly
ink:       "#1F1D1A"  // near-black warm text
inkSoft:   "#6E675E"  // secondary text
accent:    "#5C6F5E"  // deep sage — buttons, active states
accentSoft:"#E7ECE7"  // sage wash — selected chips, progress track fill
gold:      "#B98A2F"  // skill unlocks ONLY; scarcity is what makes it feel earned
danger:    "#A65746"  // muted terracotta, errors only
line:      "#E8E2D8"  // hairline borders

// dark theme
bgDark:      "#171614"
surfaceDark: "#211F1C"
inkDark:     "#F2EEE8"
inkSoftDark: "#A29A8E"
accentDark:  "#8FA491"
lineDark:    "#33302B"
```

- **No pink, no neon, no gradients on chrome.** The sage/gold pairing is
  the identity; if it starts looking like a generic fitness app, stop.
- Spacing: 4pt grid; screens breathe with 24pt side margins, 32pt+
  between sections. Radius: 16 for cards, 24 for sheets, buttons pill or
  16. Shadows barely-there (opacity ≤ 0.06) or none — prefer hairlines.
- Type: system SF Pro (Text/Display); SF Rounded for big numerals
  (timers, counts, points) — rounded numbers feel kinder. No custom font
  until the Brief 6 identity lands; these tokens make swapping cheap.

## Feel of the key moments

- **Daily prompt**: one decision per screen (ADR-0006) — four full-width
  tappable rows per question, auto-advance on tap, no Next buttons.
  Under 15 seconds, zero typing. Opening line addresses the day, not the
  user's failings. Onboarding follows the same one-decision rule.
- **Session preview**: before starting, one plain-language line explains
  why today's session fits her answers — the engine's adaptation note
  rendered verbatim ("Quiet mode: everything floor-based today"). Then
  the block list, calm, and one Start button. A 10-minute session is
  presented with exactly the same visual dignity as a 30-minute one —
  same layout, same weight, no "short/quick" badges.
- **Session player**: bone background, movement name large, one cue line,
  huge rounded countdown. Progress = a thin line filling along the top.
  Rest screens are the calmest thing in the app — deliberate exhale.
- **Unlock**: bone → deep sage full-screen moment, gold accent, the skill
  name set huge. One button: Continue. This is the only loud screen.
- **Paywall**: reads like an honest letter, not a slot machine. Price
  plainly set, two options, no countdowns, no strikethrough theatrics.

## Accessibility is part of premium

Dynamic Type without breakage, contrast AA minimum on all text (the muted
palette must still pass — check inkSoft on bg), VoiceOver labels on the
player controls, captions/text for anything audio-only.
