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
import { AppAuthProvider, useAppAuth } from "@/context/AuthContext";
import { LessonProgressProvider } from "@/context/LessonProgressContext";
import { UserProvider, useUser } from "@/context/UserContext";
import { resolveStartupRoute, type StartupRoute } from "@/utils/authConfig";
import { isPremiumUser } from "@/utils/premium";
import { shouldShowWinMomentPaywall, recordWinMomentPaywallShown } from "@/utils/winMomentPaywall";

const queryClient = new QueryClient();

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

// Guest-first: startup waits only for the local user record. Clerk's loading
// state and network reachability are never inputs, so an offline device or a
// build without Clerk keys still reaches the app. Sign-in is opt-in.
function useStartupRoute() {
  const { isSignedIn } = useAppAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const segments = useSegments();
  return resolveStartupRoute({
    userLoaded,
    isOnboarded: user.isOnboarded,
    isSignedIn,
    segment: segments[0],
  });
}

function StartupRedirect({ route }: { route: StartupRoute }) {
  const router = useRouter();
  useEffect(() => {
    if (route === "onboarding") router.replace("/onboarding");
    else if (route === "home") router.replace("/");
  }, [route, router]);
  return null;
}

function RootLayoutNav() {
  const route = useStartupRoute();
  const appReady = route !== "loading";

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  // Failsafe: never leave the native splash up if storage hangs.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <StartupRedirect route={route} />
      {/* Do not render the app stack while a redirect is pending, so the
          home screen never flashes before onboarding. */}
      {route !== "stay" ? (
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
            <Stack.Screen name="learn/index" options={{ headerShown: false, presentation: "card" }} />
            <Stack.Screen name="learn/[lessonId]" options={{ headerShown: false, presentation: "card" }} />
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
            <AppAuthProvider>
              <UserProvider>
                <LessonProgressProvider>
                  <RootLayoutNav />
                </LessonProgressProvider>
              </UserProvider>
            </AppAuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
