import { Stack, useRouter } from "expo-router";

import { useTheme } from "../src/design/theme";
import { pushedHeaderOptions } from "../src/lib/pushed-header";
import { RouteGuard } from "../src/lib/route-guard";
import { SignInScreen } from "../src/screens/sign-in/sign-in-screen";

// Sign in with Apple, pushed over the tabs from Settings → Account
// (owner brief 2026-09-07: guest by default, so sign-in is never a
// launch screen). Wears the shared transparent back header (ADR-0017);
// she is already a guest here, so the screen offers the provider only
// and a landed identity simply goes back to Settings. Always a valid
// destination — the guard only waits for hydration so a cold open
// decides nothing against unhydrated identity state.
export default function SignIn() {
  const router = useRouter();
  const colors = useTheme();
  return (
    <>
      <Stack.Screen options={pushedHeaderOptions(colors)} />
      <RouteGuard requires="hydratedOnly">
        <SignInScreen fromSettings onDone={() => router.back()} />
      </RouteGuard>
    </>
  );
}
