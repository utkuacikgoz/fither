import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Share } from "react-native";

import { strings } from "../../../copy/strings";
import { useSessionStore } from "../../../state/session-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { WORDMARK } from "../skill-share-card";
import { UnlockScreen } from "../unlock-screen";

const SKILL = { pattern: "push", tier: 4, movementName: "Full Push-Up" } as const;

function seedUnlock() {
  useSessionStore.setState({
    finish: { pointsEarned: 35, unlockedSkills: [SKILL] },
  });
}

async function flushShare() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let shareSpy: jest.SpyInstance;

beforeEach(() => {
  seedUnlock();
  shareSpy = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: Share.sharedAction });
});

describe("UnlockScreen", () => {
  it("shows the skill huge and the shareable card: name, line, wordmark, share action", () => {
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    expect(screen.getByText(strings.unlock.heading)).toBeTruthy();
    // The skill name appears twice on purpose: the huge unlock moment,
    // and again on the card — the card is a preview of what she shares.
    expect(screen.getAllByText(SKILL.movementName)).toHaveLength(2);
    expect(screen.getByText(strings.unlock.note)).toBeTruthy();
    expect(screen.getByTestId("unlock-share-push-4")).toBeTruthy();
    expect(screen.getByText(strings.share.card.line)).toBeTruthy();
    expect(screen.getByText(WORDMARK)).toBeTruthy();
    expect(screen.getByText(strings.share.action)).toBeTruthy();
  });

  it("shares the skill message through the system sheet", () => {
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    fireEvent.press(screen.getByTestId("unlock-share-push-4-share"));
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith({
      message: strings.share.message(SKILL.movementName),
    });
  });

  it("a dismissed sheet is not an error — the screen stays exactly as it was", async () => {
    shareSpy.mockResolvedValue({ action: Share.dismissedAction });
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    fireEvent.press(screen.getByTestId("unlock-share-push-4-share"));
    await flushShare();
    // No error copy of any kind appears; she can share again or continue.
    for (const errorText of Object.values(strings.errors)) {
      expect(screen.queryByText(errorText)).toBeNull();
    }
    expect(screen.getByTestId("unlock-share-push-4-share")).toBeTruthy();
    expect(screen.getByTestId("unlock-continue")).toBeTruthy();
  });

  it("a share failure stays quiet — nothing user-facing, no crash", async () => {
    shareSpy.mockRejectedValue(new Error("sheet unavailable"));
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    fireEvent.press(screen.getByTestId("unlock-share-push-4-share"));
    await flushShare();
    for (const errorText of Object.values(strings.errors)) {
      expect(screen.queryByText(errorText)).toBeNull();
    }
    expect(screen.getByText(strings.unlock.note)).toBeTruthy();
  });

  it("continues via the single primary button", () => {
    const onContinue = jest.fn();
    const screen = render(<UnlockScreen onContinue={onContinue} />);
    fireEvent.press(screen.getByTestId("unlock-continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("renders one card per unlocked skill", () => {
    useSessionStore.setState({
      finish: {
        pointsEarned: 60,
        unlockedSkills: [
          SKILL,
          { pattern: "squat", tier: 4, movementName: "Deep Squat" },
        ],
      },
    });
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    expect(screen.getByTestId("unlock-share-push-4")).toBeTruthy();
    expect(screen.getByTestId("unlock-share-squat-4")).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    // Engine-sourced skill name and the brand mark are allowed explicitly.
    allowed.add(SKILL.movementName);
    allowed.add(WORDMARK);

    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
