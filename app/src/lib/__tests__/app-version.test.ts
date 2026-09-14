import Constants from "expo-constants";

import { appVersion } from "../app-version";

// The footer's version is the one TestFlight shows, build number and
// all, so a phone can say which upload it runs.

jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: {} } }));

function config(value: unknown): void {
  (Constants as { expoConfig: unknown }).expoConfig = value;
}

it("reads the version with the build number in brackets", () => {
  config({ version: "1.0.0", ios: { buildNumber: "5" } });
  expect(appVersion()).toBe("1.0.0 (5)");
});

it("is the bare version without a build number, and null without a version", () => {
  config({ version: "1.0.0" });
  expect(appVersion()).toBe("1.0.0");
  config({ ios: { buildNumber: "5" } });
  expect(appVersion()).toBeNull();
  config(undefined);
  expect(appVersion()).toBeNull();
});
