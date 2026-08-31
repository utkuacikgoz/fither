import { useColorScheme } from "react-native";

import { darkColors, lightColors, type ColorTheme } from "./tokens";

/** Light-first; dark supported. Screens read colors only through this hook. */
export function useTheme(): ColorTheme {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
