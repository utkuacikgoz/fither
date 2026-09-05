import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { getAuth, type AuthProvider } from "../../auth/auth";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { Screen } from "../../design/primitives/screen";
import { Wordmark } from "../../design/primitives/wordmark";
import { spacing } from "../../design/tokens";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useIdentityStore, type SignInResult } from "../../state/identity-store";
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
  // Which option is in flight (audit S9): the tapped button shows its
  // pending state, siblings quiet down, and everything clears on failure
  // so she can retry — guest included, always.
  const [pending, setPending] = useState<"apple" | "google" | "guest" | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  // Which provider buttons exist on this build: a provider without a
  // real adapter is not offered (a button that fakes success would be a
  // review rejection and a lie). Guest is always there. The port answers
  // synchronously, so the first frame is the right frame.
  const [providers] = useState<AuthProvider[]>(() => getAuth().availableProviders());

  const run = async (
    tone: "apple" | "google" | "guest",
    action: () => Promise<SignInResult>,
  ) => {
    if (pending) return;
    setPending(tone);
    setFailed(false);
    const result = await action();
    setPending(null);
    // Dismissing the provider's sheet is her decision, not a failure:
    // the screen simply stays, every option open.
    if (result === "cancelled") return;
    if (result === "failed") {
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
        {providers.includes("apple") && (
          <AuthButton
            testID="sign-in-apple"
            tone="apple"
            label={strings.auth.apple}
            pending={pending === "apple"}
            quieted={pending !== null && pending !== "apple"}
            onPress={() => {
              void run("apple", signInWithApple);
            }}
          />
        )}
        {providers.includes("google") && (
          <AuthButton
            testID="sign-in-google"
            tone="google"
            label={strings.auth.google}
            pending={pending === "google"}
            quieted={pending !== null && pending !== "google"}
            onPress={() => {
              void run("google", signInWithGoogle);
            }}
          />
        )}
        {/* What an account does today — the honest line (ADR-0011 §5),
            mapped to the account options above it. */}
        {providers.length > 0 && (
          <AppText variant="caption" style={styles.note}>
            {strings.auth.accountNote}
          </AppText>
        )}
        <AuthButton
          testID="sign-in-guest"
          tone="guest"
          label={strings.auth.guest}
          pending={pending === "guest"}
          quieted={pending !== null && pending !== "guest"}
          onPress={() => {
            void run("guest", continueAsGuest);
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
