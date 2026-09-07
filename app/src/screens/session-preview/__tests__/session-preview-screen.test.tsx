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

    expect(screen.getByText(strings.preview.headline)).toBeTruthy();
    expect(screen.getByText(strings.preview.factsTitle)).toBeTruthy();
    expect(screen.getByTestId("preview-fit")).toBeTruthy();
    expect(screen.getByText(facts.minutes(10, 2))).toBeTruthy();
    expect(screen.getByText(facts.lowEnergy)).toBeTruthy();
    // The old single line and the headline's summary are gone: one count.
    expect(screen.queryByText(strings.preview.adaptations.lowEnergy)).toBeNull();
    expect(screen.queryByText(strings.preview.summary(10, 2))).toBeNull();
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
    expect(screen.getByText(facts.minutes(10, 2))).toBeTruthy();
    expect(screen.getByText(facts.quiet)).toBeTruthy();
    expect(screen.getByText(facts.floorOnly)).toBeTruthy();
    expect(screen.queryByText(strings.preview.defaultFit)).toBeNull();
    expect(screen.queryByText(facts.lowEnergy)).toBeNull();
    expect(screen.queryByTestId("preview-fact-3")).toBeNull();
  });

  it("changing an answer changes the explanation", () => {
    seedPreview([{ kind: "soreness", areas: ["knees"] }]);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    expect(screen.getByText(facts.avoid("knees"))).toBeTruthy();

    // The store drives the screen: a new session re-renders it in place.
    act(() => seedPreview([]));
    expect(screen.queryByText(facts.avoid("knees"))).toBeNull();
  });

  it("shows the actual block contract with every adaptation the engine reported", () => {
    seedPreview([{ kind: "lowEnergy" }, { kind: "staleFocus", pattern: "push" }]);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );

    expect(screen.getByText(strings.preview.planTitle)).toBeTruthy();
    expect(screen.getByText("Wall Push-Up")).toBeTruthy();
    expect(screen.getByText("Plank")).toBeTruthy();
    expect(screen.getByText(strings.player.blockPlan(2, 8, false))).toBeTruthy();
    expect(screen.getByText(facts.lowEnergy)).toBeTruthy();
    expect(screen.getByText(facts.staleFocus("push"))).toBeTruthy();
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
