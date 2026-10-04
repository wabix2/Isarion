import AsyncStorage from "@react-native-async-storage/async-storage";
import { isPremiumUser } from "@/utils/premium";

export type AccessFeature =
  | "feynman"
  | "aiChat"
  | "quizGenerations"
  | "flashcardGenerations"
  | "deepAnalysis"
  | "docUpload";

export const FREE_LIMITS: Record<AccessFeature, number> = {
  feynman: 3,
  aiChat: 20,
  quizGenerations: 3,
  flashcardGenerations: 3,
  deepAnalysis: 0,
  docUpload: 5,
};

const USAGE_KEY = "lumiq.daily-usage.v1";

type UsageState = {
  date: string;
  counts: Partial<Record<AccessFeature, number>>;
};

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function readUsage(): Promise<UsageState> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as UsageState : null;
    if (parsed?.date === todayKey()) return parsed;
  } catch {
    // A missing/corrupt usage counter means the user gets the safe free default.
  }
  return { date: todayKey(), counts: {} };
}

async function writeUsage(next: UsageState): Promise<void> {
  try {
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next));
  } catch {
    // Usage tracking is best effort; the server still authenticates all AI calls.
  }
}

export function requiresPro(feature: AccessFeature): boolean {
  return FREE_LIMITS[feature] === 0;
}

export function remainingUses(feature: AccessFeature, used: number): number {
  return Math.max(0, FREE_LIMITS[feature] - used);
}

export function canUseFeature(
  feature: AccessFeature,
  used: number,
  isPro: boolean,
): boolean {
  return isPro || used < FREE_LIMITS[feature];
}

export async function getFeatureUsage(feature: AccessFeature): Promise<number> {
  const usage = await readUsage();
  return usage.counts[feature] ?? 0;
}

export async function getFeatureAccess(feature: AccessFeature): Promise<{
  allowed: boolean;
  isPro: boolean;
  used: number;
  remaining: number;
}> {
  const premium = await isPremiumUser();
  const used = await getFeatureUsage(feature);
  return {
    allowed: canUseFeature(feature, used, premium),
    isPro: premium,
    used,
    remaining: premium ? Number.POSITIVE_INFINITY : remainingUses(feature, used),
  };
}

export async function recordFeatureUse(feature: AccessFeature): Promise<number> {
  const premium = await isPremiumUser();
  if (premium) return getFeatureUsage(feature);

  const usage = await readUsage();
  const used = usage.counts[feature] ?? 0;
  await writeUsage({
    ...usage,
    counts: { ...usage.counts, [feature]: used + 1 },
  });
  return used + 1;
}

/**
 * RevenueCat is checked before incrementing. Local counters only enforce the
 * free allowance; they never grant Pro and are not used as entitlement state.
 */
export async function consumeFeature(feature: AccessFeature): Promise<{
  allowed: boolean;
  isPro: boolean;
  used: number;
  remaining: number;
}> {
  const access = await getFeatureAccess(feature);
  if (!access.allowed) {
    return access;
  }
  const used = await recordFeatureUse(feature);
  return {
    allowed: true,
    isPro: access.isPro,
    used,
    remaining: access.isPro ? Number.POSITIVE_INFINITY : remainingUses(feature, used),
  };
}