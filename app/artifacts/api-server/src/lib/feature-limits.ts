/**
 * Server-side mirror of artifacts/lumiq-ai/utils/access.ts FREE_LIMITS.
 *
 * The client-side counters in access.ts are UX only (instant feedback,
 * works offline) and are stored in AsyncStorage, which any user can clear.
 * These limits are the actual enforcement point — see usage-quota.ts and
 * routes/chat.ts. Keep the two files' numbers in sync; if you change one,
 * change the other.
 */
export type FeatureId = "feynman" | "aiChat" | "quizGenerations" | "docUpload";

export const FREE_LIMITS: Record<FeatureId, number> = {
  feynman: 3,
  aiChat: 20,
  quizGenerations: 3,
  docUpload: 5,
};
