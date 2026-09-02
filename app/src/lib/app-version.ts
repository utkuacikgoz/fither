import Constants from "expo-constants";

/**
 * The app's marketing version, read from the expo app config
 * (app.json → expo.version). Null when the config carries none — the
 * settings footer simply omits the line rather than showing a fake.
 */
export function appVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === "string" && version.length > 0 ? version : null;
}
