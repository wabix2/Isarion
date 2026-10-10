/**
 * Clerk is optional. The learning experience must start without it, so every
 * auth decision goes through these pure helpers (no React Native imports, so
 * they run under plain Node tests).
 */

const CLERK_KEY_PATTERN = /^pk_(test|live)_[A-Za-z0-9+/=_-]{10,}$/;

/** Returns a usable publishable key, or null when Clerk is not configured. */
export function resolveClerkPublishableKey(raw: string | undefined | null): string | null {
  const key = raw?.trim();
  if (!key || !CLERK_KEY_PATTERN.test(key)) return null;
  return key;
}

export type StartupRoute = "loading" | "onboarding" | "home" | "stay";

export interface StartupInput {
  /** Local user record has been read from storage. Auth state is NOT required. */
  userLoaded: boolean;
  isOnboarded: boolean;
  isSignedIn: boolean;
  /** First route segment, e.g. "(auth)", "onboarding", "(tabs)". */
  segment: string | undefined;
}

/**
 * Guest-first routing. Never redirects to sign-in: the auth screens are only
 * reached when the learner chooses them. Clerk loading state and network
 * reachability are deliberately not inputs, so neither can block startup.
 */
export function resolveStartupRoute(input: StartupInput): StartupRoute {
  if (!input.userLoaded) return "loading";
  const inAuthGroup = input.segment === "(auth)";
  const inOnboarding = input.segment === "onboarding";
  if (!input.isOnboarded) return inOnboarding || inAuthGroup ? "stay" : "onboarding";
  if (inOnboarding) return "home";
  if (inAuthGroup && input.isSignedIn) return "home";
  return "stay";
}

/** Server features and who may use them. Mirrors api-server route middleware. */
export type FeatureAccess = "local" | "public" | "account";

export const FEATURE_ACCESS = {
  lessons: "local",
  lessonExercises: "local",
  localProgress: "local",
  studyPathOfflineQuiz: "local",
  leaderboardRead: "public",
  aiTutorChat: "account",
  feynmanMentor: "account",
  aiQuizGeneration: "account",
  documentUpload: "account",
  leaderboardWrite: "account",
  league: "account",
  progressBackup: "account",
  referrals: "account",
  learnerModelSync: "account",
} as const satisfies Record<string, FeatureAccess>;

export type Feature = keyof typeof FEATURE_ACCESS;

export interface AuthSnapshot {
  clerkEnabled: boolean;
  isSignedIn: boolean;
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "sign-in-required" | "accounts-unavailable" };

export function canUse(feature: Feature, auth: AuthSnapshot): AccessDecision {
  if (FEATURE_ACCESS[feature] !== "account") return { allowed: true };
  if (auth.isSignedIn) return { allowed: true };
  return { allowed: false, reason: auth.clerkEnabled ? "sign-in-required" : "accounts-unavailable" };
}
