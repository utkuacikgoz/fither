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
};

// On-accent text: bone in both themes (sage buttons carry light text).
export const onAccent = "#FAF7F2";
// The unlock moment: bone → deep sage full screen with gold accent.
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

// Decorative glyphs — visual affordances, not copy. Anything a screen
// reader must convey (e.g. selection) is exposed via accessibility
// state, never via these characters.
export const glyph = {
  check: "✓",
} as const;

// Motion is breath, not fireworks: 250–350ms ease-out. Nothing bounces.
export const motion = {
  fadeMs: 300,
} as const;
