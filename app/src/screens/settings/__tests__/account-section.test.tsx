import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { darkColors } from "../../../design/tokens";
import { useIdentityStore } from "../../../state/identity-store";
import { useProfileStore } from "../../../state/profile-store";
import { useSettingsStore } from "../../../state/settings-store";
import { AccountSection } from "../account-section";
import { resetSettingsStores } from "./settings-test-setup";

const copy = strings.settings.account;

beforeEach(async () => {
  await resetSettingsStores();
});

function renderSection() {
  return render(<AccountSection order={0} reduceMotion />);
}

function flatStyle(node: { props: Record<string, unknown> }): Record<string, unknown> {
  const style = node.props.style as Array<Record<string, unknown> | null | undefined>;
  return Object.assign({}, ...(Array.isArray(style) ? style : [style]).filter(Boolean));
}

describe("account section", () => {
  it("for a guest: feedback opens its page, Sign in with Apple opens the pushed sign-in route, erase in the danger colour — and no sign-out", () => {
    useIdentityStore.setState({ identity: { kind: "guest", date: "2026-09-01" } });
    const view = renderSection();
    expect(view.getByText(copy.title)).toBeTruthy();
    // Dev builds always carry the feedback row (in-memory adapter).
    expect(view.getByText(strings.feedback.row)).toBeTruthy();
    expect(view.getByTestId("settings-feedback-chevron", { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(view.getByTestId("settings-feedback"));
    expect(router.push).toHaveBeenCalledWith("/settings/feedback");

    // The door in: a row that navigates, so it wears a chevron.
    expect(view.getByText(copy.signIn)).toBeTruthy();
    expect(view.getByTestId("settings-sign-in-chevron", { includeHiddenElements: true })).toBeTruthy();
    expect(flatStyle(view.getByText(copy.signIn)).color).toBe(darkColors.ink);
    fireEvent.press(view.getByTestId("settings-sign-in"));
    expect(router.push).toHaveBeenCalledWith("/sign-in");

    // A guest has nothing to sign out of.
    expect(view.queryByTestId("settings-sign-out")).toBeNull();
    expect(view.queryByText(copy.signOut)).toBeNull();
    // No lead line: the group has no slot for one (signInLead unused).
    expect(view.queryByText(copy.signInLead)).toBeNull();

    expect(flatStyle(view.getByText(copy.erase)).color).toBe(darkColors.danger);
    expect(view.queryByTestId("settings-erase-chevron", { includeHiddenElements: true })).toBeNull();
  });

  it("with no identity yet (a fresh guest still landing) the door in is offered, never sign-out", () => {
    // resetSettingsStores leaves identity null.
    const view = renderSection();
    expect(view.getByTestId("settings-sign-in")).toBeTruthy();
    expect(view.queryByTestId("settings-sign-out")).toBeNull();
  });

  it("signed in with Apple: sign out plain, no sign-in row, erase in the danger colour", () => {
    useIdentityStore.setState({ identity: { kind: "apple", date: "2026-09-01" } });
    const view = renderSection();
    expect(view.getByTestId("settings-sign-out")).toBeTruthy();
    expect(flatStyle(view.getByText(copy.signOut)).color).toBe(darkColors.ink);
    expect(view.queryByTestId("settings-sign-in")).toBeNull();
    expect(view.queryByText(copy.signIn)).toBeNull();
    expect(flatStyle(view.getByText(copy.erase)).color).toBe(darkColors.danger);
    // Neither action row navigates: no chevrons.
    expect(view.queryByTestId("settings-sign-out-chevron", { includeHiddenElements: true })).toBeNull();
    expect(view.queryByTestId("settings-erase-chevron", { includeHiddenElements: true })).toBeNull();
  });

  it("sign out clears the identity, keeps her training, and returns to the launch surface", async () => {
    useIdentityStore.setState({ identity: { kind: "apple", date: "2026-09-01" } });
    useSettingsStore.getState().completeOnboarding(["none"], []);
    const view = renderSection();
    fireEvent.press(view.getByTestId("settings-sign-out"));
    await waitFor(() => expect(useIdentityStore.getState().identity).toBeNull());
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("erase asks inline first — the rows give way to the confirm — and keeping it changes nothing", () => {
    useIdentityStore.setState({ identity: { kind: "guest", date: "2026-09-01" } });
    const view = renderSection();
    expect(view.queryByTestId("settings-erase-confirm")).toBeNull();
    fireEvent.press(view.getByTestId("settings-erase"));
    expect(view.getByText(copy.eraseConfirmTitle)).toBeTruthy();
    expect(view.getByText(copy.eraseConfirmBody)).toBeTruthy();
    // The confirm panel wears the danger hairline; the destructive action
    // is the quiet one and in the danger colour, "Keep it" the filled one.
    expect(flatStyle(view.getByTestId("settings-erase-confirm")).borderColor).toBe(
      darkColors.danger,
    );
    expect(flatStyle(view.getByText(copy.eraseAction)).color).toBe(darkColors.danger);
    expect(view.getByTestId("settings-erase-keep")).toBeTruthy();
    // The rows are out of the way while the question is open.
    expect(view.queryByTestId("settings-sign-in")).toBeNull();
    expect(view.queryByTestId("settings-erase")).toBeNull();
    fireEvent.press(view.getByTestId("settings-erase-keep"));
    expect(view.queryByTestId("settings-erase-confirm")).toBeNull();
    expect(view.getByTestId("settings-sign-in")).toBeTruthy();
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
    const view = renderSection();
    fireEvent.press(view.getByTestId("settings-erase"));
    fireEvent.press(view.getByTestId("settings-erase-confirm-action"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(useIdentityStore.getState().identity).toBeNull();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
    expect(useProfileStore.getState().history.entries).toEqual([]);
  });
});
