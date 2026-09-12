import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { RowButton } from "../../design/primitives/row-button";
import { Screen } from "../../design/primitives/screen";
import { SectionCaption } from "../../design/primitives/section-caption";
import { spacing } from "../../design/tokens";
import { useTodayIso } from "../../lib/use-today";
import { shareUrl, shareUrlHost } from "../../share/share-url";
import { useIntentionStore } from "../../state/intention-store";
import { useProfileStore } from "../../state/profile-store";
import { ShareCard } from "./share-card";
import { shareReceipt } from "./share-receipt";
import {
  shareLinkKind,
  shareSubject,
  type ShareContext,
  type ShareSource,
  type ShareSubject,
} from "./share-subject";

// Share from a receipt or a recap (wave 3; mockup share-receipt,
// owner-approved 2026-09-07; referral handoff wave 3). A session offers
// one optional public context that rewrites both its card and recipient
// path. A weekly recap has no place question because a place cannot
// change its story. Context is a place kind, never a place: nothing about
// her health, notes or restrictions is on the card, text or event.

interface ShareScreenProps {
  source: ShareSource;
  /** A validated yyyy-mm-dd; absent means today's last entry. */
  date?: string;
}

const CONTEXTS: readonly ShareContext[] = ["home", "hotel", "meetings"];

function headlineFor(subject: ShareSubject, context: ShareContext | null): string {
  return subject.kind === "session"
    ? strings.share.context.card.headline(context, subject.minutes)
    : strings.share.context.card.week(subject.sessions);
}

export function ShareScreen({ source, date }: ShareScreenProps) {
  const cardRef = useRef<View>(null);
  const sharing = useRef(false);
  const entries = useProfileStore((state) => state.history.entries);
  const target = useIntentionStore((state) => state.target);
  const today = useTodayIso();
  const subject = useMemo(
    () => shareSubject(entries, today, target, source, date),
    [entries, today, target, source, date],
  );
  const [context, setContext] = useState<ShareContext | null>(null);

  const headline = headlineFor(subject, context);
  const sub = strings.share.context.card.sub(subject.movements);
  const host = shareUrlHost();

  const handleShare = () => {
    // One sheet at a time: a double tap must not start a second capture
    // whose sheet UIKit silently refuses to present.
    if (sharing.current) return;
    sharing.current = true;
    const effectiveContext = subject.kind === "session" ? context : null;
    track("share_start", { source, context: effectiveContext ?? "none" });
    const url = shareUrl(shareLinkKind(subject, effectiveContext));
    // No destination configured means no link at all — the card line is
    // the whole message, never a placeholder address.
    const message =
      url === null
        ? headline
        : subject.kind === "week"
          ? strings.share.context.weekMessage(url)
          : strings.share.context.sessionMessage(url);
    void shareReceipt({ message, card: cardRef }).finally(() => {
      sharing.current = false;
    });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.center}
        showsVerticalScrollIndicator={false}
      >
        <ShareCard
          ref={cardRef}
          headline={headline}
          sub={sub}
          movementId={subject.figureId}
          host={host}
          testID="share-card"
        />
        {subject.kind === "session" && (
          <View style={styles.context}>
            <SectionCaption label={strings.share.context.question} />
            {CONTEXTS.map((option) => (
              <RowButton
                key={option}
                testID={`share-context-${option}`}
                label={strings.share.context[option]}
                selected={context === option}
                // Not a multi-select: the check glyph marks a row that
                // stays chosen (no auto-advance here), and the same tap
                // clears it back to the plain card.
                multiSelect
                onPress={() => setContext((current) => (current === option ? null : option))}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.bottom}>
        <PrimaryButton
          testID="share-send"
          label={strings.share.action}
          onPress={handleShare}
        />
        <QuietButton
          testID="share-not-now"
          label={strings.share.context.notNow}
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  context: {
    gap: 0,
  },
  bottom: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
