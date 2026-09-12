import {
  darkColors,
  lightColors,
  onUnlock,
  unlockAccent,
  unlockBg,
  type ColorTheme,
} from "../tokens";

// The design system's contrast claims, as arithmetic (WCAG relative
// luminance). A token change that breaks a claim fails here, not on a
// tester's phone.

function luminance(hex: string): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe.each<[string, ColorTheme]>([
  ["light", lightColors],
  ["dark", darkColors],
])("%s theme", (_name, c) => {
  it("text on the accent fill passes AA", () => {
    expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary text on the page passes AA, on the card too", () => {
    expect(contrast(c.inkSoft, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.inkSoft, c.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("body text on the page and the card passes AAA", () => {
    expect(contrast(c.ink, c.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.ink, c.surface)).toBeGreaterThanOrEqual(7);
  });

  it("a progress form's filled and empty states read 3:1 apart, and the rail is visible on the page", () => {
    expect(contrast(c.rail, c.accent)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.rail, c.bg)).toBeGreaterThanOrEqual(1.5);
    expect(contrast(c.rail, c.surface)).toBeGreaterThanOrEqual(1.5);
  });

  it("the outlined quiet button's hairline is visible on every ground it sits on", () => {
    for (const ground of [c.bg, c.surface, c.accentSoft]) {
      expect(contrast(c.accent, ground)).toBeGreaterThanOrEqual(3);
    }
  });

  it("the armed quiet button's label passes AA on its own fill", () => {
    // The two-tap skip's armed state (quiet-button, armed): accent label
    // on the accentSoft fill. It is text, so 3:1 is not enough.
    expect(contrast(c.accent, c.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the unlock moment (theme-fixed)", () => {
  it("white on black passes AAA and the green rule reads 3:1 on the black", () => {
    expect(contrast(onUnlock, unlockBg)).toBeGreaterThanOrEqual(7);
    expect(contrast(unlockAccent, unlockBg)).toBeGreaterThanOrEqual(3);
    // The inverse button: black text on a white pill.
    expect(contrast(unlockBg, onUnlock)).toBeGreaterThanOrEqual(7);
  });
});
