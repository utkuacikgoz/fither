import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { SETTINGS_ROW_HEIGHT } from "../../design/primitives/settings-row";
import { Tile } from "../../design/primitives/tile";
import { useTheme } from "../../design/theme";
import { hairline } from "../../design/tokens";
import type { SessionReceipt } from "../../session/receipt";
import type { WeekView } from "../../state/week-view";

// The receipt (owner brief 2026-09-07, wave 2; mockup finish-receipt,
// approved): a grouped list of what the session was, label left, value
// right in the soft ink, hairlines between. Done, Hard today (only when
// she said it), the length she chose (planned, never measured), and the
// week the session lands in. Every value is a read: the counts are the
// engine-written entry's through session/receipt.ts, the week is
// state/week-view.ts over the engine's participation.

interface ReceiptTileProps {
  receipt: SessionReceipt;
  week: WeekView;
  /** Points the session earned; 0 draws no row (a struggled session earns nothing). */
  points: number;
  order: number;
  reduceMotion: boolean;
}

interface ReceiptRow {
  key: "done" | "hard" | "length" | "week" | "points";
  label: string;
  value: string;
  /** The green marks the one row that is earned, not counted. */
  tone?: "accent";
}

/**
 * The "This week" value: week.progress / progressNoTarget carry a full
 * stop for the Home tile's sentence; a column entry does not (the
 * copy-writer's note on finish.receipt).
 */
function weekValue(week: WeekView): string {
  const { count } = week.participation;
  const line =
    week.target === null
      ? strings.week.progressNoTarget(count)
      : strings.week.progress(count, week.target);
  return line.replace(/\.$/, "");
}

export function receiptRows(
  receipt: SessionReceipt,
  week: WeekView,
  points = 0,
): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    {
      key: "done",
      label: strings.finish.receipt.doneLabel,
      value: strings.finish.receipt.done(receipt.done),
    },
  ];
  // Prefer not rendering what does not apply (Norman: constraints): a
  // clean session carries no "Hard today: 0" row.
  if (receipt.hard > 0) {
    rows.push({
      key: "hard",
      label: strings.finish.receipt.hardLabel,
      value: strings.finish.receipt.hard(receipt.hard),
    });
  }
  rows.push(
    {
      key: "length",
      label: strings.finish.receipt.lengthLabel,
      value: strings.finish.receipt.length(receipt.minutesPlanned),
    },
    {
      key: "week",
      label: strings.finish.receipt.weekLabel,
      value: weekValue(week),
    },
  );
  // The points close the receipt as its last line (owner feedback
  // 2026-09-08: a numeral floating under the tile read as misplaced).
  // Same row shape as the counts, the value in the green; the unit is
  // the label, so "+1" never has to agree with it.
  if (points > 0) {
    rows.push({
      key: "points",
      label: strings.finish.receipt.pointsLabel,
      value: `+${points}`,
      tone: "accent",
    });
  }
  return rows;
}

export function ReceiptTile({ receipt, week, points, order, reduceMotion }: ReceiptTileProps) {
  const colors = useTheme();
  const rows = receiptRows(receipt, week, points);
  return (
    <Tile inset="list" order={order} reduceMotion={reduceMotion} testID="finish-receipt">
      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[
            styles.row,
            index > 0 && { borderTopWidth: hairline, borderTopColor: colors.line },
          ]}
          accessible
          accessibilityLabel={`${row.label}. ${row.value}`}
          testID={`finish-receipt-${row.key}`}
        >
          <AppText variant="body">{row.label}</AppText>
          <AppText
            variant={row.tone === "accent" ? "body" : "bodySoft"}
            {...(row.tone === "accent" ? { color: colors.accent } : {})}
            testID={`finish-receipt-${row.key}-value`}
          >
            {row.value}
          </AppText>
        </View>
      ))}
    </Tile>
  );
}

const styles = StyleSheet.create({
  row: {
    // The ledger's row unit for a tile: one height, one hairline between.
    minHeight: SETTINGS_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
