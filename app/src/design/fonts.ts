// The bundled typeface (ADR-0017). Loaded once at the root before the
// first render; the splash stays up until then. Nothing is fetched at
// runtime — the files ship in the binary like every other asset.

import { useFonts } from "expo-font";

import { fontFamily } from "./tokens";

/* eslint-disable @typescript-eslint/no-require-imports */
export const fontAssets = {
  [fontFamily.regular]: require("../../assets/fonts/manrope/Manrope_400Regular.ttf"),
  [fontFamily.medium]: require("../../assets/fonts/manrope/Manrope_500Medium.ttf"),
  [fontFamily.semibold]: require("../../assets/fonts/manrope/Manrope_600SemiBold.ttf"),
  [fontFamily.bold]: require("../../assets/fonts/manrope/Manrope_700Bold.ttf"),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * True once the typeface is usable — or once loading failed, because a
 * missing font must never keep the app on the splash (the system face
 * is the fallback, not a blank screen).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  return loaded || error !== null;
}
