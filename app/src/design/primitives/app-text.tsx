import { StyleSheet, Text, type TextProps } from "react-native";

import { useTheme } from "../theme";
import { fontFamily, fontWeight, typeScale } from "../tokens";

type Variant =
  | "caption"
  | "body"
  | "bodySoft"
  | "bodyLarge"
  | "title"
  | "display"
  | "numeral";

interface AppTextProps extends TextProps {
  variant?: Variant;
  /** Token-sourced override (e.g. onAccent on sage). Never a raw hex. */
  color?: string;
}

/**
 * The only Text in the app. Big, warm, unhurried type; body is 17pt
 * minimum and Dynamic Type stays on (no maxFontSizeMultiplier games).
 */
export function AppText({ variant = "body", color, style, ...rest }: AppTextProps) {
  const colors = useTheme();
  const defaultColor =
    variant === "bodySoft" || variant === "caption" ? colors.inkSoft : colors.ink;
  return (
    <Text
      {...rest}
      style={[styles[variant], { color: color ?? defaultColor }, style]}
    />
  );
}

const styles = StyleSheet.create({
  caption: {
    fontFamily: fontFamily.text,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontFamily: fontFamily.text,
    fontSize: typeScale.body,
    fontWeight: fontWeight.regular,
    lineHeight: typeScale.body * 1.4,
  },
  bodySoft: {
    fontFamily: fontFamily.text,
    fontSize: typeScale.body,
    fontWeight: fontWeight.regular,
    lineHeight: typeScale.body * 1.4,
  },
  bodyLarge: {
    fontFamily: fontFamily.text,
    fontSize: typeScale.bodyLarge,
    fontWeight: fontWeight.medium,
    lineHeight: typeScale.bodyLarge * 1.35,
  },
  title: {
    fontFamily: fontFamily.text,
    fontSize: typeScale.title,
    fontWeight: fontWeight.semibold,
    lineHeight: typeScale.title * 1.25,
  },
  display: {
    fontFamily: fontFamily.text,
    fontSize: typeScale.display,
    fontWeight: fontWeight.semibold,
    lineHeight: typeScale.display * 1.15,
  },
  numeral: {
    fontFamily: fontFamily.numeral,
    fontSize: typeScale.numeral,
    fontWeight: fontWeight.semibold,
    fontVariant: ["tabular-nums"],
  },
});
