import { strings } from "../../../copy/strings";
import { AreaGrid } from "../../../design/primitives/area-grid";
import { BODY_AREAS } from "../../../lib/body-areas";
import { useSettingsStore } from "../../../state/settings-store";
import { SettingsSubpage } from "./settings-subpage";

// Always work around (mockup settings-avoid): the persistent avoid-list
// from onboarding, edited with the same AreaGrid the onboarding and the
// daily soreness step use — one control, one meaning. Preference data
// only: what "avoid" means to a session is decided entirely engine-side;
// this page edits the stored list the daily prompt merges into every
// day's input. Each tap persists at once through the store layer.

export function AvoidPage() {
  const alwaysAvoid = useSettingsStore((s) => s.alwaysAvoid);
  const toggleAlwaysAvoid = useSettingsStore((s) => s.toggleAlwaysAvoid);
  return (
    <SettingsSubpage
      title={strings.settings.avoid.title}
      lead={strings.settings.avoid.body}
      testID="settings-avoid"
    >
      <AreaGrid
        areas={BODY_AREAS}
        selected={alwaysAvoid}
        onToggle={toggleAlwaysAvoid}
        testIDPrefix="avoid"
      />
    </SettingsSubpage>
  );
}
