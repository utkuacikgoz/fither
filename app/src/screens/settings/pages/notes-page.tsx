import { strings } from "../../../copy/strings";
import { useReducedMotion } from "../../../lib/use-reduced-motion";
import { CareJournal } from "../care-journal";
import { SettingsSubpage } from "./settings-subpage";

// Your notes (mockup settings-notes): the care journal on its own page
// (ADR-0012 §4). The title is the page's; the journal carries the notes
// and closes with the privacy fact.

export function NotesPage() {
  const reduceMotion = useReducedMotion();
  return (
    <SettingsSubpage title={strings.settings.careNotes.title} testID="settings-journal">
      <CareJournal reduceMotion={reduceMotion} />
    </SettingsSubpage>
  );
}
