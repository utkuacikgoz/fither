import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { Share, Text } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { HistoryEntry } from "@fither/engine";

import { clearRecordedEvents, recordedEvents } from "../../../analytics/dev-analytics";
import { strings } from "../../../copy/strings";
import { WORDMARK } from "../../../design/primitives/wordmark";
import { glyph } from "../../../design/tokens";
import { todayIso } from "../../../lib/dates";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useIntentionStore } from "../../../state/intention-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { ShareScreen } from "../share-screen";

const ENV = "EXPO_PUBLIC_SHARE_BASE_URL";
const TODAY = todayIso();
const hidden = { includeHiddenElements: true } as const;

function entry(
  date: string,
  outcomes: Array<"completed" | "struggled" | "skipped">,
  minutes: 10 | 20 | 30 = 10,
): HistoryEntry {
  const ids = ["wall-push-up", "plank", "air-squat"];
  return {
    date,
    minutes,
    blocks: outcomes.map((outcome, i) => ({
      movementId: ids[i] ?? `movement-${i}`,
      pattern: "push",
      outcome,
    })),
  };
}

/** Today: three blocks, one skipped — two movements attempted, ten minutes. */
function seedToday() {
  useProfileStore.setState({
    history: { entries: [entry(TODAY, ["completed", "struggled", "skipped"], 10)] },
    hydrated: true,
    hydrationFailed: false,
  });
}

async function flushShare() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const PLAIN = strings.share.context.card.headline(null, 10);
const TWO_MOVEMENTS = strings.share.context.card.sub(2);

/**
 * Everything strings.ts can say on this screen: its literals plus the
 * card's generated lines (functions are skipped by collectStringValues).
 */
function allowedText(): Set<string> {
  const allowed = collectStringValues(strings);
  allowed.add(WORDMARK);
  // The selected row's check is a token glyph, not copy (tokens.ts).
  allowed.add(glyph.check);
  const { card } = strings.share.context;
  for (const context of ["home", "hotel", "meetings", null] as const) {
    for (const minutes of [10, 20, 30]) allowed.add(card.headline(context, minutes));
  }
  for (let n = 0; n <= 5; n++) {
    allowed.add(card.sub(n));
    allowed.add(card.week(n));
  }
  return allowed;
}

let shareSpy: jest.SpyInstance;

beforeEach(() => {
  delete process.env[ENV];
  clearRecordedEvents();
  seedToday();
  useIntentionStore.setState({ target: null, asked: true, hydrated: true });
  useSettingsStore.setState({ alwaysAvoid: [], hydrated: true, hydrationFailed: false });
  useCareNoteStore.setState({ entries: [], hydrated: true, hydrationFailed: false });
  shareSpy = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: Share.sharedAction });
});

afterAll(() => {
  delete process.env[ENV];
});

