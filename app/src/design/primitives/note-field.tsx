import { StyleSheet, TextInput, View } from "react-native";

import { useTheme } from "../theme";
import {
  fontFamily,
  fontWeight,
  hairline,
  minTouchTarget,
  radius,
  spacing,
  typeScale,
} from "../tokens";
import { AppText } from "./app-text";

interface NoteFieldProps {
  /** The invitation line, e.g. "Want to say what happened?" */
  prompt: string;
  /** The privacy fact — true and load-bearing: the note never leaves the phone. */
  privacyNote: string;
  value: string;
  onChangeText: (text: string) => void;
  testID?: string;
}

/**
 * A quiet, optional multiline note. Purely local by design: callers may
 * persist it to the on-device care-note store only — nothing about this
 * field touches the network, analytics, or any engine input.
 */
export function NoteField({
  prompt,
  privacyNote,
  value,
  onChangeText,
  testID,
}: NoteFieldProps) {
  const colors = useTheme();
  return (
    <View style={styles.container}>
      <AppText variant="body">{prompt}</AppText>
      <AppText variant="caption">{privacyNote}</AppText>
      <TextInput
        testID={testID}
        multiline
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={prompt}
        style={[
          styles.input,
          {
            borderColor: colors.line,
            backgroundColor: colors.surface,
            color: colors.ink,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  input: {
    minHeight: minTouchTarget * 2,
    borderWidth: hairline,
    borderRadius: radius.card,
    padding: spacing.md,
    fontFamily: fontFamily.text,
    fontSize: typeScale.body,
    fontWeight: fontWeight.regular,
    textAlignVertical: "top",
  },
});
