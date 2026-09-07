import { useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { track } from "../../analytics/analytics";
import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { FadeIn } from "../../design/primitives/fade-in";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { Screen } from "../../design/primitives/screen";
import { SettingsRow } from "../../design/primitives/settings-row";
import { Tile } from "../../design/primitives/tile";
import { WeekRow } from "../../design/primitives/week-row";
import { motion, spacing } from "../../design/tokens";
import { formatWeekRange } from "../../lib/format-week";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { useTodayIso } from "../../lib/use-today";
import { loadLibrary } from "../../session/load-library";
import { useLedgerStore } from "../../state/ledger-store";
import { useProfileStore } from "../../state/profile-store";
import { weekRecap } from "./week-recap";

// The weekly recap (owner brief 2026-09-07, wave 2; mockup weekly-recap,
// approved 2026-09-07). The week is the page: its date range as the
// eyebrow, the SESSION count in words as the one headline (the same
// number the share card's week line uses; the strip beneath shows the
// distinct days), then two quiet tiles
// (the seven-day strip, the week's receipt rows) and one green action.
// Everything shown is a read of what the stores already hold, through
// screens/recap/week-recap.ts; nothing here decides what counts.
//
// A week with nothing trained is a quiet week, not an empty one: the
// headline says so, the strip is open, the rows read zero, and there is
// no share button (there is nothing to share) and no share_eligible
// event. Tier rows appear only when the ledger dated a rise this week;
// otherwise the honest "no new tier" line, which never invents progress.

interface RecapScreenProps {
  /** Any date in the week to show, ISO yyyy-mm-dd. Defaults to today. */
  week?: string;
}

const ORDER = { days: 1, rows: 2 } as const;

export function RecapScreen({ week: anchor }: RecapScreenProps) {
  const reduceMotion = useReducedMotion();
  const today = useTodayIso();
  const entries = useProfileStore((s) => s.history.entries);
  const events = useLedgerStore((s) => s.events);
  const library = loadLibrary();
  const anchorIso = anchor ?? today;
  const recap = useMemo(
    () => weekRecap(entries, events, library, anchorIso),
    [entries, events, library, anchorIso],
  );
  const { week, participation, minutesPlanned, movements, tiersReached } = recap;
  const shareable = participation.count > 0;

  // share_eligible once per visit (wave 3): the offer is the button
  // being on the page, so it fires when the button does, not on a tap.
  const eligibilitySent = useRef(false);
  useEffect(() => {
    if (!shareable || eligibilitySent.current) return;
    eligibilitySent.current = true;
    track("share_eligible", { source: "recap" });
  }, [shareable]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FadeIn reduceMotion={reduceMotion} rise={motion.riseDistance} style={styles.hero}>
          <AppText variant="caption" testID="recap-range">
            {strings.recap.title(formatWeekRange(week.start, week.end))}
          </AppText>
          <AppText
            variant="display"
            accessibilityRole="header"
            style={styles.headline}
            testID="recap-headline"
          >
            {strings.recap.headline(participation.sessions)}
          </AppText>
        </FadeIn>

        <Tile order={ORDER.days} reduceMotion={reduceMotion} testID="recap-days">
          <AppText variant="caption" style={styles.tileCaption}>
            {strings.week.daysLabel}
          </AppText>
          <WeekRow
            dates={week.dates}
            trainedDates={participation.trainedDates}
            today={today}
            testID="recap-week"
          />
        </Tile>

        <Tile order={ORDER.rows} reduceMotion={reduceMotion} inset="list" style={styles.rowsTile} testID="recap-rows">
          <SettingsRow
            testID="recap-minutes"
            label={strings.recap.minutesLabel}
            value={String(minutesPlanned)}
          />
          <SettingsRow
            testID="recap-movements"
            label={strings.recap.movementsLabel}
            value={String(movements)}
            divider={tiersReached.length > 0}
          />
          {tiersReached.map(({ pattern, tier }, index) => (
            <SettingsRow
              key={`${pattern}-${tier}`}
              testID={`recap-tier-${pattern}`}
              label={strings.recap.tierLabel(strings.profile.patterns.names[pattern])}
              value={strings.recap.tierValue(tier)}
              divider={index < tiersReached.length - 1}
            />
          ))}
        </Tile>
        {tiersReached.length === 0 && (
          <AppText variant="bodySoft" style={styles.noChange} testID="recap-no-change">
            {strings.recap.noChange}
          </AppText>
        )}
      </ScrollView>

      {shareable && (
        <View style={styles.bottom}>
          <PrimaryButton
            testID="recap-share"
            label={strings.recap.share}
            onPress={() => router.push(`/share?source=recap&date=${week.start}`)}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  hero: {
    // Clears the transparent back header, the same clearance every
    // pushed screen uses, then the eyebrow and the one headline.
    paddingTop: spacing.xxl,
    marginBottom: spacing.lg + spacing.xs,
  },
  headline: {
    marginTop: spacing.sm,
  },
  tileCaption: {
    marginBottom: spacing.md,
  },
  rowsTile: {
    marginTop: spacing.md,
  },
  noChange: {
    marginTop: spacing.md,
  },
  bottom: {
    paddingBottom: spacing.md,
  },
});
