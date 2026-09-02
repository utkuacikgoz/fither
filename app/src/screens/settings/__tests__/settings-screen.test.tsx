import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { todayIso } from "../../../lib/dates";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import {
  daysBetweenIso,
  entitlementStatus,
} from "../../../monetization/entitlement";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useFirstMovementStore } from "../../../state/first-movement-store";
import { useSessionStore } from "../../../state/session-store";
import { useSettingsStore } from "../../../state/settings-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { DEV_TIMING_TITLE } from "../../dev-timing/first-movement-readout";
import { formatNoteDate } from "../care-journal";
import {
  DEV_ENTITLEMENT_RESET_LABEL,
  DEV_PREVIEW_LABELS,
  SettingsScreen,
} from "../settings-screen";

// Deterministic version for the footer line, regardless of what the test
// environment's expo-constants mock carries.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.3" } },
}));

const VERSION_LINE = strings.settings.version("1.2.3");

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({
    alwaysAvoid: [],
    hydrated: true,
    hydrationFailed: false,
  });
  useEntitlementStore.setState({
    trialStartDate: null,
    purchase: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useDevReceiptStore.setState({
    receipt: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useFirstMovementStore.setState({
    runs: [],
    hydrated: true,
    hydrationFailed: false,
  });
  useCareNoteStore.setState({
    entries: [],
    hydrated: true,
    hydrationFailed: false,
  });
  useSessionStore.setState({
    prompt: null,
    sessionId: null,
    session: null,
    player: null,
    countdownEndsAt: null,
    activeMs: 0,
    workResumedAt: null,
    pendingClose: null,
    finish: null,
    saveFailed: false,
    saving: false,
  });
});

describe("SettingsScreen", () => {
  it("renders every section in order: avoid, subscription, notes, dev tools, version", () => {
    const screen = render(<SettingsScreen />);
    expect(screen.getByText(strings.settings.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.avoid.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.avoid.body)).toBeTruthy();
    for (const label of Object.values(strings.prompt.soreness.areas)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(strings.settings.restore.title)).toBeTruthy();
    expect(screen.getByText(strings.paywall.restore)).toBeTruthy();
    expect(screen.getByText(strings.settings.careNotes.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.dev.title)).toBeTruthy();
    expect(screen.getByText(VERSION_LINE)).toBeTruthy();

    // Order as specified: each section heading above the next.
    const leaves = renderedTextLeaves(screen.toJSON());
    const order = [
      strings.settings.avoid.title,
      strings.settings.restore.title,
      strings.settings.careNotes.title,
      strings.settings.dev.title,
      VERSION_LINE,
    ].map((text) => leaves.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("toggling an avoid area shows the check and persists to the settings store", async () => {
    const screen = render(<SettingsScreen />);

    expect(screen.queryByTestId("avoid-knees-check", { includeHiddenElements: true })).toBeNull();
    fireEvent.press(screen.getByTestId("avoid-knees"));
    expect(screen.getByTestId("avoid-knees-check", { includeHiddenElements: true })).toBeTruthy();
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["knees"]);

    // Persisted immediately via the store layer (offline-safe disk write).
    await flushPersistence();
    const persisted = await AsyncStorage.getItem("fither/settings-v1");
    expect(persisted).toContain("knees");

    // Toggling off removes it — from the screen, the store and disk.
    fireEvent.press(screen.getByTestId("avoid-knees"));
    expect(screen.queryByTestId("avoid-knees-check", { includeHiddenElements: true })).toBeNull();
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    await flushPersistence();
    const cleared = await AsyncStorage.getItem("fither/settings-v1");
    expect(cleared).not.toContain("knees");
  });

  it("shows areas already on the persistent list as selected", () => {
    useSettingsStore.setState({ alwaysAvoid: ["wrists", "back"] });
    const screen = render(<SettingsScreen />);
    expect(screen.getByTestId("avoid-wrists-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("avoid-back-check", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("avoid-knees-check", { includeHiddenElements: true })).toBeNull();
  });

  it("equipment is editable (audit S6): onboarding's answer, changeable any day", async () => {
    useSettingsStore.setState({ equipment: ["none", "chair", "wall"] });
    const screen = render(<SettingsScreen />);
    // Current choice shown as selected.
    expect(screen.getByText(strings.onboarding.equipment.question)).toBeTruthy();
    fireEvent.press(screen.getByTestId("equipment-floor-only"));
    // The exact onboarding sets — wall always available on both paths.
    expect(useSettingsStore.getState().equipment).toEqual(["none", "wall"]);
    await flushPersistence();
    const persisted = await AsyncStorage.getItem("fither/settings-v1");
    expect(persisted).not.toContain("chair");
    fireEvent.press(screen.getByTestId("equipment-chair"));
    expect(useSettingsStore.getState().equipment).toEqual([
      "none",
      "chair",
      "wall",
    ]);
  });

  it("restore succeeds when the (dev) store account has a receipt — no notice", async () => {
    useDevReceiptStore.setState({
      receipt: { plan: "annual", date: "2026-08-20" },
    });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(useEntitlementStore.getState().purchase).toMatchObject({
        plan: "annual",
      }),
    );
    expect(screen.queryByTestId("settings-restore-error")).toBeNull();
    expect(screen.queryByTestId("settings-restore-empty")).toBeNull();
  });

  it("restore with nothing to restore says so calmly — not the error — and grants nothing", async () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy(),
    );
    expect(screen.queryByText(strings.paywall.restoreError)).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("an actual restore failure shows the retry error, not the empty notice", async () => {
    // The dev port's failure path: the receipt store's hydration failed.
    useDevReceiptStore.setState({ hydrated: false, hydrationFailed: true });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreError)).toBeTruthy(),
    );
    expect(screen.queryByText(strings.paywall.restoreEmpty)).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("dev tools: opens the timing readout as an overlay and comes back", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-timing"));
    // The readout replaces the screen wholesale (its title also names the
    // settings link, so presence is asserted structurally).
    expect(screen.getByTestId("dev-timing-close")).toBeTruthy();
    expect(screen.queryByText(strings.settings.title)).toBeNull();

    fireEvent.press(screen.getByTestId("dev-timing-close"));
    expect(screen.queryByTestId("dev-timing-close")).toBeNull();
    expect(screen.getByText(strings.settings.title)).toBeTruthy();
  });

  it("dev tools: resets the app-side entitlement", () => {
    useEntitlementStore.setState({
      trialStartDate: "2026-08-01",
      purchase: { plan: "annual", date: "2026-08-01" },
    });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-reset"));
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
  });

  it("renders no dev section at all in the release shape", () => {
    // Jest runs with __DEV__ true; the prop covers the release value.
    const screen = render(<SettingsScreen devToolsEnabled={false} />);
    expect(screen.queryByText(strings.settings.dev.title)).toBeNull();
    expect(screen.queryByTestId("settings-dev-timing")).toBeNull();
    expect(screen.queryByTestId("settings-dev-reset")).toBeNull();
    // The flow previewer leaks into release builds exactly as little.
    for (const label of Object.values(DEV_PREVIEW_LABELS)) {
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(screen.queryByTestId("settings-dev-paywall-expired")).toBeNull();
    expect(screen.queryByTestId("settings-dev-preview-unlock")).toBeNull();
    expect(screen.queryByTestId("settings-dev-finish-completed")).toBeNull();
    // The user-facing sections are untouched by the flag.
    expect(screen.getByText(strings.settings.avoid.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.restore.title)).toBeTruthy();
    expect(screen.getByText(strings.settings.careNotes.title)).toBeTruthy();
    expect(screen.getByText(VERSION_LINE)).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", async () => {
    const allowed = collectStringValues(strings);
    // Parameterised and dev-only values are allowed explicitly.
    allowed.add(VERSION_LINE);
    allowed.add(DEV_TIMING_TITLE); // __DEV__-only, never shipped to users
    allowed.add(DEV_ENTITLEMENT_RESET_LABEL); // __DEV__-only
    for (const label of Object.values(DEV_PREVIEW_LABELS)) {
      allowed.add(label); // __DEV__-only flow previewer
    }
    // Her own note content and its locale-formatted date are data, not copy.
    useCareNoteStore.setState({
      entries: [{ id: "n1", date: "2026-09-01", text: "her own words" }],
    });
    allowed.add("her own words");
    allowed.add(formatNoteDate("2026-09-01"));

    const screen = render(<SettingsScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }

    // The restore notices are strings.ts copy too.
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy(),
    );
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }

    // The delete confirm's copy is strings.ts too.
    fireEvent.press(screen.getByTestId("care-journal-delete-n1"));
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});

describe("SettingsScreen care journal (ADR-0012 §4)", () => {
  it("shows the empty state and the privacy fact when there are no notes", () => {
    const screen = render(<SettingsScreen />);
    expect(screen.getByTestId("care-journal-empty")).toBeTruthy();
    expect(screen.getByText(strings.settings.careNotes.empty)).toBeTruthy();
    expect(screen.getByText(strings.care.notePrivacy)).toBeTruthy();
  });

  it("lists her notes newest first, dated, with the full text unclipped", () => {
    const longText =
      "A long note about a hard week that runs on well past a single line and must render in full, never truncated behind an ellipsis.";
    useCareNoteStore.setState({
      entries: [
        { id: "a", date: "2026-08-20", text: "older note" },
        { id: "b", date: "2026-09-01", text: longText },
      ],
    });
    const screen = render(<SettingsScreen />);
    expect(screen.queryByTestId("care-journal-empty")).toBeNull();
    expect(screen.getByText("older note")).toBeTruthy();
    expect(screen.getByText(longText)).toBeTruthy();
    expect(screen.getByText(formatNoteDate("2026-08-20"))).toBeTruthy();
    expect(screen.getByText(formatNoteDate("2026-09-01"))).toBeTruthy();

    // Newest first: the September note's text renders above August's.
    const leaves = renderedTextLeaves(screen.toJSON());
    expect(leaves.indexOf(longText)).toBeLessThan(leaves.indexOf("older note"));
  });

  it("deletes only after the one calm confirm", () => {
    useCareNoteStore.setState({
      entries: [
        { id: "a", date: "2026-08-20", text: "stays" },
        { id: "b", date: "2026-09-01", text: "goes" },
      ],
    });
    const screen = render(<SettingsScreen />);

    // No confirm copy until she asks.
    expect(
      screen.queryByText(strings.settings.careNotes.deleteConfirmTitle),
    ).toBeNull();

    fireEvent.press(screen.getByTestId("care-journal-delete-b"));
    expect(
      screen.getByText(strings.settings.careNotes.deleteConfirmTitle),
    ).toBeTruthy();
    expect(
      screen.getByText(strings.settings.careNotes.deleteConfirmBody),
    ).toBeTruthy();
    // The note itself stays visible while she decides (mapping).
    expect(screen.getByText("goes")).toBeTruthy();
    // Nothing deleted yet.
    expect(useCareNoteStore.getState().entries).toHaveLength(2);

    fireEvent.press(screen.getByTestId("care-journal-confirm-delete-b"));
    expect(useCareNoteStore.getState().entries).toMatchObject([
      { id: "a", text: "stays" },
    ]);
    expect(screen.queryByText("goes")).toBeNull();
    expect(screen.getByText("stays")).toBeTruthy();
  });

  it("keep it cancels: the confirm closes and nothing is deleted", () => {
    useCareNoteStore.setState({
      entries: [{ id: "a", date: "2026-09-01", text: "precious" }],
    });
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId("care-journal-delete-a"));
    fireEvent.press(screen.getByTestId("care-journal-keep-a"));

    expect(
      screen.queryByText(strings.settings.careNotes.deleteConfirmTitle),
    ).toBeNull();
    expect(screen.getByText("precious")).toBeTruthy();
    expect(useCareNoteStore.getState().entries).toHaveLength(1);
  });

  it("legacy notes without ids still render and delete", () => {
    useCareNoteStore.setState({
      entries: [{ date: "2026-08-01", text: "from before ids" }],
    });
    const screen = render(<SettingsScreen />);
    expect(screen.getByText("from before ids")).toBeTruthy();

    fireEvent.press(screen.getByTestId("care-journal-delete-legacy-0"));
    fireEvent.press(screen.getByTestId("care-journal-confirm-delete-legacy-0"));
    expect(useCareNoteStore.getState().entries).toEqual([]);
    expect(screen.getByTestId("care-journal-empty")).toBeTruthy();
  });
});

describe("SettingsScreen dev flow previewer", () => {
  it("paywall (expired): seeds a spent trial with nothing to restore, then goes home", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-paywall-expired"));

    const { trialStartDate, purchase } = useEntitlementStore.getState();
    expect(trialStartDate).not.toBeNull();
    expect(daysBetweenIso(trialStartDate ?? "", todayIso())).toBe(8);
    expect(purchase).toBeNull();
    expect(useDevReceiptStore.getState().receipt).toBeNull();
    // The real gate will render: the seeded state IS trialExpired.
    expect(
      entitlementStatus({ trialStartDate, purchase, today: todayIso() }),
    ).toBe("trialExpired");
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("paywall (trial active): seeds a trial that started today, then goes home", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-paywall-trial-active"));

    const { trialStartDate, purchase } = useEntitlementStore.getState();
    expect(trialStartDate).toBe(todayIso());
    expect(purchase).toBeNull();
    expect(
      entitlementStatus({ trialStartDate, purchase, today: todayIso() }),
    ).toBe("trialActive");
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("reset (fresh): clears trial, purchase AND the dev receipt, then goes home", () => {
    useEntitlementStore.setState({
      trialStartDate: "2026-08-01",
      purchase: { plan: "annual", date: "2026-08-01" },
    });
    useDevReceiptStore.setState({ receipt: { plan: "annual", date: "2026-08-01" } });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-entitlement-fresh"));

    expect(useEntitlementStore.getState().trialStartDate).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
    expect(useDevReceiptStore.getState().receipt).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("preview unlock: seeds a finish summary with a real skill and pushes /unlock", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-preview-unlock"));

    const state = useSessionStore.getState();
    expect(state.finish).toMatchObject({
      completedAnything: true,
      close: { reason: "completed" },
      unlockedSkills: [
        { pattern: "push", tier: 4, movementName: "Full Push-Up" },
      ],
    });
    // /unlock's guard requires exactly this: a finish with a skill.
    expect(state.finish?.unlockedSkills.length).toBeGreaterThan(0);
    // No stale session left for the finish path to re-apply.
    expect(state.session).toBeNull();
    expect(state.player).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/unlock");
  });

  it("preview finish (complete): seeds a completed close and pushes /finish", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-finish-completed"));

    expect(useSessionStore.getState().finish).toMatchObject({
      completedAnything: true,
      close: { reason: "completed" },
      unlockedSkills: [],
    });
    expect(useSessionStore.getState().finish?.pointsEarned).toBeGreaterThan(0);
    expect(router.push).toHaveBeenCalledWith("/finish");
  });

  it("preview finish (ended early): seeds the finished-here close and pushes /finish", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-finish-ended-early"));

    expect(useSessionStore.getState().finish).toMatchObject({
      completedAnything: true,
      close: { reason: "endedEarly" },
      unlockedSkills: [],
    });
    expect(router.push).toHaveBeenCalledWith("/finish");
  });

  it("preview finish (out of time): seeds the kept-time close with minutes and pushes /finish", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-finish-out-of-time"));

    expect(useSessionStore.getState().finish).toMatchObject({
      completedAnything: true,
      close: { reason: "outOfTime", minutes: 20 },
      unlockedSkills: [],
    });
    expect(router.push).toHaveBeenCalledWith("/finish");
  });

  it("preview finish (nothing done): seeds the zero-completion close and pushes /finish", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-finish-nothing-done"));

    expect(useSessionStore.getState().finish).toMatchObject({
      completedAnything: false,
      close: { reason: "nothingDone" },
      unlockedSkills: [],
      pointsEarned: 0,
    });
    expect(router.push).toHaveBeenCalledWith("/finish");
  });
});
