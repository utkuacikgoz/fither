import AsyncStorage from "@react-native-async-storage/async-storage";

import { hasVoiceAudio } from "../../session/voice-manifest";
import { useSettingsStore, voiceAskDue } from "../settings-store";

jest.mock("../../session/voice-manifest", () => ({ hasVoiceAudio: jest.fn(() => true) }));
const mockedHasVoiceAudio = jest.mocked(hasVoiceAudio);

// The settings store's persistent avoid-list setters. `setAlwaysAvoid`
// is the first session's "Remember for every session" (owner brief
// 2026-09-07): it replaces the list wholesale and persists through the
// store layer, offline, like every other setting.

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({
    alwaysAvoid: [],
    onboardingCompleted: false,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("setAlwaysAvoid", () => {
  it("replaces the permanent list wholesale and touches nothing else", () => {
    useSettingsStore.getState().completeOnboarding(["none", "wall"], []);
    useSettingsStore.getState().setAlwaysAvoid(["knees", "back"]);
    const state = useSettingsStore.getState();
    expect(state.alwaysAvoid).toEqual(["knees", "back"]);
    expect(state.equipment).toEqual(["none", "wall"]);
    expect(state.onboardingCompleted).toBe(true);
  });

  it("persists to disk so a relaunch keeps the list", async () => {
    useSettingsStore.getState().setAlwaysAvoid(["wrists"]);
    await flushPersistence();
    const raw = await AsyncStorage.getItem("fither/settings-v1");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as { state: { alwaysAvoid: string[] } };
    expect(persisted.state.alwaysAvoid).toEqual(["wrists"]);
  });

  it("composes with the settings editor's toggle afterwards", () => {
    useSettingsStore.getState().setAlwaysAvoid(["knees"]);
    useSettingsStore.getState().toggleAlwaysAvoid("knees");
    expect(useSettingsStore.getState().alwaysAvoid).toEqual([]);
    useSettingsStore.getState().toggleAlwaysAvoid("hips");
    expect(useSettingsStore.getState().alwaysAvoid).toEqual(["hips"]);
  });
});

describe("the one voice ask (owner decision 2026-09-08)", () => {
  beforeEach(() => {
    mockedHasVoiceAudio.mockReturnValue(true);
    useSettingsStore.setState({ voice: false, voiceAsked: false, hydrated: true });
  });

  it("is owed once: hydrated, unanswered, and a voice bundled", () => {
    expect(voiceAskDue()).toBe(true);
    useSettingsStore.getState().answerVoiceAsk(true);
    expect(voiceAskDue()).toBe(false);
  });

  it("either answer spends the ask and is the real voice setting", () => {
    useSettingsStore.getState().answerVoiceAsk(false);
    expect(useSettingsStore.getState()).toMatchObject({ voice: false, voiceAsked: true });
    useSettingsStore.setState({ voiceAsked: false });
    useSettingsStore.getState().answerVoiceAsk(true);
    expect(useSettingsStore.getState()).toMatchObject({ voice: true, voiceAsked: true });
  });

  it("fails safe: no ask before hydration, none without bundled audio", () => {
    useSettingsStore.setState({ hydrated: false });
    expect(voiceAskDue()).toBe(false);
    useSettingsStore.setState({ hydrated: true });
    mockedHasVoiceAudio.mockReturnValue(false);
    expect(voiceAskDue()).toBe(false);
  });

  it("persists the answer so a relaunch never asks again", async () => {
    useSettingsStore.getState().answerVoiceAsk(true);
    await flushPersistence();
    const raw = await AsyncStorage.getItem("fither/settings-v1");
    const persisted = JSON.parse(raw as string) as { state: { voice: boolean; voiceAsked: boolean } };
    expect(persisted.state).toMatchObject({ voice: true, voiceAsked: true });
  });
});
