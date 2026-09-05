import { darkColors, lightColors, type ColorTheme } from "../tokens";

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

  it("secondary text on the page passes AA", () => {
    expect(contrast(c.inkSoft, c.bg)).toBeGreaterThanOrEqual(4.5);
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
});
