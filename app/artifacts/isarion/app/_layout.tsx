import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Keep the native splash screen visible until Clerk has resolved the auth
// state AND the local user record has loaded from AsyncStorage. Without
// this, Expo auto-hides the splash on the first rendered frame — which
// happens before either of those are ready — so it flashes and disappears
// immediately, leaving a blank/loading screen behind it.
SplashScreen.preventAutoHideAsync().catch(() => {});

import { ErrorBoundary } from "@/components/ErrorBoundary";
import LevelUpModal from "@/components/LevelUpModal";
import PremiumPaywallModal from "@/components/PremiumPaywallModal";
import StreakFreezeUsedModal from "@/components/StreakFreezeUsedModal";
import StreakMilestoneModal from "@/components/StreakMilestoneModal";
import { UserProvider, useUser } from "@/context/UserContext";
import { isPremiumUser } from "@/utils/premium";
import { shouldShowWinMomentPaywall, recordWinMomentPaywallShown } from "@/utils/winMomentPaywall";

const queryClient = new QueryClient();
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

// Paywall shown right after a level-up or streak milestone closes, instead
// of only at a free-tier limit hit. Same underlying PremiumPaywallModal,
// just triggered on a win ("unlock more of this") rather than a block
// ("you've been cut off") — and capped to once/day via winMomentPaywall so
// it can't turn into a nag on every single level-up.
function GlobalCelebrations() {
  const {
    pendingLevelUp,
    clearLevelUp,
    pendingFreezeUsed,
    clearFreezeUsed,
    pendingStreakMilestone,
    clearStreakMilestone,
  } = useUser();
  const [winPaywall, setWinPaywall] = useState<{ title: string; subtitle: string } | null>(null);

  const maybeShowWinMomentPaywall = useCallback((title: string, subtitle: string) => {
    (async () => {
      try {
        const [pro, eligible] = await Promise.all([isPremiumUser(), shouldShowWinMomentPaywall()]);
        if (!pro && eligible) {
          await recordWinMomentPaywallShown();
          setWinPaywall({ title, subtitle });
        }
      } catch {
        // Best-effort only — never block the celebration flow on this.
      }
    })();
  }, []);

  let celebration: React.ReactNode = null;
  if (pendingLevelUp) {
    const level = pendingLevelUp.level;
    celebration = (
      <LevelUpModal
        level={level}
        onClose={() => {
          clearLevelUp();
          maybeShowWinMomentPaywall(
            `Level ${level} unlocked`,
            "You're on a roll — go unlimited and keep this pace up.",
          );
        }}
      />
    );
  } else if (pendingFreezeUsed) {
    celebration = (
      <StreakFreezeUsedModal
        freezesRemaining={pendingFreezeUsed.freezesRemaining}
        onClose={clearFreezeUsed}
      />
    );
  } else if (pendingStreakMilestone) {
    const days = pendingStreakMilestone;
    celebration = (
      <StreakMilestoneModal
        days={days}
        onClose={() => {
          clearStreakMilestone();
          maybeShowWinMomentPaywall(
            `${days}-day streak`,
            "That kind of consistency deserves unlimited mentor sessions.",
          );
        }}
      />
    );
  }

  return (
    <>
      {celebration}
      <PremiumPaywallModal
        visible={winPaywall != null}
        title={winPaywall?.title}
        subtitle={winPaywall?.subtitle}
        onClose={() => setWinPaywall(null)}
      />
    </>
  );
}

function AuthRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait for both Clerk's auth state and the local user record to be
    // ready. Redirecting on the DEFAULT placeholder user (isOnboarded:
    // false) before AsyncStorage finishes loading would briefly send an
    // already-onboarded user back to the onboarding screen.
    if (!isLoaded || !userLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && !user.isOnboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (isSignedIn && user.isOnboarded && (inAuthGroup || inOnboarding)) {
      router.replace("/");
    }
  }, [isSignedIn, isLoaded, userLoaded, segments, user.isOnboarded, router]);

  return null;
}

function RootLayoutNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const segments = useSegments();
  const inAuthGroup = segments[0] === "(auth)";
  const inOnboarding = segments[0] === "onboarding";

  const appReady = isLoaded && userLoaded;
  const needsSignIn = appReady && !isSignedIn && !inAuthGroup;
  const needsOnboarding = appReady && isSignedIn && !user.isOnboarded && !inOnboarding;
  const needsHome = appReady && isSignedIn && user.isOnboarded && (inAuthGroup || inOnboarding);

  // Hide the native splash only once we know which screen we're actually
  // showing — otherwise it hides under the auth-loading spinner and the
  // user still sees a flash-then-blank transition.
  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady]);

  return (
    <>
      <AuthRedirect />
      {/* Do not render the app stack while a guard redirect is pending. Expo
          Router can initially resolve "/" to the tabs group, which otherwise
          produces a visible home-screen flash before AuthRedirect runs. */}
      {!appReady || needsSignIn || needsOnboarding || needsHome ? (
        <AuthLoadingScreen />
      ) : (
        <>
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false, animation: "fade" }} />
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false, gestureEnabled: false, animation: "fade" }}
            />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="privacy-policy"
              options={{ headerShown: false, presentation: "card" }}
            />
          </Stack>
          <GlobalCelebrations />
        </>
      )}
    </>
  );
}

function AuthLoadingScreen() {
  return (
    <View style={styles.authLoading}>
      <ActivityIndicator color="#818CF8" />
    </View>
  );
}

const styles = StyleSheet.create({
  authLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0C12",
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
              <ClerkLoaded>
                <UserProvider>
                  <RootLayoutNav />
                </UserProvider>
              </ClerkLoaded>
            </ClerkProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}