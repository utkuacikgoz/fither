import { Pressable, StyleSheet } from "react-native";

import { AppText } from "../../design/primitives/app-text";
import { useTheme } from "../../design/theme";
import {
  hairline,
  minTouchTarget,
  onAccent,
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
}

export function AuthButton({ tone, label, onPress, testID }: AuthButtonProps) {
  const colors = useTheme();
  const fill =
    tone === "apple"
      ? colors.ink
      : tone === "google"
        ? colors.surface
        : colors.accent;
  const text =
    tone === "apple" ? colors.bg : tone === "google" ? colors.ink : onAccent;
  const border = tone === "google" ? colors.line : fill;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: fill,
          borderColor: border,
          opacity: pressed ? 0.88 : 1,
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
