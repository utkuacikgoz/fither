import Constants from "expo-constants";

/**
 * The app's version as TestFlight and the store name it: the marketing
 * version with the build number in brackets ("1.0.0 (5)"), both read
 * from the expo app config (app.json → expo.version, expo.ios.buildNumber).
 * The build number is what tells one upload from the next, so the
 * settings footer carries it (owner, 2026-09-14). Null when the config
 * carries no version — the footer omits the line rather than showing a
 * fake; a missing build number leaves just the version.
 */
export function appVersion(): string | null {
  const version = Constants.expoConfig?.version;
  if (typeof version !== "string" || version.length === 0) return null;
  const build = Constants.expoConfig?.ios?.buildNumber;
  return typeof build === "string" && build.length > 0 ? `${version} (${build})` : version;
}
