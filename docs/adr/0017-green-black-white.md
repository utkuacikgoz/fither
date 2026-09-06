# ADR-0017: Green, black and white — the visual system, second pass

- Status: accepted
- Date: 2026-09-06
- Supersedes: ADR-0004 §tokens (bone/sage/gold palette), ADR-0013 §2 (the
  hero-wash card), the design-system reference's type and tab-bar rules

## Context

The owner walked the first device build and rejected the look: no real
tab bar, no icons, a hub whose hero card and two tiles carried the same
weight, timid headlines, a warm-grey palette that read as neither calm
nor premium, and no visible way back on pushed screens. The reference
apps the owner pointed at share one thing worth taking — a black ground,
white type and a single green — and a great deal not worth taking
(fabricated social proof, body-shape framing, permission prompts on the
first screen; all forbidden here). This ADR takes the palette and the
chrome discipline and leaves the rest.

## Decision

1. **Palette.** Dark is the face of the product. Near-black ground
   `#0B0F0C`, tile `#151B17`, white ink `#F5F7F5`, grey `#A3AFA7` for
   secondary text only, one green `#3DBE7A` for every action, fill and
   active state, and its low-emphasis form `#16291F` for selected rows
   and figure grounds. No gold, no bone, no wash that is not the green.
   The light palette stays in the tokens (white, `#1F5C3F` deep green)
   with the same contrast guarantees, but `useTheme()` returns dark
   regardless of the system setting until the owner wants a toggle.
   `tokens-contrast.test.ts` pins AA for secondary text on page and
   tile, AAA for body text, 3:1 filled-vs-empty on every progress form,
   and the unlock screen's white-on-black and green rule.
2. **Type.** Manrope (SIL OFL), bundled under `app/assets/fonts/manrope`,
   loaded once at the root with the splash held until it is in (a failed
   load releases the splash and falls back to the system face). Weight
   is chosen by family name, never by `fontWeight`. Display 44, title
   30, both bold and tight; body 17; captions medium and open; numerals
   semibold and tabular. No custom font per component — `AppText` is
   still the only Text.
3. **Tab bar.** Three generated line icons in the figures' stroke
   (`scripts/generate-tab-icons.py` → `app/assets/icons/`), tinted by
   the bar exactly like the brand mark, over a short label. Active is
   told by the green and by weight. The corner pills that duplicated
   Progress and Settings on the gated day are gone: one way to a place.
4. **Back.** Every pushed screen wears the same transparent header with
   only the platform's back chevron (`lib/pushed-header.ts`): the daily
   prompt, the preview, the lifetime offer. The session, finish and
   unlock screens keep their single forward door on purpose.
5. **Home hierarchy.** The day is the page, not a card: eyebrow, one
   display headline, one green action set straight on the ground, then
   the two tiles (ladders, next skill) visibly secondary. The `hero`
   card tone is no longer used.
6. **Unlock and brand.** The unlock moment is black, the skill name
   white, the green a single drawn rule; the share card matches. The app
   icon is a green figure on black, the splash the green lockup on
   black. `scripts/generate-brand-assets.py` carries the palette; the
   brand set is regenerated, never retouched.
7. **The empty-pool message** names its real cause (three or more
   avoided areas across today's answer and the Settings list) and where
   to loosen one.

## Consequences

- One rebuild is not required for this ADR (the font and icons are
  assets; expo-font was already in the binary), but the splash colour
  and app icon change on the next native build.
- ADR-0013's primitives, motion rules and Norman checklist stand; only
  their colours, type and the hero wash changed.
- The design-system reference's token table and type section are
  replaced by this ADR's values; its "no custom font until Brief 6" line
  is retired — Brief 6 now inherits Manrope and this palette.
- `brand/` file names still say sage and bone; the values inside are the
  green and the black. Renaming the set is cosmetic and left for the
  identity pass.
