// The week's date range as the recap captions it (owner brief 2026-09-07,
// wave 2; mockup weekly-recap): "1 to 7 September" inside one month,
// "29 September to 5 October" across two. Day numbers are read off the
// ISO strings the engine's `weekOf` hands us; the month name comes from
// the platform's own locale formatting, the same call the care journal's
// dates use (care-journal.formatNoteDate), so the two never disagree.
//
// COPY-WRITER: the joining word "to" is the one literal here. strings.ts
// has no key for it yet (recap.title takes the finished range); a
// `recap.rangeJoin` key would let it move out of this file.

const RANGE_JOIN = "to";

function monthName(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "long" });
}

function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/**
 * "1 to 7 September" when both dates share a month, otherwise
 * "29 September to 5 October". Both arguments are ISO yyyy-mm-dd.
 */
export function formatWeekRange(startIso: string, endIso: string): string {
  const startDay = dayOfMonth(startIso);
  const endDay = dayOfMonth(endIso);
  const startMonth = monthName(startIso);
  const endMonth = monthName(endIso);
  if (startIso.slice(0, 7) === endIso.slice(0, 7)) {
    return `${startDay} ${RANGE_JOIN} ${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} ${RANGE_JOIN} ${endDay} ${endMonth}`;
}
