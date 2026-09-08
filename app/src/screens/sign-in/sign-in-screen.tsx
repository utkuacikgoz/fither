import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { track } from "../../analytics/analytics";
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

// Sign-in (ADR-0011; owner brief 2026-09-07, wave 1): how she continues.
// Guest is the default — the launch surface assigns it on its own and
// never shows this screen — so today the screen is reached from
// Settings → Account as a pushed route (`fromSettings`), where she is
// already a guest and the provider is the only option that changes
// anything. Without the flag it still offers both options with equal
// dignity (the shape ADR-0011 drew), so the screen stays honest wherever
// it is mounted. Every option goes through the identity store and the
// auth port (dev-only today: instant success, no network); `onDone`
// fires after a landed identity. The wordmark and tagline fade in gently
// (Reduce Motion honoured); the buttons are tappable from the first frame.

interface SignInScreenProps {
  /** Called after any successful continue (used by the route wrapper). */
  onDone?: () => void;
  /**
   * Reached from Settings, where she already continues as a guest: the
   * guest option is not offered, because it would change nothing.
   */
  fromSettings?: boolean;
}

export function SignInScreen({ onDone, fromSettings = false }: SignInScreenProps) {
  const signInWithApple = useIdentityStore((s) => s.signInWithApple);
  const continueAsGuest = useIdentityStore((s) => s.continueAsGuest);

  const reduceMotion = useReducedMotion();
  // Which option is in flight (audit S9): the tapped button shows its
  // pending state, siblings quiet down, and everything clears on failure
  // so she can retry — guest included, always.
  const [pending, setPending] = useState<"apple" | "guest" | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  // Which provider buttons exist on this build: a provider without a
  // real adapter is not offered (a button that fakes success would be a
  // review rejection and a lie). Guest is always there. The port answers
  // synchronously, so the first frame is the right frame.
  const [providers] = useState<AuthProvider[]>(() => getAuth().availableProviders());

  // sign_in_view: the frame was shown, once per mount; the result is
  // the identity store's to report.
  useEffect(() => {
    track("sign_in_view", {});
  }, []);

  const run = async (
    tone: "apple" | "guest",
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
          {/* Owner review 2026-09-06: the first line she reads sells the
              product, plainly — headline and one concrete supporting line. */}
          <AppText variant="title" style={styles.welcome} accessibilityRole="header">
            {strings.auth.welcome}
          </AppText>
          <AppText variant="bodySoft" style={styles.welcomeSub}>
            {strings.auth.welcomeSub}
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
        {!fromSettings && (
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
        )}
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
    marginTop: spacing.lg,
    textAlign: "center",
  },
  welcomeSub: {
    marginTop: spacing.sm,
    textAlign: "center",
  },
  options: {
    // Owner review 2026-09-06: no footnotes under buttons — the two
    // choices carry themselves (design-system feedback ledger).
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  error: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
