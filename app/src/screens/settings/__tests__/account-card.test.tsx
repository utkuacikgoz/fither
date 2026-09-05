import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { useIdentityStore } from "../../../state/identity-store";
import { hydratedStores } from "../../../state/persisted-stores";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";
import { AccountCard } from "../account-card";

const copy = strings.settings.account;

beforeEach(async () => {
  await AsyncStorage.clear();
  for (const store of hydratedStores) {
    store.setState({ hydrated: true, hydrationFailed: false });
  }
  useIdentityStore.setState({ identity: null });
});

function renderCard() {
  return render(<AccountCard order={0} reduceMotion />);
}

describe("account card", () => {
  it("names how she is continuing, with the guest state as a peer", () => {
    const guest = renderCard();
    expect(guest.getByTestId("settings-account-status")).toHaveTextContent(copy.status.guest);
    guest.unmount();

    useIdentityStore.setState({ identity: { kind: "apple", date: "2026-09-01" } });
    const apple = renderCard();
    expect(apple.getByTestId("settings-account-status")).toHaveTextContent(copy.status.apple);
    expect(apple.getByText(copy.signOutNote)).toBeTruthy();
  });

  it("sign out clears the identity, keeps her training, and returns to the launch surface", async () => {
    useIdentityStore.setState({ identity: { kind: "apple", date: "2026-09-01" } });
    useSettingsStore.getState().completeOnboarding(["none"], []);
    const view = renderCard();
    fireEvent.press(view.getByTestId("settings-sign-out"));
    await waitFor(() => expect(useIdentityStore.getState().identity).toBeNull());
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("erase asks in the card first, and keeping it changes nothing", () => {
    useIdentityStore.setState({ identity: { kind: "guest", date: "2026-09-01" } });
    const view = renderCard();
    expect(view.queryByTestId("settings-erase-confirm")).toBeNull();
    fireEvent.press(view.getByTestId("settings-erase"));
    expect(view.getByText(copy.eraseConfirmTitle)).toBeTruthy();
    expect(view.getByText(copy.eraseConfirmBody)).toBeTruthy();
    // The sign-out row is out of the way while the question is open.
    expect(view.queryByTestId("settings-sign-out")).toBeNull();
    fireEvent.press(view.getByTestId("settings-erase-keep"));
    expect(view.queryByTestId("settings-erase-confirm")).toBeNull();
    expect(useIdentityStore.getState().identity).not.toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("confirming erases everything and returns to the launch surface", async () => {
    useIdentityStore.setState({ identity: { kind: "guest", date: "2026-09-01" } });
    useSettingsStore.getState().completeOnboarding(["none"], ["wrists"]);
    useProfileStore.setState({
      history: {
        entries: [
          {
            date: "2026-08-01",
            minutes: 10,
            blocks: [{ movementId: "plank", pattern: "core", outcome: "completed" }],
          },
        ],
      },
    });
    const view = renderCard();
    fireEvent.press(view.getByTestId("settings-erase"));
    fireEvent.press(view.getByTestId("settings-erase-confirm-action"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(useIdentityStore.getState().identity).toBeNull();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
    expect(useProfileStore.getState().history.entries).toEqual([]);
  });
});
