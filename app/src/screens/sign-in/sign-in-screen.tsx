import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { Screen } from "../../design/primitives/screen";
import { Wordmark } from "../../design/primitives/wordmark";
import { spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useIdentityStore } from "../../state/identity-store";
import { AuthButton } from "./auth-button";

// Sign-in (ADR-0011): the one first-run decision — how she continues.
// Three options with equal visual dignity; guest costs Gate 3 exactly one
// tap and everything the product has works identically for her. All three
// go through the identity store and the auth port (dev-only today:
// instant success, no network). Continuing is store-driven — the launch
// surface re-renders onward the moment the identity lands — and `onDone`
// exists for the standalone route. The calm launch moment: the wordmark
// and tagline fade in gently (Reduce Motion honoured); the buttons are
// present and tappable from the first frame.

interface SignInScreenProps {
  /** Called after any successful continue (used by the route wrapper). */
  onDone?: () => void;
}

export function SignInScreen({ onDone }: SignInScreenProps) {
  const signInWithApple = useIdentityStore((s) => s.signInWithApple);
  const signInWithGoogle = useIdentityStore((s) => s.signInWithGoogle);
  const continueAsGuest = useIdentityStore((s) => s.continueAsGuest);

  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (action: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await action();
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    onDone?.();
  };

  return (
    <Screen>
      <View style={styles.brand}>
        <FadeIn reduceMotion={reduceMotion}>
          <Wordmark />
          <AppText variant="bodySoft" style={styles.welcome}>
            {strings.auth.welcome}
          </AppText>
        </FadeIn>
      </View>

      <View style={styles.options}>
        <AuthButton
          testID="sign-in-apple"
          tone="apple"
          label={strings.auth.apple}
          onPress={() => {
            void run(signInWithApple);
          }}
        />
        <AuthButton
          testID="sign-in-google"
          tone="google"
          label={strings.auth.google}
          onPress={() => {
            void run(signInWithGoogle);
          }}
        />
        {/* What an account does today — the honest line (ADR-0011 §5),
            mapped to the two account options above it. */}
        <AppText variant="caption" style={styles.note}>
          {strings.auth.accountNote}
        </AppText>
        <AuthButton
          testID="sign-in-guest"
          tone="guest"
          label={strings.auth.guest}
          onPress={() => {
            void run(continueAsGuest);
          }}
        />
        <AppText variant="caption" style={styles.note}>
          {strings.auth.guestNote}
        </AppText>
        {failed && (
          <AppText
            variant="bodySoft"
            style={styles.error}
            testID="sign-in-error"
          >
            {strings.auth.error}
          </AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    flex: 1,
    justifyContent: "center",
  },
  welcome: {
    marginTop: spacing.md,
    textAlign: "center",
  },
  options: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  note: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  error: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
