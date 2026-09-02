import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "../../copy/strings";
import { AppText } from "../../design/primitives/app-text";
import { NoteField } from "../../design/primitives/note-field";
import { PrimaryButton } from "../../design/primitives/primary-button";
import { QuietButton } from "../../design/primitives/quiet-button";
import { useTheme } from "../../design/theme";
import { hairline, radius, spacing } from "../../design/tokens";
import {
  useCareNoteStore,
  type CareNoteEntry,
} from "../../state/care-note-store";

// The care journal (ADR-0012 §4): her heavy-day notes, listed newest
// first, each with a quiet edit and one calm, confirmed delete. Read
// straight from the local-only care-note store — this section renders,
// edits and deletes; nothing here ever sends a note anywhere, and the
// privacy line under the title states that hard fact. Notes may be long:
// text wraps in full, never truncated. Editing swaps the note's text for
// the same NoteField she wrote it in, with a plain Save — no dirty-state
// ceremony; backing out of the screen simply drops the draft. The delete
// confirm renders INSIDE the note's own card (mapping: the control sits
// where its effect happens), with keeping the note as the filled, safe
// default and deletion as the quiet action — the same weighting as the
// player's skip confirm.

/**
 * A note's date, set in her locale. Dynamic data (like the version
 * footer), not copy — no month-name literals live in code. Parsed at
 * LOCAL midnight so the shown day never slips across timezones.
 */
export function formatNoteDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Render identity per note; legacy entries without ids fall back to position. */
function noteKey(entry: CareNoteEntry, index: number): string {
  return entry.id ?? `legacy-${index}`;
}

/**
 * The journal asks at most ONE question at a time: either one note is in
 * edit mode or one note shows its delete confirm, never both, never two
 * (a single state slot makes stacking impossible — constraints over
 * error messages). Starting either action anywhere closes the other.
 */
type NoteAction =
  | { kind: "edit"; key: string; draft: string }
  | { kind: "confirmDelete"; key: string }
  | null;

export function CareJournal() {
  const entries = useCareNoteStore((s) => s.entries);
  const removeNote = useCareNoteStore((s) => s.remove);
  const updateNote = useCareNoteStore((s) => s.update);
  const colors = useTheme();
  const [action, setAction] = useState<NoteAction>(null);

  // Stored oldest-first (append-only); shown newest first.
  const notes = entries
    .map((entry, index) => ({ entry, key: noteKey(entry, index) }))
    .reverse();

  return (
    <View>
      <AppText variant="caption" style={styles.heading}>
        {strings.settings.careNotes.title}
      </AppText>
      <AppText variant="bodySoft" style={styles.privacy}>
        {strings.care.notePrivacy}
      </AppText>

      {notes.length === 0 && (
        <AppText variant="bodySoft" testID="care-journal-empty">
          {strings.settings.careNotes.empty}
        </AppText>
      )}

      {notes.map(({ entry, key }) => {
        const editing = action?.kind === "edit" && action.key === key;
        const confirming =
          action?.kind === "confirmDelete" && action.key === key;
        return (
          <View
            key={key}
            testID={`care-journal-note-${key}`}
            style={[
              styles.note,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <AppText variant="caption" style={styles.noteDate}>
              {formatNoteDate(entry.date)}
            </AppText>

            {editing ? (
              // Her words back in the field they were written in. Save is
              // the one commit; an unchanged save just closes quietly,
              // and a blanked note is kept as-is (the store treats
              // trimmed-empty as a no-op — deleting has its own path).
              <NoteField
                testID={`care-journal-edit-input-${key}`}
                prompt={strings.settings.careNotes.editAction}
                privacyNote={strings.care.notePrivacy}
                value={action.draft}
                onChangeText={(draft) => setAction({ kind: "edit", key, draft })}
              />
            ) : (
              <AppText variant="body">{entry.text}</AppText>
            )}

            {editing && (
              <PrimaryButton
                testID={`care-journal-save-${key}`}
                label={strings.settings.careNotes.saveEdit}
                onPress={() => {
                  updateNote(entry, action.draft);
                  setAction(null);
                }}
              />
            )}

            {confirming && (
              <View style={styles.confirm}>
                <AppText variant="body">
                  {strings.settings.careNotes.deleteConfirmTitle}
                </AppText>
                <AppText variant="bodySoft">
                  {strings.settings.careNotes.deleteConfirmBody}
                </AppText>
                <PrimaryButton
                  testID={`care-journal-keep-${key}`}
                  label={strings.settings.careNotes.keepIt}
                  onPress={() => setAction(null)}
                />
                <QuietButton
                  testID={`care-journal-confirm-delete-${key}`}
                  label={strings.settings.careNotes.deleteAction}
                  onPress={() => {
                    setAction(null);
                    removeNote(entry);
                  }}
                />
              </View>
            )}

            {!editing && !confirming && (
              <View style={styles.actions}>
                <QuietButton
                  testID={`care-journal-edit-${key}`}
                  label={strings.settings.careNotes.editAction}
                  onPress={() =>
                    setAction({ kind: "edit", key, draft: entry.text })
                  }
                />
                <QuietButton
                  testID={`care-journal-delete-${key}`}
                  label={strings.settings.careNotes.deleteAction}
                  onPress={() => setAction({ kind: "confirmDelete", key })}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: spacing.sm,
  },
  privacy: {
    marginBottom: spacing.md,
  },
  note: {
    borderRadius: radius.card,
    borderWidth: hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  noteDate: {
    marginBottom: 0,
  },
  confirm: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
  },
});
