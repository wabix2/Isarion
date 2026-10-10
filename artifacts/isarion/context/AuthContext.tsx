import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import React, { createContext, useContext, useMemo } from "react";
import { resolveClerkPublishableKey } from "@/utils/authConfig";

/**
 * App-wide auth facade. Screens use this instead of Clerk's useAuth so they
 * work when Clerk is not configured (no publishable key) or cannot load
 * (offline). In those cases the learner is a guest: isSignedIn is false and
 * getToken resolves to null, so no request is ever sent with fake identity.
 */
export interface AppAuth {
  clerkEnabled: boolean;
  /** Clerk finished loading. Always true when Clerk is disabled. Never gates learning. */
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const nullToken = async () => null;
const noop = async () => {};

const GUEST_AUTH: AppAuth = {
  clerkEnabled: false,
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  getToken: nullToken,
  signOut: noop,
};

const AuthContext = createContext<AppAuth>(GUEST_AUTH);

export const CLERK_PUBLISHABLE_KEY = resolveClerkPublishableKey(
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth();
  const value = useMemo<AppAuth>(
    () => ({
      clerkEnabled: true,
      isLoaded,
      isSignedIn: isLoaded && isSignedIn === true,
      userId: isLoaded && isSignedIn ? userId ?? null : null,
      getToken: async () => {
        if (!isLoaded || !isSignedIn) return null;
        try {
          return (await getToken()) ?? null;
        } catch {
          return null;
        }
      },
      signOut: async () => {
        try {
          await signOut();
        } catch {
          // Offline sign-out failures leave local learning data untouched.
        }
      },
    }),
    [isLoaded, isSignedIn, userId, getToken, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Children always render immediately. ClerkLoaded is intentionally not used:
 * it blocks the whole tree until Clerk reaches its servers, which hangs
 * offline.
 */
export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return <AuthContext.Provider value={GUEST_AUTH}>{children}</AuthContext.Provider>;
  }
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

export function useAppAuth(): AppAuth {
  return useContext(AuthContext);
}
