import { Linking } from "react-native";

export const LEGAL_URLS = {
  terms: "https://fither.app/terms",
  privacy: "https://fither.app/privacy",
} as const;

/** Open a fixed first-party legal page. A platform failure stays quiet. */
export async function openLegalPage(page: keyof typeof LEGAL_URLS): Promise<void> {
  try {
    await Linking.openURL(LEGAL_URLS[page]);
  } catch {
    // The tap is never allowed to break the purchase screen.
  }
}
