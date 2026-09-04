// Centralized hydration + validity guard for the public routes (audit
// P0 #8). The app declares a URL scheme, so /preview, /session, /finish
// and /unlock can be cold-opened with nothing behind them: no hydrated
// stores, no generated session, nothing to celebrate. A guarded route
// (1) waits for the same persisted-store hydration set the launch
// surface uses, (2) checks, once, that the state the route needs
// actually exists, and (3) calmly replaces itself with "/" when it
// doesn't — the launch surface owns every recovery path (resume offer,
// onboarding, the gated day). Nothing here renders blank and nothing
// claims success it can't back.
//
// The validity decision is made ONCE, at entry, against store state on
// arrival. It deliberately does not stay reactive: in-flow transitions
// (finishing a session on /session, resetting after /unlock's Continue)
// legitimately pass through states the entry check would reject, and a
// guard that re-evaluates would eject her mid-navigation. Guarding is
// for how a route is entered, not for what happens while she's on it.
//
// App-layer navigation policy only — nothing engine-shaped lives here.

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { strings } from "../copy/strings";
import { AppText } from "../design/primitives/app-text";
import { Screen } from "../design/primitives/screen";
import { todayIso } from "./dates";
import { entitlementStatus, isEntitled } from "../monetization/entitlement";
import { isFinished } from "../session/player-machine";
import { useActiveSessionStore } from "../state/active-session-store";
import { useEntitlementStore } from "../state/entitlement-store";
import { useIdentityStore } from "../state/identity-store";
import { useLedgerStore } from "../state/ledger-store";
import { useProfileStore } from "../state/profile-store";
import { useReminderStore } from "../state/reminder-store";
import { useSessionStore } from "../state/session-store";
import { useSettingsStore } from "../state/settings-store";

/** What a route needs to be a truthful screen. One name per route. */
export type RouteRequirement =
  /** Persisted stores hydrated — the route shows owned records only. */
  | "hydratedOnly"
  /**
   * /home and /prompt: hydrated AND allowed to generate a new session.
   * An expired, unpurchased trial belongs on the gated day at "/" (the
   * paywall letter), not in front of four questions whose answer it
   * cannot act on. The decision is the monetization module's, unchanged
   * and app-layer — this guard only asks it (ADR-0009 §3).
   */
  | "entitledToStart"
  /** /preview: a generated session waiting to be played. */
  | "generatedSession"
  /** /session: a session and player in flight. */
  | "activeSession"
  /** /finish: a finished session to apply, or an applied summary. */
  | "finishedSession"
  /** /unlock: at least one skill actually unlocked this session. */
  | "pendingUnlock"
  /**
   * /reminder-ask: a close with completed work behind it AND the one
   * in-context ask still owed. A cold open (or any re-entry once
   * `asked` persisted) redirects home — the ask can never run twice.
   */
  | "reminderAsk";

/**
 * The persisted-store hydration set — the same six stores the launch
 * surface waits on. `failed` mirrors the daily prompt's honest storage
 * state: a store that errored never reports hydrated, so the guard
 * shows the storage message instead of spinning forever.
 */
export function useStoreHydration(): { hydrated: boolean; failed: boolean } {
  const profileHydrated = useProfileStore((s) => s.hydrated);
  const profileFailed = useProfileStore((s) => s.hydrationFailed);
  const ledgerHydrated = useLedgerStore((s) => s.hydrated);
  const ledgerFailed = useLedgerStore((s) => s.hydrationFailed);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const settingsFailed = useSettingsStore((s) => s.hydrationFailed);
  const activeHydrated = useActiveSessionStore((s) => s.hydrated);
  const activeFailed = useActiveSessionStore((s) => s.hydrationFailed);
  const entitlementHydrated = useEntitlementStore((s) => s.hydrated);
  const entitlementFailed = useEntitlementStore((s) => s.hydrationFailed);
  const identityHydrated = useIdentityStore((s) => s.hydrated);
  const identityFailed = useIdentityStore((s) => s.hydrationFailed);
  return {
    hydrated:
      profileHydrated &&
      ledgerHydrated &&
      settingsHydrated &&
      activeHydrated &&
      entitlementHydrated &&
      identityHydrated,
    failed:
      profileFailed ||
      ledgerFailed ||
      settingsFailed ||
      activeFailed ||
      entitlementFailed ||
      identityFailed,
  };
}

// The session flow lives in memory only (the crash snapshot is the
// launch surface's business via restoreActiveSession) — so these read
// the store imperatively at decision time, keeping the entry check a
// one-shot latch rather than a live subscription.
function requirementMet(requirement: RouteRequirement): boolean {
  const { session, player, finish } = useSessionStore.getState();
  switch (requirement) {
    case "hydratedOnly":
      return true;
    case "entitledToStart": {
      const { trialStartDate, purchase } = useEntitlementStore.getState();
      return isEntitled(
        entitlementStatus({ trialStartDate, purchase, today: todayIso() }),
      );
    }
    case "generatedSession":
    case "activeSession":
      return session !== null && player !== null;
    case "finishedSession":
      // Either the workout ran to done and awaits its apply, or the
      // apply already committed and left the summary to show.
      return finish !== null || (player !== null && isFinished(player));
    case "pendingUnlock":
      return finish !== null && finish.unlockedSkills.length > 0;
    case "reminderAsk": {
      // The reminder store is deliberately NOT in the shared hydration
      // set (no other route needs it); an unhydrated read fails SAFE
      // toward not asking — a skipped ask costs nothing, a double ask
      // would be a nag.
      const reminders = useReminderStore.getState();
      return (
        finish !== null &&
        finish.completedAnything &&
        reminders.hydrated &&
        !reminders.asked
      );
    }
  }
}

type Decision = "waiting" | "allow" | "redirect";

interface RouteGuardProps {
  requires: RouteRequirement;
  children: ReactNode;
}

export function RouteGuard({ requires, children }: RouteGuardProps) {
  const { hydrated, failed } = useStoreHydration();
  // Decide synchronously when hydration is already settled (the common
  // in-flow case: preview → session → finish), so navigation between
  // live screens never flashes the holding line. The effect below covers
  // only the true cold-open, where hydration finishes after mount.
  const [decision, setDecision] = useState<Decision>(() =>
    hydrated ? (requirementMet(requires) ? "allow" : "redirect") : "waiting",
  );

  useEffect(() => {
    if (!hydrated || decision !== "waiting") return;
    setDecision(requirementMet(requires) ? "allow" : "redirect");
  }, [hydrated, decision, requires]);

  useEffect(() => {
    if (decision !== "redirect") return;
    router.replace("/");
  }, [decision]);

  if (decision === "allow") return <>{children}</>;

  // Waiting on hydration, or replacing toward "/": a calm holding state
  // in the app's own frame — never a blank screen, never a false claim.
  return (
    <Screen>
      <View style={styles.holding}>
        <AppText variant="bodySoft">
          {failed ? strings.errors.storageUnavailable : strings.errors.preparing}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  holding: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
