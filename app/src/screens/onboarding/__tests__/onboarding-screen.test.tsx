import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";

import { strings } from "../../../copy/strings";
import { loadLibrary } from "../../../session/load-library";
import { movementFigure } from "../../../session/movement-figures";
import { useSettingsStore } from "../../../state/settings-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { glyph } from "../../../design/tokens";
import { EQUIPMENT_FIGURES, OnboardingScreen } from "../onboarding-screen";

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
  it("walks the three drafted screens, one decision each, auto-advancing", () => {
    const onDone = jest.fn();
    const screen = render(<OnboardingScreen onDone={onDone} />);

    expect(screen.getByText(strings.onboarding.welcome.headline)).toBeTruthy();
    expect(screen.getByText(strings.onboarding.welcome.body)).toBeTruthy();

    fireEvent.press(screen.getByTestId("onboarding-begin"));
    expect(
      screen.getByText(strings.onboarding.equipment.question),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("onboarding-chair"));
    expect(screen.getByText(strings.onboarding.avoid.question)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    // "Nothing" is the one-tap default path.
    fireEvent.press(screen.getByTestId("onboarding-avoid-nothing"));
    expect(onDone).toHaveBeenCalledTimes(1);

    const settings = useSettingsStore.getState();
    expect(settings.onboardingCompleted).toBe(true);
    expect(settings.alwaysAvoid).toEqual([]);
    expect(settings.equipment).toContain("chair");
  });

  it("floor-only keeps the chair out of her equipment", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    fireEvent.press(screen.getByTestId("onboarding-floor-only"));
    fireEvent.press(screen.getByTestId("onboarding-avoid-nothing"));

    const { equipment } = useSettingsStore.getState();
    expect(equipment).not.toContain("chair");
    expect(equipment).toContain("none");
  });

  it("persists picked avoid areas as the permanent work-around list", () => {
    const onDone = jest.fn();
    const screen = render(<OnboardingScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    fireEvent.press(screen.getByTestId("onboarding-chair"));

    fireEvent.press(screen.getByTestId("onboarding-avoid-knees"));
    fireEvent.press(screen.getByTestId("onboarding-avoid-back"));
    // Deselecting works before confirming.
    fireEvent.press(screen.getByTestId("onboarding-avoid-back"));
    fireEvent.press(screen.getByTestId("onboarding-avoid-confirm"));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["knees"]);
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
  });

  it("hides 'All good' once an area is picked, so picks can't be silently discarded", () => {
    // Mirrors the daily prompt's soreness step exactly (audit S5): same
    // constraint, same question, one behaviour.
    const onDone = jest.fn();
    const screen = render(<OnboardingScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    fireEvent.press(screen.getByTestId("onboarding-chair"));

    expect(screen.getByTestId("onboarding-avoid-nothing")).toBeTruthy();

    fireEvent.press(screen.getByTestId("onboarding-avoid-knees"));
    // The discard path no longer exists while anything is selected.
    expect(screen.queryByTestId("onboarding-avoid-nothing")).toBeNull();
    expect(screen.queryByText(strings.prompt.soreness.allGood)).toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    // Deselecting the last area brings the one-tap default back.
    fireEvent.press(screen.getByTestId("onboarding-avoid-knees"));
    expect(screen.getByTestId("onboarding-avoid-nothing")).toBeTruthy();
  });

  it("confirm renders only with picks, labelled from strings.ts", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    fireEvent.press(screen.getByTestId("onboarding-chair"));

    expect(screen.queryByTestId("onboarding-avoid-confirm")).toBeNull();

    fireEvent.press(screen.getByTestId("onboarding-avoid-hips"));
    // The action-naming label (audit S10) — asserted through its key, so
    // the copy-writer's surface stays the single source of the words.
    expect(screen.getByText(strings.onboarding.avoid.confirm)).toBeTruthy();
  });

  it("opens on the drawn mark — the welcome is the brand moment, and Begin waits for nothing", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    expect(screen.getByTestId("onboarding-mark", hidden)).toBeTruthy();
    // Gate 3: the choreography is above the button, never in front of it.
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    expect(
      screen.getByText(strings.onboarding.equipment.question),
    ).toBeTruthy();
  });

  it("counts its two questions, and only those — the welcome is a landing", () => {
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);
    expect(screen.queryByTestId("onboarding-flow")).toBeNull();

    fireEvent.press(screen.getByTestId("onboarding-begin"));
    expect(
      screen.getByTestId("onboarding-flow").props.accessibilityValue,
    ).toEqual({ min: 1, max: 2, now: 1 });
    fireEvent.press(screen.getByTestId("onboarding-chair"));
    expect(
      screen.getByTestId("onboarding-flow").props.accessibilityValue.now,
    ).toBe(2);
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
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    const rowImage = (testID: string) =>
      screen.getByTestId(testID, hidden).findByType(Image).props.source;
    expect(rowImage("onboarding-floor-only")).toEqual(
      movementFigure(EQUIPMENT_FIGURES.floorOnly),
    );
    expect(rowImage("onboarding-chair")).toEqual(
      movementFigure(EQUIPMENT_FIGURES.chair),
    );
  });

  it("renders no user-facing text outside strings.ts on any step", () => {
    const allowed = collectStringValues(strings);
    // areasNoted is parameterised; allowlist the output this flow renders.
    allowed.add(strings.prompt.soreness.areasNoted(1));
    // The selection checkmark is a glyph token, not copy.
    allowed.add(glyph.check);
    const screen = render(<OnboardingScreen onDone={jest.fn()} />);

    const auditStep = () => {
      for (const leaf of renderedTextLeaves(screen.toJSON())) {
        // On failure the message shows the offending leaf, not just false.
        expect(allowed.has(leaf) ? true : leaf).toBe(true);
      }
    };

    auditStep();
    fireEvent.press(screen.getByTestId("onboarding-begin"));
    auditStep();
    fireEvent.press(screen.getByTestId("onboarding-chair"));
    fireEvent.press(screen.getByTestId("onboarding-avoid-hips"));
    auditStep();
  });
});
