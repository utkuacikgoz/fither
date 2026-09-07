import { strings } from "../../../copy/strings";
import { RowButton } from "../../../design/primitives/row-button";
import {
  FLOOR_ONLY_EQUIPMENT,
  useSettingsStore,
  WITH_CHAIR_EQUIPMENT,
} from "../../../state/settings-store";
import { EQUIPMENT_FIGURES } from "../../onboarding/onboarding-screen";
import { SettingsSubpage } from "./settings-subpage";

// Equipment (mockup settings-equipment): onboarding's floor-or-chair
// answer, changeable any day (audit S6). The same two rows with the same
// figures, so the option shows what it means (mapping). The equipment
// sets are the store's own constants — a wall exists in every room she'd
// train in, so it stays on both paths; the engine rule is never
// re-derived here. A settings choice persists and is never auto-advanced
// away from, so the chosen row keeps its check (RowButton shows one in
// its multiSelect shape; the choice here is still one of two).

export function EquipmentPage() {
  const equipment = useSettingsStore((s) => s.equipment);
  const setEquipment = useSettingsStore((s) => s.setEquipment);
  const hasChair = equipment.includes("chair");
  return (
    <SettingsSubpage title={strings.settings.rows.equipment} testID="settings-equipment">
      <RowButton
        testID="equipment-floor-only"
        label={strings.onboarding.equipment.options.floorOnly}
        figure={EQUIPMENT_FIGURES.floorOnly}
        selected={!hasChair}
        multiSelect
        onPress={() => setEquipment(FLOOR_ONLY_EQUIPMENT)}
      />
      <RowButton
        testID="equipment-chair"
        label={strings.onboarding.equipment.options.chair}
        figure={EQUIPMENT_FIGURES.chair}
        selected={hasChair}
        multiSelect
        onPress={() => setEquipment(WITH_CHAIR_EQUIPMENT)}
      />
    </SettingsSubpage>
  );
}
