import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { strings } from "../../../copy/strings";
import type { FirstMovementRun } from "../../../lib/first-movement-timer";
import { devPersistedKeys } from "../../../state/dev-reset";
import { useFirstMovementStore } from "../../../state/first-movement-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import {
  DEV_FIRST_RUN_RESET_CAPTION,
  DEV_FIRST_RUN_RESET_CONFIRM_LABEL,
  DEV_FIRST_RUN_RESET_DONE,
  DEV_FIRST_RUN_RESET_LABEL,
  DEV_TIMING_CLOSE_LABEL,
  DEV_TIMING_EMPTY,
  DEV_TIMING_FIRST_RUN_CAPTION,
  DEV_TIMING_NO_FIRST_RUN,
  DEV_TIMING_RESET_LABEL,
  DEV_TIMING_TITLE,
  devRunLine,
  FirstMovementReadout,
} from "../first-movement-readout";

// Epoch-ms fixtures only — no real clocks. t0 values are arbitrary but
// distinct so run lines and ordering are assertable.
const firstRun: FirstMovementRun = {
  t0: 1_756_700_000_000,
  t1: 1_756_700_042_500,
  deltaMs: 42_500,
  firstRun: true,
};
const laterRun: FirstMovementRun = {
  t0: 1_756_790_000_000,
  t1: 1_756_790_018_200,
  deltaMs: 18_200,
  firstRun: false,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useFirstMovementStore.setState({
    runs: [],
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("FirstMovementReadout (__DEV__ only)", () => {
  it("shows the first-run delta prominently, in seconds, plus every launch", () => {
    useFirstMovementStore.setState({ runs: [firstRun, laterRun] });
    const screen = render(<FirstMovementReadout onClose={jest.fn()} />);

    expect(screen.getByTestId("dev-timing-first-run").props.children).toBe(
      "42.5s",
    );
    const lines = screen
      .getAllByTestId("dev-timing-run")
      .map((node) => node.props.children as string);
    // Newest first; each launch labelled.
    expect(lines).toEqual([devRunLine(laterRun), devRunLine(firstRun)]);
    expect(lines[0]).toContain("18.2s");
    expect(lines[0]).toContain("later launch");
    expect(lines[1]).toContain("42.5s");
    expect(lines[1]).toContain("first run");
  });

  it("says so plainly when nothing is recorded yet", () => {
    const screen = render(<FirstMovementReadout onClose={jest.fn()} />);
    expect(screen.getByTestId("dev-timing-first-run-missing")).toBeTruthy();
    expect(screen.getByText(DEV_TIMING_EMPTY)).toBeTruthy();
  });

  it("shows later launches even when no first run was captured", () => {
    useFirstMovementStore.setState({ runs: [laterRun] });
    const screen = render(<FirstMovementReadout onClose={jest.fn()} />);
    expect(screen.getByText(DEV_TIMING_NO_FIRST_RUN)).toBeTruthy();
    expect(screen.getAllByTestId("dev-timing-run")).toHaveLength(1);
  });

  it("the dev reset clears the recordings for the next Gate 3 tester", () => {
    useFirstMovementStore.setState({ runs: [firstRun, laterRun] });
    const screen = render(<FirstMovementReadout onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId("dev-timing-reset"));
    expect(useFirstMovementStore.getState().runs).toEqual([]);
    expect(screen.getByText(DEV_TIMING_EMPTY)).toBeTruthy();
  });

  it("the full first-run reset needs two taps: arming alone wipes nothing", async () => {
    await AsyncStorage.setItem("fither/settings-v1", '{"x":1}');
    const screen = render(<FirstMovementReadout onClose={jest.fn()} />);

    expect(screen.getByText(DEV_FIRST_RUN_RESET_CAPTION)).toBeTruthy();
    expect(screen.queryByTestId("dev-first-run-reset-confirm")).toBeNull();

    fireEvent.press(screen.getByTestId("dev-first-run-reset"));
    expect(screen.getByTestId("dev-first-run-reset-confirm")).toBeTruthy();
    expect(await AsyncStorage.getItem("fither/settings-v1")).toBe('{"x":1}');

    // Tapping the arm control again disarms instead of wiping.
    fireEvent.press(screen.getByTestId("dev-first-run-reset"));
    expect(screen.queryByTestId("dev-first-run-reset-confirm")).toBeNull();
    expect(await AsyncStorage.getItem("fither/settings-v1")).toBe('{"x":1}');
  });

  it("confirming wipes every persisted key and says to kill and relaunch", async () => {
    for (const key of devPersistedKeys()) {
      await AsyncStorage.setItem(key, '{"seeded":true}');
    }
    const screen = render(<FirstMovementReadout onClose={jest.fn()} />);

    fireEvent.press(screen.getByTestId("dev-first-run-reset"));
    fireEvent.press(screen.getByTestId("dev-first-run-reset-confirm"));

    await waitFor(() =>
      expect(screen.getByTestId("dev-first-run-reset-done")).toBeTruthy(),
    );
    expect(screen.getByText(DEV_FIRST_RUN_RESET_DONE)).toBeTruthy();
    for (const key of devPersistedKeys()) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
    // Once done, the controls are gone — no accidental second wipe cycle.
    expect(screen.queryByTestId("dev-first-run-reset")).toBeNull();
    expect(screen.queryByTestId("dev-first-run-reset-confirm")).toBeNull();
  });

  it("close hands back to the caller", () => {
    const onClose = jest.fn();
    const screen = render(<FirstMovementReadout onClose={onClose} />);
    fireEvent.press(screen.getByTestId("dev-timing-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders no user-facing text outside strings.ts", () => {
    const allowed = collectStringValues(strings);
    // __DEV__-only labels and lines, never shipped to users — the same
    // allowlist pattern as the paywall's DEV_RESET_LABEL.
    allowed.add(DEV_TIMING_TITLE);
    allowed.add(DEV_TIMING_FIRST_RUN_CAPTION);
    allowed.add(DEV_TIMING_NO_FIRST_RUN);
    allowed.add(DEV_TIMING_EMPTY);
    allowed.add(DEV_TIMING_RESET_LABEL);
    allowed.add(DEV_TIMING_CLOSE_LABEL);
    allowed.add(DEV_FIRST_RUN_RESET_CAPTION);
    allowed.add(DEV_FIRST_RUN_RESET_LABEL);
    allowed.add(DEV_FIRST_RUN_RESET_CONFIRM_LABEL);
    allowed.add(DEV_FIRST_RUN_RESET_DONE);
    allowed.add(devRunLine(firstRun));
    allowed.add(devRunLine(laterRun));
    allowed.add("42.5s"); // the prominent numeral is derived, dev-only data

    useFirstMovementStore.setState({ runs: [firstRun, laterRun] });
    const screen = render(<FirstMovementReadout onClose={jest.fn()} />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
