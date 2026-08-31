import { useRouter } from "expo-router";

import { SessionPlayerScreen } from "../src/screens/session-player/session-player-screen";

export default function SessionRoute() {
  const router = useRouter();
  return <SessionPlayerScreen onFinished={() => router.replace("/finish")} />;
}
