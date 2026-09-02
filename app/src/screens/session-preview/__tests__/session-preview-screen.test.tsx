import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { createPlayer } from "../../../session/player-machine";
import { useSessionStore } from "../../../state/session-store";
import {
  fixturePlayerBlocks,
  fixturePrompt,
  fixtureSession,
} from "../../../test-utils/fixtures";
import { SessionPreviewScreen } from "../session-preview-screen";

describe("SessionPreviewScreen", () => {
  function seedPreview(adaptations = fixtureSession.adaptations) {
    useSessionStore.setState({
      prompt: fixturePrompt,
      session: { ...fixtureSession, adaptations },
      player: createPlayer(fixturePlayerBlocks),
      finish: null,
    });
  }

  it("shows the engine's adaptation before movement begins", () => {
    seedPreview([{ kind: "lowEnergy" }]);
    const onStart = jest.fn();
    const screen = render(
      <SessionPreviewScreen onStart={onStart} onChangeAnswers={jest.fn()} />,
    );

    expect(screen.getByText(strings.preview.headline)).toBeTruthy();
    expect(screen.getByText(strings.preview.adaptations.lowEnergy)).toBeTruthy();
    fireEvent.press(screen.getByTestId("preview-start"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("uses a quiet default line when no adaptation changed the session", () => {
    seedPreview();
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );
    expect(screen.getByText(strings.preview.defaultFit)).toBeTruthy();
  });

  it("shows the actual block contract with one primary adaptation", () => {
    seedPreview([{ kind: "lowEnergy" }, { kind: "staleFocus", pattern: "push" }]);
    const screen = render(
      <SessionPreviewScreen onStart={jest.fn()} onChangeAnswers={jest.fn()} />,
    );

    expect(screen.getByText(strings.preview.planTitle)).toBeTruthy();
    expect(screen.getByText("Wall Push-Up")).toBeTruthy();
    expect(screen.getByText("Plank")).toBeTruthy();
    expect(screen.getByText(strings.player.blockPlan(2, 8, false))).toBeTruthy();
    expect(screen.getByText(strings.preview.adaptations.lowEnergy)).toBeTruthy();
    expect(screen.queryByText(strings.preview.adaptations.staleFocus)).toBeNull();
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
});
