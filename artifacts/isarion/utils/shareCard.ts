import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";
import type { RefObject } from "react";
import type ViewShot from "react-native-view-shot";

interface ShareCardOptions {
  /** Plain-text fallback used when image sharing isn't available (e.g. web, or the OS share sheet failed). */
  fallbackMessage: string;
  fallbackUrl: string;
  dialogTitle: string;
}

export type ShareCardResult = "image" | "text_fallback" | "cancelled";

/**
 * Captures a card wrapped in <ViewShot> and hands it to the native share
 * sheet as an image. Sharing the actual designed card (not just a text
 * blurb) is what makes it work as a growth loop — a plain "I unlocked X!"
 * message reads like an ad, but the visual card reads like a post, and
 * people share posts.
 */
export async function shareCardAsImage(
  viewShotRef: RefObject<ViewShot | null>,
  opts: ShareCardOptions
): Promise<ShareCardResult> {
  try {
    if (Platform.OS === "web" || !viewShotRef.current?.capture) {
      throw new Error("image capture unavailable on this platform");
    }
    const uri = await viewShotRef.current.capture();
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error("native share sheet unavailable");
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: opts.dialogTitle,
      UTI: "public.png",
    });
    return "image";
  } catch {
    try {
      await Share.share({
        message: `${opts.fallbackMessage}\n\n${opts.fallbackUrl}`,
        url: opts.fallbackUrl,
      });
      return "text_fallback";
    } catch {
      return "cancelled";
    }
  }
}
