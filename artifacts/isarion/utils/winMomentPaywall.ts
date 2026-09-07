import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Gates the win-moment paywall (shown after a level-up or streak milestone,
 * see app/_layout.tsx's GlobalCelebrations) to at most once per day.
 *
 * Level-ups especially can happen several times in a single session early
 * on, and showing the upgrade prompt after every single one would turn a
 * feel-good moment right back into the nag it was meant to replace. This
 * is a simple local cooldown, same best-effort AsyncStorage pattern as
 * utils/access.ts — losing it just means the cap resets, which is fine.
 */
const LAST_SHOWN_KEY = "lumiq.win-moment-paywall.last-shown.v1";

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export async function shouldShowWinMomentPaywall(): Promise<boolean> {
  try {
    const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    return lastShown !== todayKey();
  } catch {
    // If we can't read the cooldown, default to showing it — worst case is
    // one extra prompt today, not a silently broken feature.
    return true;
  }
}

export async function recordWinMomentPaywallShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SHOWN_KEY, todayKey());
  } catch {
    // Best effort — a missed write just means the cap doesn't apply today.
  }
}
