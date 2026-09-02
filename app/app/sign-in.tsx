import { useRouter } from "expo-router";

import { RouteGuard } from "../src/lib/route-guard";
import { SignInScreen } from "../src/screens/sign-in/sign-in-screen";

// Standalone sign-in route. The first-run flow renders SignInScreen
// inline from the launch surface (store-driven, like onboarding and the
// paywall); this route exists for any later navigation to sign-in and
// simply returns to the launch surface once an identity lands. Always a
// valid destination — the guard only waits for hydration so a cold open
// decides nothing against unhydrated identity state.
export default function SignIn() {
  const router = useRouter();
  return (
    <RouteGuard requires="hydratedOnly">
      <SignInScreen onDone={() => router.replace("/")} />
    </RouteGuard>
  );
}
