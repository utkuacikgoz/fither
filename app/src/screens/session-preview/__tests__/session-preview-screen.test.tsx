import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { toPlayerBlocks } from "../../../session/create-session";
import { loadLibrary } from "../../../session/load-library";
import { createPlayer } from "../../../session/player-machine";
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
