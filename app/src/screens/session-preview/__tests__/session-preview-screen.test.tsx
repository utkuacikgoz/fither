import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import { useSessionStore } from "../../../state/session-store";
import { fixtureSession } from "../../../test-utils/fixtures";
import { SessionPreviewScreen } from "../session-preview-screen";

describe("SessionPreviewScreen", () => {
  it("shows the engine's adaptation before movement begins", () => {
    useSessionStore.setState({
      session: {
        ...fixtureSession,
        adaptations: [{ kind: "lowEnergy" }],
      },
    });
    const onStart = jest.fn();
    const screen = render(<SessionPreviewScreen onStart={onStart} />);

    expect(screen.getByText(strings.preview.headline)).toBeTruthy();
    expect(screen.getByText(strings.preview.adaptations.lowEnergy)).toBeTruthy();
    fireEvent.press(screen.getByTestId("preview-start"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("uses a quiet default line when no adaptation changed the session", () => {
    useSessionStore.setState({ session: fixtureSession });
    const screen = render(<SessionPreviewScreen onStart={jest.fn()} />);
    expect(screen.getByText(strings.preview.defaultFit)).toBeTruthy();
  });
});
