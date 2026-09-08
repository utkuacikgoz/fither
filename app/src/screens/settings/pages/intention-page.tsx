import type { WeeklyTarget } from "@fither/engine";

import { track } from "../../../analytics/analytics";
import { syncPersonProperties } from "../../../analytics/person";
import { strings } from "../../../copy/strings";
import { OptionRow } from "../../../design/primitives/option-row";
import { useReducedMotion } from "../../../lib/use-reduced-motion";
import { useIntentionStore } from "../../../state/intention-store";
import { SettingsGroup } from "../settings-group";
import { SettingsSubpage } from "./settings-subpage";

// Sessions a week (owner brief 2026-09-07, wave 2; strings.intention):
// the same three answers the one-time ask offers, as a settings choice
// she can revisit. Two, Three, No target — equal dignity, the current
// one checked on the option itself (mapping). Changing it is PROSPECTIVE
// only (intention-store): the engine's fold over history is the only
// record of trained days, so nothing is rewritten, this week and every
// later one are simply read against the new number. Saves on tap; the
// chevron is the way out.

/** The three rows, in the ask's order, each paired with its event value. */
const OPTIONS: ReadonlyArray<{
  target: WeeklyTarget;
  label: string;
  event: "two" | "three" | "none";
  testID: string;
}> = [
  { target: 2, label: strings.intention.two, event: "two", testID: "intention-two" },
  { target: 3, label: strings.intention.three, event: "three", testID: "intention-three" },
  { target: null, label: strings.intention.none, event: "none", testID: "intention-none" },
];

export function IntentionPage() {
  const reduceMotion = useReducedMotion();
  const target = useIntentionStore((s) => s.target);
  const setTarget = useIntentionStore((s) => s.setTarget);
  return (
    <SettingsSubpage
      title={strings.intention.question}
      lead={strings.intention.lead}
      testID="settings-intention-page"
    >
      <SettingsGroup reduceMotion={reduceMotion} testID="settings-intention-options">
        {OPTIONS.map((option, index) => (
          <OptionRow
            key={option.testID}
            testID={option.testID}
            label={option.label}
            selected={target === option.target}
            divider={index < OPTIONS.length - 1}
            onPress={() => {
              setTarget(option.target);
              track("weekly_intention_set", { target: option.event });
              syncPersonProperties();
            }}
          />
        ))}
      </SettingsGroup>
    </SettingsSubpage>
  );
}
