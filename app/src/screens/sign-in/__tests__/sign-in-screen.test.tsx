import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { useDevAuthSessionStore } from "../../../auth/dev-auth";
import { strings } from "../../../copy/strings";
import { useIdentityStore } from "../../../state/identity-store";
import {
  collectStringValues,
  renderedTextLeaves,
} from "../../../test-utils/copy-audit";
import { WORDMARK } from "../../../design/primitives/wordmark";
import { SignInScreen } from "../sign-in-screen";

// The one first-run decision (ADR-0011): three options with equal
// dignity, guest one tap and infallible, honest notes about what an
// account does, and a calm error path that always leaves guest open.

beforeEach(() => {
  useIdentityStore.setState({
    identity: null,
    hydrated: true,
    hydrationFailed: false,
  });
  useDevAuthSessionStore.setState({
    session: null,
    hydrated: true,
    hydrationFailed: false,
  });
});

it("renders all three ways to continue, with the honest notes", async () => {
  const screen = render(<SignInScreen />);
  expect(screen.getByText(strings.auth.welcome)).toBeTruthy();
  expect(screen.getByText(strings.auth.apple)).toBeTruthy();
  // Provider buttons render once the port says which adapters exist;
  // the dev port offers both.
  expect(await screen.findByText(strings.auth.google)).toBeTruthy();
  expect(screen.getByText(strings.auth.guest)).toBeTruthy();
  expect(screen.getByText(strings.auth.accountNote)).toBeTruthy();
  expect(screen.getByText(strings.auth.guestNote)).toBeTruthy();
  // No error copy before anything went wrong.
  expect(screen.queryByText(strings.auth.error)).toBeNull();
});

it.each([
  ["sign-in-apple", "apple"],
  ["sign-in-google", "google"],
  ["sign-in-guest", "guest"],
] as const)("%s lands the %s identity and calls onDone", async (testID, kind) => {
  const onDone = jest.fn();
  const screen = render(<SignInScreen onDone={onDone} />);
  fireEvent.press(await screen.findByTestId(testID));
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(useIdentityStore.getState().identity?.kind).toBe(kind);
});

it("a failed provider sign-in shows the calm error and keeps guest open", async () => {
  // The dev port's stand-in for a provider failure.
  useDevAuthSessionStore.setState({ hydrated: false, hydrationFailed: true });
  const onDone = jest.fn();
  const screen = render(<SignInScreen onDone={onDone} />);
  fireEvent.press(screen.getByTestId("sign-in-apple"));
  await waitFor(() => expect(screen.getByTestId("sign-in-error")).toBeTruthy());
  expect(onDone).not.toHaveBeenCalled();
  expect(useIdentityStore.getState().identity).toBeNull();

  // Guest never fails (ADR-0011): the error clears and she continues.
  fireEvent.press(screen.getByTestId("sign-in-guest"));
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(useIdentityStore.getState().identity?.kind).toBe("guest");
});

it("an in-flight sign-in shows pending on the tapped option and quiets the rest (audit S9)", async () => {
  // Keep the dev port's session store unsettled so the sign-in stays
  // in flight until we release it — the stand-in for provider latency.
  useDevAuthSessionStore.setState({ hydrated: false, hydrationFailed: false });
  const onDone = jest.fn();
  const screen = render(<SignInScreen onDone={onDone} />);
  fireEvent.press(screen.getByTestId("sign-in-apple"));
  await waitFor(() =>
    expect(
      screen.getByTestId("sign-in-apple").props.accessibilityState.busy,
    ).toBe(true),
  );
  expect(
    screen.getByTestId("sign-in-google").props.accessibilityState.disabled,
  ).toBe(true);
  expect(
    screen.getByTestId("sign-in-guest").props.accessibilityState.disabled,
  ).toBe(true);
  // Release the port: the sign-in completes and the states clear.
  useDevAuthSessionStore.setState({ hydrated: true });
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
});

it("every rendered string comes from strings.ts", () => {
  const allowed = collectStringValues(strings);
  allowed.add(WORDMARK);
  const screen = render(<SignInScreen />);
  for (const leaf of renderedTextLeaves(screen.toJSON())) {
    expect(allowed.has(leaf) ? true : leaf).toBe(true);
  }
});

it("offers only the providers the port has adapters for — never a button that would fake success", async () => {
  const { getAuth } = jest.requireActual<typeof import("../../../auth/auth")>("../../../auth/auth");
  const spy = jest.spyOn(getAuth(), "availableProviders").mockResolvedValue(["apple"]);
  const screen = render(<SignInScreen onDone={jest.fn()} />);
  await waitFor(() => expect(screen.queryByTestId("sign-in-google")).toBeNull());
  expect(screen.getByTestId("sign-in-apple")).toBeTruthy();
  expect(screen.getByTestId("sign-in-guest")).toBeTruthy();
  spy.mockRestore();
});

it("dismissing the provider's sheet is not an error — the screen simply stays", async () => {
  const { getAuth } = jest.requireActual<typeof import("../../../auth/auth")>("../../../auth/auth");
  const spy = jest
    .spyOn(getAuth(), "signInWithApple")
    .mockResolvedValue({ ok: false, reason: "cancelled" });
  const onDone = jest.fn();
  const screen = render(<SignInScreen onDone={onDone} />);
  fireEvent.press(screen.getByTestId("sign-in-apple"));
  await waitFor(() =>
    expect(screen.getByTestId("sign-in-apple").props.accessibilityState.busy).toBe(false),
  );
  expect(screen.queryByTestId("sign-in-error")).toBeNull();
  expect(onDone).not.toHaveBeenCalled();
  expect(useIdentityStore.getState().identity).toBeNull();
  spy.mockRestore();
});
