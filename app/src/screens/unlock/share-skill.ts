import type { RefObject } from "react";
import { Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { strings } from "../../copy/strings";

// Sharing the skill (owner direction, 2026-09-04: the image export the
// v1 text share always reserved room for). The card she sees IS the
// artifact: it is captured as rendered — theme-fixed light tokens, so it
// looks the same wherever it lands — and handed to the system sheet as
// a PNG. Every way this can fail falls back to the v1 text share, so
// her proudest screen never meets a dead end: the sheet is the feedback
// either way, and a dismissed sheet is not an error.
//
// Nothing here touches the network: the file is written locally by the
// capture and read by the sheet.

export interface ShareSkillOptions {
  skillName: string;
  /** The rendered card to capture; null when it has not mounted. */
  card: RefObject<View | null> | null;
}

/** The v1 share: the sentence, through the system sheet. */
async function shareText(skillName: string): Promise<void> {
  await Share.share({ message: strings.share.message(skillName) });
}

export async function shareSkill({ skillName, card }: ShareSkillOptions): Promise<void> {
  try {
    if (card?.current && (await Sharing.isAvailableAsync())) {
      const uri = await captureRef(card, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
      return;
    }
  } catch {
    // The capture or the sheet did not open — fall through to text.
  }
  try {
    await shareText(skillName);
  } catch {
    // The sheet never opened. No existing error string fits calmly, so
    // we stay quiet rather than alarm her on her proudest screen.
  }
}
