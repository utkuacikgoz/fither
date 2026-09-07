import { StyleSheet, Text, type TextProps } from "react-native";

import { useTheme } from "../theme";
import {
  countFloorMaxFontScale,
  fontFamily,
  numeralMaxFontScale,
  tracking,
  typeScale,
} from "../tokens";

type Variant =
  | "caption"
  | "body"
  | "bodySoft"
  | "bodyLarge"
  | "title"
  | "display"
  | "numeral"
  | "count"
  | "countFloor";

interface AppTextProps extends TextProps {
  variant?: Variant;
  /** Token-sourced override (e.g. onAccent on sage). Never a raw hex. */
  color?: string;
}

/**
 * The only Text in the app. Big, warm, unhurried type; body is 17pt
 * minimum and Dynamic Type stays on. One deliberate exception: the
 * numeral variant caps its scaling (numeralMaxFontScale — see the
 * token's sizing math) so a 3-digit count stays on-screen at the
 * largest accessibility sizes; countFloor, the work phase's number read
 * from the floor, caps tighter still (countFloorMaxFontScale). Body,
 * titles and captions scale freely.
 */
export function AppText({ variant = "body", color, style, ...rest }: AppTextProps) {
  const colors = useTheme();
  const defaultColor =
    variant === "bodySoft" || variant === "caption" ? colors.inkSoft : colors.ink;
  return (
    <Text
      {...rest}
      {...(variant === "numeral" || variant === "count"
        ? { maxFontSizeMultiplier: numeralMaxFontScale }
        : variant === "countFloor"
          ? { maxFontSizeMultiplier: countFloorMaxFontScale }
          : null)}
      style={[styles[variant], { color: color ?? defaultColor }, style]}
    />
  );
}

const styles = StyleSheet.create({
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.caption,
    letterSpacing: tracking.caption,
    lineHeight: typeScale.caption * 1.4,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.body,
    lineHeight: typeScale.body * 1.45,
  },
  bodySoft: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.body,
    lineHeight: typeScale.body * 1.45,
  },
  bodyLarge: {
    fontFamily: fontFamily.semibold,
    fontSize: typeScale.bodyLarge,
    lineHeight: typeScale.bodyLarge * 1.3,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.title,
    letterSpacing: tracking.title,
    lineHeight: typeScale.title * 1.2,
  },
  display: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.display,
    letterSpacing: tracking.display,
    lineHeight: typeScale.display * 1.1,
  },
  numeral: {
    fontFamily: fontFamily.semibold,
    fontSize: typeScale.numeral,
    letterSpacing: tracking.display,
    lineHeight: typeScale.numeral * 1.05,
    fontVariant: ["tabular-nums"],
  },
  count: {
    fontFamily: fontFamily.semibold,
    fontSize: typeScale.count,
    letterSpacing: tracking.display * 2,
    lineHeight: typeScale.count * 1.05,
    fontVariant: ["tabular-nums"],
  },
  countFloor: {
    fontFamily: fontFamily.semibold,
    fontSize: typeScale.countFloor,
    letterSpacing: tracking.countFloor,
    lineHeight: typeScale.countFloor,
    fontVariant: ["tabular-nums"],
  },
});
