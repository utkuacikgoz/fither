import type { BodyArea, Equipment } from "@fither/engine";

import { strings } from "../../copy/strings";
import { getBilling, type PurchaseRecord } from "../../monetization/billing";
import type { ReminderSlot } from "../../notifications/notifications";
import { formatNoteDate } from "./care-journal";

// The right-hand values of the Settings list: each states a stored fact
// flat, in the copy-writer's words, and nothing here decides anything —
// the stores hold the state, the engine holds the rules. Pure so the
// screen stays thin and the mapping is tested once.

/** None / the one area's own label / "n areas". */
export function avoidValue(alwaysAvoid: readonly BodyArea[]): string {
  if (alwaysAvoid.length === 0) return strings.settings.rows.avoidValue.none;
  const [only] = alwaysAvoid;
  if (alwaysAvoid.length === 1 && only) return strings.prompt.soreness.areas[only];
  return strings.settings.rows.avoidValue.many(alwaysAvoid.length);
}

/** The two equipment shapes the product offers, flat for a value column. */
export function equipmentValue(equipment: readonly Equipment[]): string {
  return equipment.includes("chair")
    ? strings.settings.rows.equipmentValue.chair
    : strings.settings.rows.equipmentValue.floorOnly;
}

export function voiceValue(voice: boolean): string {
  return voice ? strings.settings.voice.on : strings.settings.voice.off;
}

export function invitationValue(slot: ReminderSlot | null): string {
  return slot === null ? strings.settings.rows.timeOff : strings.notifications.time[slot];
}

/** The plan's own label, "Free week" during the store trial, "None yet" before any purchase. */
export function planValue(purchase: PurchaseRecord | null): string {
  if (!purchase) return strings.settings.plan.none;
  if (purchase.trial) return strings.settings.plan.trial;
  return strings.paywall.plans[purchase.plan].label;
}

/**
 * The price of the plan she holds, from the billing port's offering
 * (the store's localised label when connected, the reference strings
 * otherwise). Null when the port has no offering for it.
 */
export function planPrice(purchase: PurchaseRecord | null): string | null {
  if (!purchase) return null;
  const billing = getBilling();
  const offering =
    purchase.plan === "lifetime"
      ? billing.getLifetimeOffering()
      : billing.getOfferings().find((candidate) => candidate.plan === purchase.plan) ?? null;
  return offering?.priceLabel ?? null;
}

/** "Training since <date>" from the first history entry; null with no history. */
export function sinceLine(entries: readonly { date: string }[]): string | null {
  const [first] = entries;
  return first ? strings.settings.profile.since(formatNoteDate(first.date)) : null;
}
