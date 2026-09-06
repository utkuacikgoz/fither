import { darkColors, type ColorTheme } from "./tokens";

/**
 * The product is dark (ADR-0017): black ground, white type, one green,
 * whatever the system setting says. Screens read colors only through
 * this hook, so the day a light toggle is wanted it is one line here.
 */
export function useTheme(): ColorTheme {
  return darkColors;
}
