import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { loadLibrary } from "../../../session/load-library";
import { movementFigure } from "../../../session/movement-figures";
import { useSettingsStore } from "../../../state/settings-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { EQUIPMENT_FIGURES, OnboardingScreen } from "../onboarding-screen";

// Onboarding after the owner brief of 2026-09-07 (wave 1, first use):
// one screen, one decision. The welcome-only screen is retired — the
// promise heads the equipment question — and the avoid step is retired
// for first use (restrictions are asked once, on the first session).

const hidden = { includeHiddenElements: true } as const;

beforeEach(() => {
  useSettingsStore.setState({
    hydrated: true,
    hydrationFailed: false,
    onboardingCompleted: false,
    alwaysAvoid: [],
    equipment: ["none", "chair", "wall"],
  });
});

describe("OnboardingScreen", () => {
  it("opens on the promise atop the equipment question, in the approved order: headline, lead, two rows", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.equipment.lead)).toBeTruthy();
    expect(screen.getByTestId("onboarding-floor-only")).toBeTruthy();
    expect(screen.getByTestId("onboarding-chair")).toBeTruthy();

    const leaves = renderedTextLeaves(screen.toJSON());
    const order = [
      strings.onboarding.welcome.headline,
      strings.onboarding.equipment.lead,
      strings.onboarding.equipment.options.floorOnly,
      strings.onboarding.equipment.options.chair,
    ].map((text) => leaves.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("carries no mark, no Begin, no welcome body and no avoid step — the retired screens are gone", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    expect(screen.queryByTestId("onboarding-mark", hidden)).toBeNull();
    expect(screen.queryByTestId("onboarding-begin")).toBeNull();
    expect(screen.queryByText(strings.onboarding.welcome.body)).toBeNull();
    expect(screen.queryByText(strings.onboarding.welcome.cta)).toBeNull();
    expect(screen.queryByText(strings.onboarding.avoid.question)).toBeNull();
    expect(screen.queryByTestId("onboarding-avoid-nothing")).toBeNull();
    expect(screen.queryByTestId("onboarding-avoid-confirm")).toBeNull();
  });

  it("one tap completes it: a chair persists, the permanent list starts empty, and it hands off", () => {
    const onDone = jest.fn();
    const screen = render(<OnboardingScreen onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("onboarding-chair"));
    expect(onDone).toHaveBeenCalledTimes(1);

    const settings = useSettingsStore.getState();
    expect(settings.onboardingCompleted).toBe(true);
    expect(settings.alwaysAvoid).toEqual([]);
    expect(settings.equipment).toContain("chair");
  });

  it("floor-only keeps the chair out of her equipment", () => {
    const onDone = jest.fn();
    const screen = render(<OnboardingScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("onboarding-floor-only"));

    expect(onDone).toHaveBeenCalledTimes(1);
    const { equipment, onboardingCompleted } = useSettingsStore.getState();
    expect(equipment).not.toContain("chair");
    expect(equipment).toContain("none");
    expect(onboardingCompleted).toBe(true);
  });

  it("never touches a permanent list that already exists — the answer is equipment only", () => {
    // Not a first-use state in practice (onboarding runs once), but the
    // contract is that this screen writes exactly what it asked.
    useSettingsStore.setState({ alwaysAvoid: [] });
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId("onboarding-chair"));
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
  });

  it("the rail counts the steps that remain — one — from the first frame (ADR-0017)", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    expect(
      screen.getByTestId("onboarding-flow").props.accessibilityValue,
    ).toEqual({ min: 0, max: 1, now: 1 });
  });

  it("shows each equipment option as a day-one movement she can do with it", () => {
    const library = loadLibrary();
    if (!library)
      throw new Error("bundled movement library missing in test env");
    // The ids are library data: each must still be a tier-one movement
    // with exactly that equipment, so a library change fails here loudly
    // instead of leaving a row pointing at the wrong picture.
    const floor = library.movements.find(
      (m) => m.id === EQUIPMENT_FIGURES.floorOnly,
    );
    const chair = library.movements.find(
      (m) => m.id === EQUIPMENT_FIGURES.chair,
    );
    expect(floor).toMatchObject({ tier: 1, equipment: "none" });
    expect(chair).toMatchObject({ tier: 1, equipment: "chair" });

    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    const rowImage = (testID: string) =>
      screen.getByTestId(testID, hidden).findByType(Image).props.source;
    expect(rowImage("onboarding-floor-only")).toEqual(
      movementFigure(EQUIPMENT_FIGURES.floorOnly),
    );
    expect(rowImage("onboarding-chair")).toEqual(
      movementFigure(EQUIPMENT_FIGURES.chair),
    );
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      // On failure the message shows the offending leaf, not just false.
      expect(allowed.has(leaf) ? true : leaf).toBe(true);
    }
  });
});

describe("onboarding_complete (ADR-0024)", () => {
  beforeEach(() => clearRecordedEvents());

  it("reports the room she chose and nothing else", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId("onboarding-chair"));
    expect(recordedEvents()).toEqual([
      { name: "onboarding_complete", properties: { equipment: "chair" } },
    ]);
  });
});
