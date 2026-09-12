import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import type { BodyArea } from "@fither/engine";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { toPlayerBlocks } from "../../../session/create-session";
import { loadLibrary } from "../../../session/load-library";
import { createPlayer } from "../../../session/player-machine";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useSessionStore } from "../../../state/session-store";
import {
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../../test-utils/fixtures";
import { SessionPreviewScreen } from "../session-preview-screen";

const facts = strings.preview.facts;

describe("SessionPreviewScreen", () => {
  function seedPreview(adaptations = fixtureSession.adaptations) {
    useSessionStore.setState({
      prompt: fixturePrompt,
      session: { ...fixtureSession, adaptations },
      player: createPlayer(fixturePlayerBlocks),
      finish: null,
    });
  }

  it("explains the session as the engine's facts before movement begins", () => {
    seedPreview([{ kind: "lowEnergy" }]);
    const onStart = jest.fn();
    const screen = render(
      <SessionPreviewScreen onStart={onStart} onChangeAnswers={jest.fn()} />,
    );

    // The headline is the minutes she chose, in two halves (owner-approved
    // mockup preview-b): the fact, then the line that is hers.
    const title = strings.preview.title(10);
    expect(screen.getByText(title.first)).toBeTruthy();
    expect(screen.getByText(title.second)).toBeTruthy();
    // One paragraph, not a labelled tile of rows.
    const paragraph = screen.getByTestId("preview-fit").props.children as string;
    expect(paragraph).toContain(facts.opening(2, []));
    expect(paragraph).toContain(facts.lowEnergy);
    // Every label the rebuild removed stays gone.
    expect(screen.queryByText(strings.preview.factsTitle)).toBeNull();
    expect(screen.queryByText(strings.preview.planTitle)).toBeNull();
    expect(screen.queryByText(strings.preview.eyebrow)).toBeNull();
    expect(screen.queryByText(strings.preview.headline)).toBeNull();
    expect(screen.queryByTestId("preview-fact-0")).toBeNull();
    fireEvent.press(screen.getByTestId("preview-start"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("with nothing adapted, states only what is true: length, quiet, the floor", () => {
    // The room and quiet lines are read from the BUNDLED library, so this
    // session is built from movements that exist in it (the fixture's
    // "plank" does not) — an unverifiable movement withholds both lines.
    const library = loadLibrary();
    if (!library) throw new Error("bundled movement library missing in test env");
    const session = {
      ...fixtureSession,
      adaptations: [],
      blocks: [
        fixtureSession.blocks[0]!,
        { ...fixtureSession.blocks[1]!, movementId: "lying-heel-slide" },
      ],
    };
    useSessionStore.setState({
      prompt: fixturePrompt,
      session,
      player: createPlayer(toPlayerBlocks(session, library)),
      finish: null,
    });
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    const paragraph = screen.getByTestId("preview-fit").props.children as string;
    expect(paragraph).toContain(facts.opening(2, []));
    expect(paragraph).toContain(facts.quiet);
    expect(paragraph).toContain(facts.floorOnly);
    expect(paragraph).not.toContain(facts.lowEnergy);
    // The equipment sentence closes the paragraph (copy's ORDER AND STOP).
    expect(paragraph.endsWith(facts.floorOnly)).toBe(true);
  });

  it("changing an answer changes the explanation", () => {
    seedPreview([{ kind: "soreness", areas: ["knees"] }]);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    expect(screen.getByTestId("preview-fit").props.children).toContain(
      facts.opening(2, ["knees"]),
    );

    // The store drives the screen: a new session re-renders it in place.
    act(() => seedPreview([]));
    expect(screen.getByTestId("preview-fit").props.children).not.toContain("knees");
  });

  it("shows the actual block contract with every adaptation the engine reported", () => {
    seedPreview([{ kind: "lowEnergy" }, { kind: "staleFocus", pattern: "push" }]);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );

    expect(screen.getByText("Wall Push-Up")).toBeTruthy();
    expect(screen.getByText("Plank")).toBeTruthy();
    expect(screen.getByText(strings.player.blockPlan(2, 8, false))).toBeTruthy();
    // Both adaptations survive the fold, in the copy's order of keeping.
    const paragraph = screen.getByTestId("preview-fit").props.children as string;
    expect(paragraph).toContain(facts.lowEnergy);
    expect(paragraph).toContain(facts.staleFocus("push"));
  });

  it("discards the unplayed plan but keeps today's answers for editing", () => {
    seedPreview();
    const onChangeAnswers = jest.fn();
    const screen = render(
      <SessionPreviewScreen
        onStart={jest.fn()}
        onChangeAnswers={onChangeAnswers}
      />,
    );

    fireEvent.press(screen.getByTestId("preview-change-answers"));
    expect(onChangeAnswers).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().prompt).toEqual(fixturePrompt);
    expect(useSessionStore.getState().session).toBeNull();
    expect(useSessionStore.getState().player).toBeNull();
  });

  it("preview_leave: Change today's answers reports the one way out without starting", () => {
    clearRecordedEvents();
    seedPreview([]);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId("preview-change-answers"));
    expect(recordedEvents().filter((e) => e.name === "preview_leave")).toEqual([
      { name: "preview_leave", properties: { action: "changeAnswers" } },
    ]);
    expect(recordedEvents().some((e) => e.name === "workout_start")).toBe(false);
  });

  it("session_preview (ADR-0024): reports the built session once: minutes and block count only", () => {
    clearRecordedEvents();
    seedPreview([]);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    screen.rerender(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    const previews = recordedEvents().filter((e) => e.name === "session_preview");
    expect(previews).toHaveLength(1);
    expect(previews[0]?.properties).toEqual({ minutes: 10, blocks: 2 });
  });
});

// The care moment, once per local day, across BOTH screens that can open
// with it (owner report 2026-09-12: "do not ask the notes twice, once I
// remove a training"). The memory is the care-note store's; this screen
// keys it to the session's own date — the same date its note is stamped
// with, and the date the engine echoed back from her prompt.
describe("SessionPreviewScreen — the care moment", () => {
  const DAY = "2026-09-12";
  /** Enough areas to clear the care threshold on a session that DID build. */
  const heavyAreas: BodyArea[] = [
    "shoulders",
    "wrists",
    "elbows",
    "back",
    "hips",
    "knees",
  ];

  function seedHeavyPreview() {
    useSessionStore.setState({
      prompt: { ...fixturePrompt, avoid: heavyAreas, date: DAY },
      session: { ...fixtureSession, date: DAY, adaptations: [] },
      player: createPlayer(fixturePlayerBlocks),
      finish: null,
    });
  }

  function seedCareDay(shown: string | null, hydrated = true) {
    useCareNoteStore.setState({
      entries: [],
      careMomentShownDate: shown,
      hydrated,
      hydrationFailed: false,
    });
  }

  it("leads with care while it is still due, and never asks twice that day", () => {
    seedHeavyPreview();
    seedCareDay(null);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );

    expect(screen.getByTestId("care-acknowledgment")).toBeTruthy();
    expect(screen.getByText(strings.care.acknowledgment)).toBeTruthy();
    expect(screen.getByText(strings.care.notePrompt)).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("care-note"), "  shoulder all day  ");
    fireEvent.press(screen.getByTestId("care-continue"));

    // The note saves exactly as it did before, stamped with the session's
    // date and kept on this phone.
    expect(useCareNoteStore.getState().entries).toMatchObject([
      { date: DAY, text: "shoulder all day" },
    ]);
    // And the day now remembers the beat.
    expect(useCareNoteStore.getState().careMomentShownDate).toBe(DAY);
    expect(screen.queryByTestId("care-acknowledgment")).toBeNull();
    expect(screen.getByTestId("preview-start")).toBeTruthy();

    // Even arriving at the screen again — the plan is all that is left.
    screen.unmount();
    const again = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    expect(again.queryByTestId("care-acknowledgment")).toBeNull();
    expect(again.queryByTestId("care-note")).toBeNull();
    expect(again.getByTestId("preview-start")).toBeTruthy();
  });

  it("stays silent when the day already showed it (the prompt's dead end did)", () => {
    seedHeavyPreview();
    seedCareDay(DAY);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );

    expect(screen.queryByTestId("care-acknowledgment")).toBeNull();
    expect(screen.queryByTestId("care-note")).toBeNull();
    expect(screen.getByTestId("preview-fit")).toBeTruthy();
    expect(screen.getByTestId("preview-start")).toBeTruthy();
  });

  it("asks again on a new day, and skipping it saves nothing", () => {
    seedHeavyPreview();
    seedCareDay("2026-09-11");
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );

    expect(screen.getByTestId("care-acknowledgment")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("care-note"), "typed then skipped");
    fireEvent.press(screen.getByTestId("care-skip"));

    expect(useCareNoteStore.getState().entries).toEqual([]);
    expect(useCareNoteStore.getState().careMomentShownDate).toBe(DAY);
    expect(screen.queryByTestId("care-acknowledgment")).toBeNull();
  });

  it("before the store hydrates, errs toward not asking — then asks once it lands", () => {
    seedHeavyPreview();
    seedCareDay(null, false);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );

    // Nothing is known yet about today, so the beat waits rather than
    // risking the second ask.
    expect(screen.queryByTestId("care-acknowledgment")).toBeNull();
    expect(screen.getByTestId("preview-start")).toBeTruthy();

    act(() => seedCareDay(null, true));
    expect(screen.getByTestId("care-acknowledgment")).toBeTruthy();
  });
});
