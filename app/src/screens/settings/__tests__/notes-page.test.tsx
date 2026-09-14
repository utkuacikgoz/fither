import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useSessionStore } from "../../../state/session-store";
import { fixturePlayerBlocks, fixtureSession } from "../../../test-utils/fixtures";
import { createPlayer, reduce } from "../../../session/player-machine";
import { collectStringValues, renderedTextLeaves } from "../../../test-utils/copy-audit";
import { formatNoteDate } from "../care-journal";
import { NotesPage } from "../pages/notes-page";
import { resetSettingsStores } from "./settings-test-setup";

// The care journal on its own page (ADR-0012 §4): notes as tiles, newest
// first, edit in place, one calm confirmed delete, the privacy fact last.

// The fixture session is dated 2026-08-31; the page must see that day
// as today for it to count as built.
jest.mock("../../../lib/use-today", () => ({ useTodayIso: () => "2026-08-31" }));

beforeEach(async () => {
  await resetSettingsStores();
});

describe("Settings → Your notes", () => {
  it("shows the title once, the empty state and the privacy fact when there are no notes", () => {
    const screen = render(<NotesPage />);
    expect(screen.getAllByText(strings.settings.careNotes.title)).toHaveLength(1);
    expect(screen.getByTestId("care-journal-empty")).toBeTruthy();
    expect(screen.getByText(strings.settings.careNotes.empty)).toBeTruthy();
    expect(screen.getByText(strings.care.notePrivacy)).toBeTruthy();
  });

  it("with no notes, offers the day: the four questions when nothing is built", () => {
    const screen = render(<NotesPage />);
    fireEvent.press(screen.getByTestId("care-journal-start"));
    expect(router.push).toHaveBeenCalledWith("/prompt");
  });

  it("the offer goes where Home's would: a built session to its preview, a begun one back to the player", () => {
    useSessionStore.setState({ session: fixtureSession, player: createPlayer(fixturePlayerBlocks) });
    const built = render(<NotesPage />);
    fireEvent.press(built.getByTestId("care-journal-start"));
    expect(router.push).toHaveBeenLastCalledWith("/preview");
    built.unmount();

    useSessionStore.setState({ player: reduce(createPlayer(fixturePlayerBlocks), { type: "begin" }) });
    const begun = render(<NotesPage />);
    fireEvent.press(begun.getByTestId("care-journal-start"));
    expect(router.push).toHaveBeenLastCalledWith("/session");
  });

  it("with notes, the day is not offered here", () => {
    useCareNoteStore.setState({ entries: [{ id: "a", date: "2026-09-01", text: "a note" }] });
    const screen = render(<NotesPage />);
    expect(screen.queryByTestId("care-journal-start")).toBeNull();
  });

  it("lists her notes newest first as tiles, dated, full text unclipped, privacy line last", () => {
    const longText =
      "A long note about a hard week that runs on well past a single line and must render in full, never truncated behind an ellipsis.";
    useCareNoteStore.setState({
      entries: [
        { id: "a", date: "2026-08-20", text: "older note" },
        { id: "b", date: "2026-09-01", text: longText },
      ],
    });
    const screen = render(<NotesPage />);
    expect(screen.queryByTestId("care-journal-empty")).toBeNull();
    expect(screen.getByTestId("care-journal-note-a")).toBeTruthy();
    expect(screen.getByTestId("care-journal-note-b")).toBeTruthy();
    expect(screen.getByText(longText)).toBeTruthy();
    expect(screen.getByText(formatNoteDate("2026-08-20"))).toBeTruthy();
    expect(screen.getByText(formatNoteDate("2026-09-01"))).toBeTruthy();

    const leaves = renderedTextLeaves(screen.toJSON());
    expect(leaves.indexOf(longText)).toBeLessThan(leaves.indexOf("older note"));
    expect(leaves.indexOf("older note")).toBeLessThan(leaves.indexOf(strings.care.notePrivacy));
  });

  it("edits in place: her words back in the field, Save commits (audit S1)", () => {
    useCareNoteStore.setState({ entries: [{ id: "n1", date: "2026-09-01", text: "first draft" }] });
    const screen = render(<NotesPage />);
    fireEvent.press(screen.getByTestId("care-journal-edit-n1"));
    fireEvent.changeText(screen.getByTestId("care-journal-edit-input-n1"), "second thoughts");
    fireEvent.press(screen.getByTestId("care-journal-save-n1"));
    expect(useCareNoteStore.getState().entries).toMatchObject([{ id: "n1", text: "second thoughts" }]);
    expect(screen.getByText("second thoughts")).toBeTruthy();
    expect(screen.queryByTestId("care-journal-save-n1")).toBeNull();
  });

  it("deletes only after the one calm confirm, inside the note's own tile", () => {
    useCareNoteStore.setState({
      entries: [
        { id: "a", date: "2026-08-20", text: "stays" },
        { id: "b", date: "2026-09-01", text: "goes" },
      ],
    });
    const screen = render(<NotesPage />);
    expect(screen.queryByText(strings.settings.careNotes.deleteConfirmTitle)).toBeNull();
    fireEvent.press(screen.getByTestId("care-journal-delete-b"));
    expect(screen.getByText(strings.settings.careNotes.deleteConfirmTitle)).toBeTruthy();
    expect(screen.getByText(strings.settings.careNotes.deleteConfirmBody)).toBeTruthy();
    expect(
      screen.getByTestId("care-journal-note-b").findByProps({ testID: "care-journal-keep-b" }),
    ).toBeTruthy();
    // The note itself stays visible while she decides (mapping).
    expect(screen.getByText("goes")).toBeTruthy();
    expect(useCareNoteStore.getState().entries).toHaveLength(2);

    fireEvent.press(screen.getByTestId("care-journal-confirm-delete-b"));
    expect(useCareNoteStore.getState().entries).toMatchObject([{ id: "a", text: "stays" }]);
    expect(screen.queryByText("goes")).toBeNull();
    expect(screen.getByText("stays")).toBeTruthy();
  });

  it("keep it cancels: the confirm closes and nothing is deleted", () => {
    useCareNoteStore.setState({ entries: [{ id: "a", date: "2026-09-01", text: "precious" }] });
    const screen = render(<NotesPage />);
    fireEvent.press(screen.getByTestId("care-journal-delete-a"));
    fireEvent.press(screen.getByTestId("care-journal-keep-a"));
    expect(screen.queryByText(strings.settings.careNotes.deleteConfirmTitle)).toBeNull();
    expect(screen.getByText("precious")).toBeTruthy();
    expect(useCareNoteStore.getState().entries).toHaveLength(1);
  });

  it("legacy notes without ids still render and delete", () => {
    useCareNoteStore.setState({ entries: [{ date: "2026-08-01", text: "from before ids" }] });
    const screen = render(<NotesPage />);
    expect(screen.getByText("from before ids")).toBeTruthy();
    fireEvent.press(screen.getByTestId("care-journal-delete-legacy-0"));
    fireEvent.press(screen.getByTestId("care-journal-confirm-delete-legacy-0"));
    expect(useCareNoteStore.getState().entries).toEqual([]);
    expect(screen.getByTestId("care-journal-empty")).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", () => {
    useCareNoteStore.setState({ entries: [{ id: "n1", date: "2026-09-01", text: "her own words" }] });
    const allowed = collectStringValues(strings);
    // Her own note content and its locale-formatted date are data, not copy.
    allowed.add("her own words");
    allowed.add(formatNoteDate("2026-09-01"));
    const screen = render(<NotesPage />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
    fireEvent.press(screen.getByTestId("care-journal-delete-n1"));
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
