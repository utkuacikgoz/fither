import type { RefObject } from "react";
import { Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

// Sharing a receipt or a week (wave 3): the same shape as the skill
// share (unlock/share-skill.ts) — the card she sees is captured as
// rendered and handed to the system sheet as a PNG, and every way that
// can fail falls back to the text alone, quietly. One difference, and
// the reason this is not a call into share-skill: the sheet must carry
// her sentence and the link NEXT TO the image. expo-sharing's file
// handoff has no text slot, so the image path goes through React
// Native's Share with the file URL and the message together, which is
// the one iOS sheet that presents both.
//
// A dismissed sheet is not an error, and nothing here touches the
// network: the file is written locally by the capture and read by the
// sheet. The message is built by the screen from strings.ts; nothing
// about her body, notes or restrictions can reach this function.

export interface ShareReceiptOptions {
  /** The text beside the image, or alone when the capture fails. */
  message: string;
  /** The rendered card to capture; null when it has not mounted. */
  card: RefObject<View | null> | null;
}

export async function shareReceipt({ message, card }: ShareReceiptOptions): Promise<void> {
  let url: string | null = null;
  try {
    if (card?.current) {
      url = await captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
    }
  } catch {
    // The capture did not produce a file — the text still stands.
    url = null;
  }
  try {
    await Share.share(url !== null ? { url, message } : { message });
  } catch {
    // The sheet never opened. No existing error string fits calmly, so
    // we stay quiet rather than alarm her over a share.
  }
}
