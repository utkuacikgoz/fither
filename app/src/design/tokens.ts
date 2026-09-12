// Design tokens — the only place visual values live. Values are law from
// .claude/skills/fither-code/references/design-system.md. Components consume
// these tokens exclusively; a raw hex or ad-hoc font size in a screen is a bug.

export interface ColorTheme {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentSoft: string;
  danger: string;
  line: string;
  /**
   * The empty segment of a progress form (a ladder rail, the session
   * line's track). Chosen by arithmetic, not by eye: filled vs empty
   * ≥ 3:1 in both themes, and the rail merely visible against the page
   * (≥ 1.5:1). The contrast test pins it.
   */
  rail: string;
  /**
   * Text on an accent fill. Theme-aware because the accents invert in
   * brightness: white on the deep green of the light theme, near-black
   * on the bright green of the dark theme — both ≥ 4.5:1. Always read
   * this from the theme, never from a static constant.
   */
  onAccent: string;
}

// ADR-0017: green, black and white. One green per theme, near-black or
// white ground, grey only for secondary text and hairlines. No gold, no
// bone, no wash that is not the green at low emphasis. Dark is the face
// of the product; light is kept for the day the owner wants a toggle.

export const darkColors: ColorTheme = {
  bg: "#0B0F0C", // near-black with a breath of green
  surface: "#151B17", // tiles and cards
  ink: "#F5F7F5", // white text
  inkSoft: "#A3AFA7", // secondary text — 8.5:1 on bg
  accent: "#3DBE7A", // THE green — buttons, fills, active states
  accentSoft: "#16291F", // the green at low emphasis: selected rows, figure grounds
  danger: "#E0674F", // errors only
  line: "#26302A", // hairlines
  rail: "#3A463E", // empty progress segment — 4.1:1 vs accent, 1.8:1 vs surface
  onAccent: "#0B0F0C", // near-black on bright green — 8.1:1
};

export const lightColors: ColorTheme = {
  bg: "#FFFFFF",
  surface: "#F3F6F3",
  ink: "#0F1511",
  inkSoft: "#5C6862", // 5.8:1 on white
  accent: "#1F5C3F", // deep green — 7.9:1 under white text
  accentSoft: "#E4F0E8",
  danger: "#B4432F",
  line: "#E2E7E3",
  rail: "#9DAAA1", // 3.3:1 vs accent, 2.4:1 vs white
  onAccent: "#FFFFFF",
};

// The unlock moment: the one full-bleed screen. Black ground, white
// skill name, the green as a single drawn rule. Theme-fixed, so it looks
// the same wherever it lands (the share card too).
export const unlockBg = "#0B0F0C";
export const onUnlock = "#F5F7F5";
export const unlockAccent = "#3DBE7A";

// Spacing: 4pt grid. Screens breathe with 24pt side margins, 32pt+ sections.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24, // screen side margins
  xl: 32, // between sections
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  card: 16,
  sheet: 24,
  button: 16,
  pill: 999,
} as const;

// Type scale. Body 17pt minimum; timers and counts huge. Confident
// headlines (ADR-0017): the display and title sizes are what make a
// screen read as designed rather than typed.
export const typeScale = {
  caption: 13, // eyebrows and hairline metadata
  body: 17,
  bodyLarge: 20,
  title: 30,
  display: 44,
  numeral: 64, // points, rest counts
  count: 96, // the live rep count / hold timer in the work phase (ADR-0017)
  /**
   * The work phase's count at floor distance (owner-approved
   * 2026-09-07, mockup player-work-floor): the phone lies on the floor
   * a body-length away, so the one number she reads mid-set is set far
   * larger than any other numeral.
   */
  countFloor: 132,
} as const;

/** Letter-spacing per role: tight at display sizes, open on eyebrows. */
export const tracking = {
  display: -1,
  title: -0.4,
  caption: 0.4,
  /** The floor-distance count: tighter than display, so two digits read as one number. */
  countFloor: -3,
} as const;

/**
 * Dynamic Type cap for the numeral variant ONLY — body and titles scale
 * freely. The numeral starts at 64pt (already an accessibility size); at
 * 2× it renders 128pt, and three tabular digits (~0.6em each) then span
 * ≈230pt — inside the 272pt content width of the narrowest supported
 * iPhone (320pt minus 24pt margins). iOS's largest AX multiplier (~3.1×)
 * would push a 3-digit count to ≈356pt and off-screen.
 */
export const numeralMaxFontScale = 2;

/**
 * Dynamic Type cap for the floor-distance count ONLY. It starts at 132pt,
 * already the largest thing in the product; at this cap two tabular
 * digits (~0.6em each) span ≈253pt, inside the same 272pt content width
 * the numeral cap is sized to. The general 2× cap would push them to
 * ≈317pt and off the narrowest supported iPhone.
 */
export const countFloorMaxFontScale = 1.6;

// Manrope (SIL OFL, bundled under assets/fonts/manrope — ADR-0017), one
// family for text and numerals. iOS registers each weight file under its
// own name, so weight is chosen by family here, never by fontWeight.
export const fontFamily = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
} as const;

export const hairline = 1;
export const minTouchTarget = 44;

/** Letter-spacing for small-caps brand moments (wordmark on cards). */
export const trackingWide = 2;

// Decorative glyphs — visual affordances, not copy. Anything a screen
// reader must convey (e.g. selection) is exposed via accessibility
// state, never via these characters.
export const glyph = {
  check: "✓",
} as const;

// Motion is breath, not fireworks: 250–350ms ease-out. Nothing bounces.
// ADR-0013 makes motion the default rather than the exception: entrances
// carry a small rise and lists stagger, all inside the same 250–350ms
// ease-out envelope. Reduce Motion renders the final state instead.
export const motion = {
  fadeMs: 300,
  /**
   * How long a toast stays before it fades itself out. Long enough to
   * read four words mid-session without looking away from the floor,
   * short enough that it is gone before the next set begins.
   */
  toastMs: 2200,
  /** Gap between staggered siblings (cards entering a screen). */
  staggerMs: 70,
  /** How far an entering element rises, in points. Small on purpose. */
  riseDistance: 12,
  /**
   * Gap between the steps of a progress fill drawing in (the tier
   * ladders). Half the card stagger: six steps still complete inside one
   * breath rather than crawling across the screen.
   */
  fillStaggerMs: 35,
} as const;
