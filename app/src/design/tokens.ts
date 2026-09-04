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
  gold: string;
  danger: string;
  line: string;
  /**
   * Text on an accent fill. Theme-aware because the accents invert in
   * brightness: bone on deep sage passes AA in light (5.05:1), but bone
   * on the LIGHT dark-mode sage is 2.49:1 — dark mode pairs the light
   * sage fill with dark ink instead (6.79:1). Always read this from the
   * theme, never from a static constant.
   */
  onAccent: string;
}

export const lightColors: ColorTheme = {
  bg: "#FAF7F2", // warm bone — never pure white
  surface: "#FFFFFF", // cards, sparingly
  ink: "#1F1D1A", // near-black warm text
  inkSoft: "#6E675E", // secondary text
  accent: "#5C6F5E", // deep sage — buttons, active states
  accentSoft: "#E7ECE7", // sage wash — selected chips, progress track fill
  gold: "#B98A2F", // skill unlocks ONLY
  danger: "#A65746", // muted terracotta, errors only
  line: "#E8E2D8", // hairline borders
  onAccent: "#FAF7F2", // bone on deep sage — 5.05:1
};

export const darkColors: ColorTheme = {
  bg: "#171614",
  surface: "#211F1C",
  ink: "#F2EEE8",
  inkSoft: "#A29A8E",
  accent: "#8FA491",
  accentSoft: "#2A2F2A", // sage wash, dark equivalent (derived: accentDark at low emphasis)
  gold: "#B98A2F",
  danger: "#A65746",
  line: "#33302B",
  onAccent: "#171614", // dark ink on light sage — 6.79:1 (bone would be 2.49:1)
};

// The unlock moment: bone → deep sage full screen with gold accent. The
// sage here is the LIGHT accent in both themes (the moment is the same
// everywhere), so its pairings are static: bone text on the sage (5.05:1)
// and, for the inverse button, sage text on a bone fill (same 5.05:1).
export const unlockBg = "#5C6F5E";
export const onUnlock = "#FAF7F2";

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

// Type scale. Body 17pt minimum; timers and counts huge (48–72pt). Never
// more than two type sizes visible at once outside settings.
export const typeScale = {
  caption: 13, // sparing: hairline metadata only
  body: 17,
  bodyLarge: 20,
  title: 28,
  display: 40,
  numeral: 64, // timers, counts, points
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

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
} as const;

// System font until the Brief 6 identity lands. Numerals should render in
// a rounded design when available; tokenised so the swap is one line.
export const fontFamily = {
  text: "System",
  numeral: "System",
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
