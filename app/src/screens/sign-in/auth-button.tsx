import { Pressable, StyleSheet } from "react-native";

import { AppText } from "../../design/primitives/app-text";
import { useTheme } from "../../design/theme";
import {
  hairline,
  minTouchTarget,
  radius,
  spacing,
} from "../../design/tokens";

// The three ways to continue, with EQUAL visual dignity (ADR-0011 §1):
// same shape, same height, same weight. Tones follow platform affordance
// conventions without leaving the token palette — Apple's mandated
// dark-filled look uses the ink token, Google's light look uses surface
// with a hairline, and guest carries the brand's own sage. Guest is
// never a grey afterthought link.

type Tone = "apple" | "google" | "guest";

interface AuthButtonProps {
  tone: Tone;
  label: string;
  onPress: () => void;
  testID?: string;
  /**
   * Audit S9: while a sign-in is in flight, the tapped option holds a
   * visible pending state and its siblings quiet down — instant with the
   * dev port, honest the day a real provider adds latency. Taps stay
   * guarded upstream; this is the visual half of that constraint.
   */
  pending?: boolean;
  quieted?: boolean;
}

export function AuthButton({
  tone,
  label,
  onPress,
  testID,
  pending = false,
  quieted = false,
}: AuthButtonProps) {
  const colors = useTheme();
  const fill =
    tone === "apple"
      ? colors.ink
      : tone === "google"
        ? colors.surface
        : colors.accent;
  // Guest reads theme onAccent: the dark theme's light sage needs dark
  // ink, not bone (contrast — see the token's comment).
  const text =
    tone === "apple"
      ? colors.bg
      : tone === "google"
        ? colors.ink
        : colors.onAccent;
  const border = tone === "google" ? colors.line : fill;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: pending, disabled: quieted }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: fill,
          borderColor: border,
          opacity: pending ? 0.72 : quieted ? 0.45 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <AppText variant="bodyLarge" color={text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouchTarget + spacing.md,
    borderRadius: radius.pill,
    borderWidth: hairline,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
});
