import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && !user.isOnboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (isSignedIn && user.isOnboarded && (inAuthGroup || inOnboarding)) {
      router.replace("/");
    }
  }, [isSignedIn, isLoaded, segments, user.isOnboarded, router]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <AuthRedirect />
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
  );
}

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