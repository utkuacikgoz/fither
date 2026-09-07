import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { useDevReceiptStore } from "../../../monetization/dev-billing";
import { hasVoiceAudio } from "../../../session/voice-manifest";
import { useCareNoteStore } from "../../../state/care-note-store";
import { useEntitlementStore } from "../../../state/entitlement-store";
import { useIdentityStore } from "../../../state/identity-store";
import { useIntentionStore } from "../../../state/intention-store";
import { usePlaceStore } from "../../../state/place-store";
import { useProfileStore } from "../../../state/profile-store";
import { useReminderStore } from "../../../state/reminder-store";
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
  SETTINGS_ROUTES,
  SettingsScreen,
} from "../settings-screen";
import { resetSettingsStores } from "./settings-test-setup";

jest.mock("../../../session/voice-manifest", () => ({
  voiceCues: {},
  voiceCue: () => null,
  hasVoiceAudio: jest.fn(() => false),
}));

// Deterministic version for the footer line, regardless of what the test
// environment's expo-constants mock carries.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.3" } },
}));

const VERSION_LINE = strings.settings.version("1.2.3");

beforeEach(async () => {
  await resetSettingsStores();
});

describe("SettingsScreen — the grouped list", () => {
  it("renders the title, profile header, four captioned groups, dev tools and the version, in order", () => {
    const screen = render(<SettingsScreen />);
    expect(screen.getByText(strings.settings.title)).toBeTruthy();
    for (const testID of [
      "settings-profile",
      "settings-training",
      "settings-invitation",
      "settings-subscription",
      "settings-account",
      "settings-dev",
    ]) {
      expect(screen.getByTestId(testID)).toBeTruthy();
    }
    const leaves = renderedTextLeaves(screen.toJSON());
    const order = [
      strings.settings.title,
      strings.settings.account.status.guest,
      strings.settings.sections.training,
      strings.place.row,
      strings.settings.avoid.title,
      strings.settings.rows.equipment,
      strings.settings.careNotes.title,
      strings.settings.reminders.title,
      strings.settings.rows.time,
      strings.intention.settingsRow,
      strings.recap.settingsRow,
      strings.settings.restore.title,
      strings.settings.rows.plan,
      strings.paywall.restore,
      strings.settings.account.title,
      // A guest (resetSettingsStores leaves no identity) gets the door
      // in, never a sign-out.
      strings.settings.account.signIn,
      strings.settings.account.erase,
      strings.settings.dev.title,
      VERSION_LINE,
    ].map((text) => leaves.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("the profile header names how she continues and the day her record began", () => {
    const guest = render(<SettingsScreen />);
    expect(guest.getByTestId("settings-account-status")).toHaveTextContent(
      strings.settings.account.status.guest,
    );
    // No history: the since-line is omitted rather than faked.
    expect(guest.queryByTestId("settings-profile-since")).toBeNull();
    guest.unmount();

    useIdentityStore.setState({ identity: { kind: "apple", date: "2026-09-01" } });
    useProfileStore.setState({
      history: {
        entries: [
          { date: "2026-09-02", minutes: 10, blocks: [] },
          { date: "2026-09-05", minutes: 20, blocks: [] },
        ],
      },
    });
    const apple = render(<SettingsScreen />);
    expect(apple.getByTestId("settings-account-status")).toHaveTextContent(
      strings.settings.account.status.apple,
    );
    expect(apple.getByTestId("settings-profile-since")).toHaveTextContent(
      strings.settings.profile.since(formatNoteDate("2026-09-02")),
    );
  });

  it("the work-around row states none, the one area's label, or a count", () => {
    const none = render(<SettingsScreen />);
    expect(none.getByTestId("settings-row-avoid-value")).toHaveTextContent(
      strings.settings.rows.avoidValue.none,
    );
    none.unmount();
    useSettingsStore.setState({ alwaysAvoid: ["wrists"] });
    const one = render(<SettingsScreen />);
    expect(one.getByTestId("settings-row-avoid-value")).toHaveTextContent(
      strings.prompt.soreness.areas.wrists,
    );
    one.unmount();
    useSettingsStore.setState({ alwaysAvoid: ["wrists", "knees", "back"] });
    const many = render(<SettingsScreen />);
    expect(many.getByTestId("settings-row-avoid-value")).toHaveTextContent(
      strings.settings.rows.avoidValue.many(3),
    );
  });

  it("the place and sessions-a-week rows state the place store's and the intention's facts", () => {
    const home = render(<SettingsScreen />);
    expect(home.getByTestId("settings-row-place-value")).toHaveTextContent(strings.place.value("home"));
    expect(home.getByTestId("settings-row-intention-value")).toHaveTextContent(
      strings.intention.settingsValue(null),
    );
    // The recap row is a door, not a setting: no value beside it.
    expect(home.queryByTestId("settings-row-recap-value")).toBeNull();
    home.unmount();
    usePlaceStore.setState({ place: "hotel" });
    useIntentionStore.setState({ target: 3 });
    const hotel = render(<SettingsScreen />);
    expect(hotel.getByTestId("settings-row-place-value")).toHaveTextContent(strings.place.value("hotel"));
    expect(hotel.getByTestId("settings-row-intention-value")).toHaveTextContent(
      strings.intention.settingsValue(3),
    );
  });

  it("the equipment, notes, time and plan rows state their stored facts flat", () => {
    useSettingsStore.setState({ equipment: ["none", "wall"] });
    useCareNoteStore.setState({
      entries: [
        { id: "a", date: "2026-08-20", text: "one" },
        { id: "b", date: "2026-09-01", text: "two" },
      ],
    });
    useReminderStore.setState({ slot: "morning" });
    useEntitlementStore.setState({ purchase: { plan: "annual", date: "2026-09-01" } });
    const screen = render(<SettingsScreen />);
    expect(screen.getByTestId("settings-row-equipment-value")).toHaveTextContent(
      strings.settings.rows.equipmentValue.floorOnly,
    );
    expect(screen.getByTestId("settings-row-notes-value")).toHaveTextContent(
      strings.settings.rows.notesValue(2),
    );
    expect(screen.getByTestId("settings-row-time-value")).toHaveTextContent(
      strings.notifications.time.morning,
    );
    expect(screen.getByTestId("settings-row-plan-value")).toHaveTextContent(
      strings.paywall.plans.annual.label,
    );
  });

  it("with nothing set, the rows say chair, no notes, off and none yet; a store trial says free week", () => {
    const screen = render(<SettingsScreen />);
    expect(screen.getByTestId("settings-row-equipment-value")).toHaveTextContent(
      strings.settings.rows.equipmentValue.chair,
    );
    expect(screen.getByTestId("settings-row-notes-value")).toHaveTextContent(
      strings.settings.rows.notesValue(0),
    );
    expect(screen.getByTestId("settings-row-time-value")).toHaveTextContent(
      strings.settings.rows.timeOff,
    );
    expect(screen.getByTestId("settings-row-plan-value")).toHaveTextContent(
      strings.settings.plan.none,
    );
    screen.unmount();
    useEntitlementStore.setState({
      purchase: { plan: "annual", date: "2026-09-01", trial: true },
    });
    const trial = render(<SettingsScreen />);
    expect(trial.getByTestId("settings-row-plan-value")).toHaveTextContent(
      strings.settings.plan.trial,
    );
  });

  it("each chevron row pushes its subpage route", () => {
    jest.mocked(hasVoiceAudio).mockReturnValue(true);
    const screen = render(<SettingsScreen />);
    const rows: Array<[string, string]> = [
      ["settings-row-place", SETTINGS_ROUTES.place],
      ["settings-row-avoid", SETTINGS_ROUTES.avoid],
      ["settings-row-equipment", SETTINGS_ROUTES.equipment],
      ["settings-row-voice", SETTINGS_ROUTES.voice],
      ["settings-row-notes", SETTINGS_ROUTES.notes],
      ["settings-row-time", SETTINGS_ROUTES.invitation],
      ["settings-row-intention", SETTINGS_ROUTES.intention],
      ["settings-row-recap", SETTINGS_ROUTES.recap],
      ["settings-row-plan", SETTINGS_ROUTES.plan],
    ];
    for (const [testID, route] of rows) {
      expect(screen.getByTestId(`${testID}-chevron`, { includeHiddenElements: true })).toBeTruthy();
      fireEvent.press(screen.getByTestId(testID));
      expect(router.push).toHaveBeenLastCalledWith(route);
    }
    expect(router.push).toHaveBeenCalledTimes(rows.length);
    jest.mocked(hasVoiceAudio).mockReturnValue(false);
  });

  it("offers the voice row only when spoken cues are actually bundled, with its state as the value", () => {
    // Constraints: a switch for silence would be a lie. The generated
    // manifest is empty until the owner runs the generator.
    const screen = render(<SettingsScreen />);
    expect(screen.queryByTestId("settings-row-voice")).toBeNull();
    screen.unmount();

    jest.mocked(hasVoiceAudio).mockReturnValue(true);
    const withAudio = render(<SettingsScreen />);
    expect(withAudio.getByTestId("settings-row-voice-value")).toHaveTextContent(
      strings.settings.voice.off,
    );
    withAudio.unmount();
    useSettingsStore.setState({ voice: true });
    const spoken = render(<SettingsScreen />);
    expect(spoken.getByTestId("settings-row-voice-value")).toHaveTextContent(
      strings.settings.voice.on,
    );
    jest.mocked(hasVoiceAudio).mockReturnValue(false);
  });

  it("restore is a plain row — no chevron — and a found receipt grants quietly", async () => {
    useDevReceiptStore.setState({ receipt: { plan: "annual", date: "2026-08-20" } });
    const screen = render(<SettingsScreen />);
    expect(
      screen.queryByTestId("settings-restore-chevron", { includeHiddenElements: true }),
    ).toBeNull();
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() =>
      expect(useEntitlementStore.getState().purchase).toMatchObject({ plan: "annual" }),
    );
    expect(screen.queryByTestId("settings-restore-error")).toBeNull();
    expect(screen.queryByTestId("settings-restore-empty")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("restore with nothing to restore says so calmly — under the row — and grants nothing", async () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() => expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy());
    expect(screen.queryByText(strings.paywall.restoreError)).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
    // Mapping: the notice lives in the group whose row it answers.
    expect(
      screen.getByTestId("settings-subscription").findByProps({ testID: "settings-restore-empty" }),
    ).toBeTruthy();
  });

  it("an actual restore failure shows the retry error, not the empty notice", async () => {
    useDevReceiptStore.setState({ hydrated: false, hydrationFailed: true });
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() => expect(screen.getByText(strings.paywall.restoreError)).toBeTruthy());
    expect(screen.queryByText(strings.paywall.restoreEmpty)).toBeNull();
    expect(useEntitlementStore.getState().purchase).toBeNull();
  });

  it("dev tools: opens the timing readout as an overlay and comes back", () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-dev-timing"));
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
    const screen = render(<SettingsScreen devToolsEnabled={false} />);
    expect(screen.queryByText(strings.settings.dev.title)).toBeNull();
    expect(screen.queryByTestId("settings-dev-timing")).toBeNull();
    expect(screen.queryByTestId("settings-dev-reset")).toBeNull();
    for (const label of Object.values(DEV_PREVIEW_LABELS)) {
      expect(screen.queryByText(label)).toBeNull();
    }
    // The user-facing groups are untouched by the flag.
    expect(screen.getByTestId("settings-training")).toBeTruthy();
    expect(screen.getByTestId("settings-subscription")).toBeTruthy();
    expect(screen.getByTestId("settings-account")).toBeTruthy();
    expect(screen.getByText(VERSION_LINE)).toBeTruthy();
  });

  it("renders no user-facing text outside strings.ts", async () => {
    const allowed = collectStringValues(strings);
    allowed.add(VERSION_LINE);
    allowed.add(DEV_TIMING_TITLE); // __DEV__-only, never shipped to users
    allowed.add(DEV_ENTITLEMENT_RESET_LABEL); // __DEV__-only
    for (const label of Object.values(DEV_PREVIEW_LABELS)) allowed.add(label);
    // Parameterised values are copy-writer functions over her own data.
    allowed.add(strings.settings.rows.notesValue(1));
    allowed.add(strings.settings.rows.avoidValue.many(2));
    allowed.add(strings.settings.profile.since(formatNoteDate("2026-09-02")));
    useCareNoteStore.setState({ entries: [{ id: "n1", date: "2026-09-01", text: "hers" }] });
    useSettingsStore.setState({ alwaysAvoid: ["wrists", "knees"] });
    useProfileStore.setState({
      history: { entries: [{ date: "2026-09-02", minutes: 10, blocks: [] }] },
    });

    jest.mocked(hasVoiceAudio).mockReturnValue(true);
    const screen = render(<SettingsScreen />);
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
    jest.mocked(hasVoiceAudio).mockReturnValue(false);

    fireEvent.press(screen.getByTestId("settings-restore"));
    await waitFor(() => expect(screen.getByText(strings.paywall.restoreEmpty)).toBeTruthy());
    fireEvent.press(screen.getByTestId("settings-erase"));
    for (const leaf of renderedTextLeaves(screen.toJSON())) {
      expect(allowed.has(leaf)).toBe(true);
    }
  });
});
