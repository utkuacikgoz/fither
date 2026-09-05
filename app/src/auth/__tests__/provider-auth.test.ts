import * as AppleAuthentication from "expo-apple-authentication";

import { providerAuth } from "../provider-auth";

// The real providers behind the port: Apple live, Google not offered,
// no name and no email ever requested (ADR-0011 §6).

const mocked = AppleAuthentication as unknown as {
  isAvailableAsync: jest.Mock;
  signInAsync: jest.Mock;
  getCredentialStateAsync: jest.Mock;
};

it("offers Apple where the platform has it, and never Google without an adapter", async () => {
  expect(await providerAuth.availableProviders()).toEqual(["apple"]);
  mocked.isAvailableAsync.mockResolvedValueOnce(false);
  expect(await providerAuth.availableProviders()).toEqual([]);
  expect(await providerAuth.signInWithGoogle()).toEqual({ ok: false, reason: "failed" });
});

it("signs in with no scopes and keeps only the opaque user id", async () => {
  const outcome = await providerAuth.signInWithApple();
  expect(mocked.signInAsync).toHaveBeenCalledWith({ requestedScopes: [] });
  expect(outcome.ok).toBe(true);
  if (outcome.ok) {
    expect(outcome.identity.kind).toBe("apple");
    expect(outcome.identity.providerUserId).toBe("apple-user-1");
    expect(Object.keys(outcome.identity).sort()).toEqual(["date", "kind", "providerUserId"]);
  }
});

it("dismissing the sheet is 'cancelled'; anything else is 'failed'", async () => {
  mocked.signInAsync.mockRejectedValueOnce({ code: "ERR_REQUEST_CANCELED" });
  expect(await providerAuth.signInWithApple()).toEqual({ ok: false, reason: "cancelled" });
  mocked.signInAsync.mockRejectedValueOnce(new Error("no network"));
  expect(await providerAuth.signInWithApple()).toEqual({ ok: false, reason: "failed" });
});

it("notices a revoked or missing credential, and treats unknown as still signed in", async () => {
  const identity = { kind: "apple" as const, date: "2026-09-05", providerUserId: "apple-user-1" };
  mocked.getCredentialStateAsync.mockResolvedValueOnce(0); // REVOKED
  expect(await providerAuth.checkRevoked(identity)).toBe(true);
  mocked.getCredentialStateAsync.mockResolvedValueOnce(2); // NOT_FOUND
  expect(await providerAuth.checkRevoked(identity)).toBe(true);
  mocked.getCredentialStateAsync.mockResolvedValueOnce(1); // AUTHORIZED
  expect(await providerAuth.checkRevoked(identity)).toBe(false);
  mocked.getCredentialStateAsync.mockRejectedValueOnce(new Error("offline"));
  expect(await providerAuth.checkRevoked(identity)).toBe(false);
  // Guest and legacy records have nothing to revoke.
  expect(await providerAuth.checkRevoked({ kind: "guest", date: "2026-09-05" })).toBe(false);
});
