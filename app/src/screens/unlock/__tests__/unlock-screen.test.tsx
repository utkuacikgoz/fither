import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Share } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { strings } from "../../../copy/strings";
import { useSessionStore } from "../../../state/session-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { WORDMARK } from "../skill-share-card";
import { UnlockScreen } from "../unlock-screen";

const SKILL = { pattern: "push", tier: 4, movementName: "Full Push-Up" } as const;
const SECOND = { pattern: "squat", tier: 4, movementName: "Deep Squat" } as const;

function seedUnlock() {
  useSessionStore.setState({
    finish: { pointsEarned: 35, unlockedSkills: [SKILL], completedAnything: true },
  });
}

function seedTwoUnlocks() {
  useSessionStore.setState({
    finish: {
      pointsEarned: 85,
      completedAnything: true,
      unlockedSkills: [SKILL, SECOND],
    },
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

  it("shares the card itself: captured as rendered, handed to the sheet as a PNG", async () => {
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    fireEvent.press(screen.getByTestId("unlock-share-push-4-share"));
    await flushShare();
    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///tmp/skill-card.png",
      expect.objectContaining({ mimeType: "image/png" }),
    );
    // The image is the share; the v1 sentence is not sent alongside it.
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("falls back to the v1 text share when the capture fails", async () => {
    jest.mocked(captureRef).mockRejectedValueOnce(new Error("no surface"));
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    fireEvent.press(screen.getByTestId("unlock-share-push-4-share"));
    await flushShare();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(shareSpy).toHaveBeenCalledWith({
      message: strings.share.message(SKILL.movementName),
    });
  });

  it("falls back to text when the file sheet is unavailable on this device", async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
    const screen = render(<UnlockScreen onContinue={jest.fn()} />);
    fireEvent.press(screen.getByTestId("unlock-share-push-4-share"));
    await flushShare();
    expect(captureRef).not.toHaveBeenCalled();
    expect(shareSpy).toHaveBeenCalledTimes(1);
  });

  it("a dismissed sheet is not an error — the screen stays exactly as it was", async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
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
    // Both sheets fail: the image path AND its text fallback.
    jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error("sheet"));
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

  // Sequencing (2026-09-02 audit): about half of unlock sessions award
  // more than one skill, so the screen celebrates one at a time —
  // Continue advances through them; only the last Continue leaves.
  describe("two-skill sequence", () => {
    it("celebrates the first skill alone — the second waits its turn", () => {
      seedTwoUnlocks();
      const screen = render(<UnlockScreen onContinue={jest.fn()} />);
      // The full moment for skill one: huge name plus its card preview.
      expect(screen.getAllByText(SKILL.movementName)).toHaveLength(2);
      expect(screen.getByTestId("unlock-share-push-4")).toBeTruthy();
      // Skill two is nowhere on screen yet — each gets its own moment.
      expect(screen.queryByText(SECOND.movementName)).toBeNull();
      expect(screen.queryByTestId("unlock-share-squat-4")).toBeNull();
    });

    it("Continue advances to the second skill's full moment instead of leaving", () => {
      seedTwoUnlocks();
      const onContinue = jest.fn();
      const screen = render(<UnlockScreen onContinue={onContinue} />);
      fireEvent.press(screen.getByTestId("unlock-continue"));
      expect(onContinue).not.toHaveBeenCalled();
      // Skill two now gets the identical full moment, alone.
      expect(screen.getByText(strings.unlock.heading)).toBeTruthy();
      expect(screen.getAllByText(SECOND.movementName)).toHaveLength(2);
      expect(screen.getByText(strings.unlock.note)).toBeTruthy();
      expect(screen.getByTestId("unlock-share-squat-4")).toBeTruthy();
      expect(screen.queryByText(SKILL.movementName)).toBeNull();
      expect(screen.queryByTestId("unlock-share-push-4")).toBeNull();
    });

    it("the final Continue leaves, exactly once", () => {
      seedTwoUnlocks();
      const onContinue = jest.fn();
      const screen = render(<UnlockScreen onContinue={onContinue} />);
      fireEvent.press(screen.getByTestId("unlock-continue"));
      fireEvent.press(screen.getByTestId("unlock-continue"));
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it("shares stay per-skill: skill one before continuing, skill two after", async () => {
      seedTwoUnlocks();
      const screen = render(<UnlockScreen onContinue={jest.fn()} />);
      fireEvent.press(screen.getByTestId("unlock-share-push-4-share"));
      await flushShare();
      expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
      fireEvent.press(screen.getByTestId("unlock-continue"));
      fireEvent.press(screen.getByTestId("unlock-share-squat-4-share"));
      await flushShare();
      // Each skill's own card is captured — two captures, two shares.
      expect(captureRef).toHaveBeenCalledTimes(2);
      expect(Sharing.shareAsync).toHaveBeenCalledTimes(2);
      // And the text fallback still names the right skill if it is needed.
      jest.mocked(captureRef).mockRejectedValueOnce(new Error("no surface"));
      fireEvent.press(screen.getByTestId("unlock-share-squat-4-share"));
      await flushShare();
      expect(shareSpy).toHaveBeenLastCalledWith({
        message: strings.share.message(SECOND.movementName),
      });
    });

    it("renders no user-facing text outside strings.ts at either step", () => {
      seedTwoUnlocks();
      const allowed = collectStringValues(strings);
      allowed.add(SKILL.movementName);
      allowed.add(SECOND.movementName);
      allowed.add(WORDMARK);

      const screen = render(<UnlockScreen onContinue={jest.fn()} />);
      for (const leaf of renderedTextLeaves(screen.toJSON())) {
        expect(allowed.has(leaf)).toBe(true);
      }
      fireEvent.press(screen.getByTestId("unlock-continue"));
      for (const leaf of renderedTextLeaves(screen.toJSON())) {
        expect(allowed.has(leaf)).toBe(true);
      }
    });
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