describe("ShareScreen", () => {
  describe("renders per source", () => {
    it.each(["finish", "receipt"] as const)(
      "%s: today's session as the plain card, the question, three rows, Share this and Not now",
      (source) => {
        const screen = render(<ShareScreen source={source} />);
        expect(screen.getByTestId("share-card")).toBeTruthy();
        expect(screen.getByText(PLAIN)).toBeTruthy();
        expect(screen.getByText(TWO_MOVEMENTS)).toBeTruthy();
        expect(screen.getByTestId("share-card-figure", hidden)).toBeTruthy();
        expect(screen.getByText(WORDMARK)).toBeTruthy();
        expect(screen.getByText(strings.share.context.question)).toBeTruthy();
        expect(screen.getByTestId("share-context-home")).toBeTruthy();
        expect(screen.getByTestId("share-context-hotel")).toBeTruthy();
        expect(screen.getByTestId("share-context-meetings")).toBeTruthy();
        expect(screen.getByText(strings.share.context.home)).toBeTruthy();
        expect(screen.getByText(strings.share.context.hotel)).toBeTruthy();
        expect(screen.getByText(strings.share.context.meetings)).toBeTruthy();
        // Three rows, not four: skip is not a row on this screen.
        expect(screen.queryByText(strings.share.context.skip)).toBeNull();
        expect(screen.getByTestId("share-send")).toBeTruthy();
        expect(screen.getByText(strings.share.action)).toBeTruthy();
        expect(screen.getByTestId("share-not-now")).toBeTruthy();
        expect(screen.getByText(strings.share.context.notNow)).toBeTruthy();
      },
    );

    it("recap: the week's count, in the recap's own words, over the week's movements", () => {
      useProfileStore.setState({
        history: {
          entries: [entry(TODAY, ["completed"], 10), entry(TODAY, ["completed", "completed"], 20)],
        },
      });
      const screen = render(<ShareScreen source="recap" />);
      expect(screen.getByText(strings.share.context.card.week(2))).toBeTruthy();
      expect(screen.getByText(strings.recap.headline(2))).toBeTruthy();
      expect(screen.getByText(strings.share.context.card.sub(3))).toBeTruthy();
      expect(screen.queryByText(PLAIN)).toBeNull();
    });

    it("an explicit date shows that day's session", () => {
      useProfileStore.setState({
        history: { entries: [entry("2026-01-05", ["completed"], 30), entry(TODAY, ["completed"], 10)] },
      });
      const screen = render(<ShareScreen source="receipt" date="2026-01-05" />);
      expect(screen.getByText(strings.share.context.card.headline(null, 30))).toBeTruthy();
    });

    it("a date with no entry shows the plain week card safely, and still shares", async () => {
      const screen = render(<ShareScreen source="receipt" date="2020-02-02" />);
      expect(screen.getByTestId("share-card")).toBeTruthy();
      expect(screen.getByText(strings.share.context.card.week(1))).toBeTruthy();
      expect(screen.queryByText(PLAIN)).toBeNull();
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(shareSpy).toHaveBeenCalledTimes(1);
    });

    it("no history at all is a quiet week, never a crash or an invented session", () => {
      useProfileStore.setState({ history: { entries: [] } });
      const screen = render(<ShareScreen source="finish" />);
      expect(screen.getByText(strings.share.context.card.week(0))).toBeTruthy();
      expect(screen.getByText(strings.share.context.card.sub(0))).toBeTruthy();
      expect(screen.queryByTestId("share-card-figure", hidden)).toBeNull();
    });
  });

  describe("the context rows", () => {
    it("switch the headline: one selected at a time, the same tap clears it", () => {
      const screen = render(<ShareScreen source="finish" />);
      expect(screen.getByTestId("share-card-headline").props.children).toBe(PLAIN);

      fireEvent.press(screen.getByTestId("share-context-hotel"));
      expect(screen.getByTestId("share-card-headline").props.children).toBe(
        strings.share.context.card.headline("hotel", 10),
      );
      expect(screen.getByTestId("share-context-hotel").props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId("share-context-hotel-check", hidden)).toBeTruthy();

      fireEvent.press(screen.getByTestId("share-context-meetings"));
      expect(screen.getByTestId("share-card-headline").props.children).toBe(
        strings.share.context.card.headline("meetings", 10),
      );
      expect(screen.getByTestId("share-context-hotel").props.accessibilityState.selected).toBe(false);
      expect(screen.queryByTestId("share-context-hotel-check", hidden)).toBeNull();

      fireEvent.press(screen.getByTestId("share-context-home"));
      expect(screen.getByTestId("share-card-headline").props.children).toBe(
        strings.share.context.card.headline("home", 10),
      );

      fireEvent.press(screen.getByTestId("share-context-home"));
      expect(screen.getByTestId("share-card-headline").props.children).toBe(PLAIN);
    });

    it("on a recap the week line stays; the context is recorded, not written", () => {
      const screen = render(<ShareScreen source="recap" />);
      fireEvent.press(screen.getByTestId("share-context-hotel"));
      expect(screen.getByText(strings.share.context.card.week(1))).toBeTruthy();
      fireEvent.press(screen.getByTestId("share-send"));
      expect(recordedEvents()).toEqual([
        { name: "share_start", properties: { source: "recap", context: "hotel" } },
      ]);
    });
  });

  describe("sharing", () => {
    it("sends the captured PNG and the message with the session link", async () => {
      process.env[ENV] = "https://fither.app";
      const screen = render(<ShareScreen source="finish" />);
      fireEvent.press(screen.getByTestId("share-context-hotel"));
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(captureRef).toHaveBeenCalledTimes(1);
      expect(jest.mocked(captureRef).mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({ format: "png" }),
      );
      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith({
        url: "file:///tmp/skill-card.png",
        message: strings.share.context.message("https://fither.app/s/session"),
      });
      // The file goes through the one sheet that carries text beside it.
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    it("a recap links to the week page; the chosen context does not change the path", async () => {
      process.env[ENV] = "https://fither.app";
      const screen = render(<ShareScreen source="recap" />);
      fireEvent.press(screen.getByTestId("share-context-meetings"));
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(shareSpy).toHaveBeenCalledWith({
        url: "file:///tmp/skill-card.png",
        message: strings.share.context.message("https://fither.app/s/week"),
      });
    });

    it("falls back to the text alone when the capture fails", async () => {
      process.env[ENV] = "https://fither.app";
      jest.mocked(captureRef).mockRejectedValueOnce(new Error("no surface"));
      const screen = render(<ShareScreen source="receipt" />);
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(shareSpy).toHaveBeenCalledWith({
        message: strings.share.context.message("https://fither.app/s/session"),
      });
    });

    it("with no destination configured there is no URL anywhere: the card line is the whole message", async () => {
      const screen = render(<ShareScreen source="finish" />);
      expect(screen.queryByTestId("share-card-host")).toBeNull();
      fireEvent.press(screen.getByTestId("share-context-hotel"));
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      const headline = strings.share.context.card.headline("hotel", 10);
      expect(shareSpy).toHaveBeenCalledWith({
        url: "file:///tmp/skill-card.png",
        message: headline,
      });
      const sent = String(shareSpy.mock.calls[0]?.[0]?.message);
      expect(sent).not.toMatch(/https?:\/\//);
      expect(sent).not.toContain("/s/");
      for (const leaf of renderedTextLeaves(screen.toJSON())) {
        expect(leaf).not.toMatch(/https?:\/\//);
        expect(leaf).not.toContain("fither.app");
      }
    });

    it("prints the public host on the card when one is configured", () => {
      process.env[ENV] = "https://fither.app";
      const screen = render(<ShareScreen source="finish" />);
      expect(screen.getByTestId("share-card-host").props.children).toBe("fither.app");
      expect(screen.queryByText("https://fither.app")).toBeNull();
    });

    it("a dismissed sheet is not an error: nothing changes, she can share again", async () => {
      shareSpy.mockResolvedValue({ action: Share.dismissedAction });
      const screen = render(<ShareScreen source="finish" />);
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(screen.getByText(PLAIN)).toBeTruthy();
      expect(screen.getByTestId("share-send")).toBeTruthy();
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(shareSpy).toHaveBeenCalledTimes(2);
    });

    it("a share failure stays quiet: nothing user-facing, no crash", async () => {
      jest.mocked(captureRef).mockRejectedValueOnce(new Error("no surface"));
      shareSpy.mockRejectedValue(new Error("sheet unavailable"));
      const screen = render(<ShareScreen source="finish" />);
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(screen.getByText(PLAIN)).toBeTruthy();
      const allowed = allowedText();
      for (const leaf of renderedTextLeaves(screen.toJSON())) {
        expect(allowed.has(leaf) ? true : leaf).toBe(true);
      }
    });

    it("one sheet at a time: a double tap starts one capture and one event", async () => {
      const screen = render(<ShareScreen source="finish" />);
      fireEvent.press(screen.getByTestId("share-send"));
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(captureRef).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(recordedEvents().map((e) => e.name)).toEqual(["share_start", "share_complete"]);
    });

    it("Not now goes back", () => {
      const screen = render(<ShareScreen source="receipt" />);
      fireEvent.press(screen.getByTestId("share-not-now"));
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(shareSpy).not.toHaveBeenCalled();
      expect(recordedEvents()).toEqual([]);
    });
  });

  describe("events", () => {
    it("share_start carries the source and the chosen context, nothing else", async () => {
      const screen = render(<ShareScreen source="finish" />);
      fireEvent.press(screen.getByTestId("share-context-meetings"));
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(recordedEvents()).toEqual([
        { name: "share_start", properties: { source: "finish", context: "meetings" } },
        { name: "share_complete", properties: { completed: true } },
      ]);
    });

    it("share_complete: a picked destination is completed, a dismissed sheet is not, a sheet that never opened says nothing", async () => {
      shareSpy.mockResolvedValueOnce({ action: Share.dismissedAction });
      const screen = render(<ShareScreen source="receipt" />);
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(recordedEvents().filter((e) => e.name === "share_complete")).toEqual([
        { name: "share_complete", properties: { completed: false } },
      ]);

      clearRecordedEvents();
      shareSpy.mockRejectedValueOnce(new Error("sheet unavailable"));
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();
      expect(recordedEvents().map((e) => e.name)).toEqual(["share_start"]);
    });

    it("context is none when no row was chosen; rendering and choosing send nothing", () => {
      const screen = render(<ShareScreen source="receipt" />);
      fireEvent.press(screen.getByTestId("share-context-home"));
      fireEvent.press(screen.getByTestId("share-context-home"));
      expect(recordedEvents()).toEqual([]);
      fireEvent.press(screen.getByTestId("share-send"));
      expect(recordedEvents()).toEqual([
        { name: "share_start", properties: { source: "receipt", context: "none" } },
      ]);
    });
  });

  describe("what never leaves the phone", () => {
    it("nothing about her restrictions or her notes is on the card, in the text or in the event", async () => {
      process.env[ENV] = "https://fither.app";
      const note = "Knee felt sharp on the lunge, stopped early.";
      useSettingsStore.setState({ alwaysAvoid: ["knees", "back"] });
      useCareNoteStore.setState({ entries: [{ id: "n1", date: TODAY, text: note }] });
      const screen = render(<ShareScreen source="finish" />);
      fireEvent.press(screen.getByTestId("share-context-home"));
      fireEvent.press(screen.getByTestId("share-send"));
      await flushShare();

      const areaWords = Object.values(strings.prompt.soreness.areas).map((w) => w.toLowerCase());
      const forbidden = [...areaWords, note.toLowerCase(), "knee", "back"];
      const cardText = screen
        .getByTestId("share-card")
        .findAllByType(Text)
        .map((text) => String(text.props.children))
        .join(" ")
        .toLowerCase();
      const screenText = renderedTextLeaves(screen.toJSON()).join(" ").toLowerCase();
      const sentText = String(shareSpy.mock.calls[0]?.[0]?.message).toLowerCase();
      for (const word of forbidden) {
        expect(cardText).not.toContain(word);
        expect(screenText).not.toContain(word);
        expect(sentText).not.toContain(word);
      }
      const [event] = recordedEvents();
      expect(event).toEqual({
        name: "share_start",
        properties: { source: "finish", context: "home" },
      });
      expect(Object.keys(event?.properties ?? {}).sort()).toEqual(["context", "source"]);
    });
  });

  it("renders no user-facing text outside strings.ts, except the public host", () => {
    process.env[ENV] = "https://fither.app";
    const allowed = allowedText();
    allowed.add("fither.app");
    for (const source of ["finish", "receipt", "recap"] as const) {
      const screen = render(<ShareScreen source={source} />);
      fireEvent.press(screen.getByTestId("share-context-hotel"));
      for (const leaf of renderedTextLeaves(screen.toJSON())) {
        expect(allowed.has(leaf) ? true : leaf).toBe(true);
      }
      screen.unmount();
    }
  });
});
