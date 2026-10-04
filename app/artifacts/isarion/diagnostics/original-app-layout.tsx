import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/expo";
// Use the installed Clerk Expo package's concrete token-cache entry. This
// avoids Metro's subpath-export resolution issue in the Expo 52 monorepo.
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import LevelUpModal from "@/components/LevelUpModal";
import StreakFreezeUsedModal from "@/components/StreakFreezeUsedModal";
import StreakMilestoneModal from "@/components/StreakMilestoneModal";
import { UserProvider, useUser } from "@/context/UserContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

/**
 * Shown instead of crashing to a blank screen when EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
 * wasn't embedded at build time. EXPO_PUBLIC_* vars are inlined into the JS bundle
 * during `eas build`, not read at runtime — if it isn't set as an EAS secret/env
 * for the build profile used, this will be undefined in the shipped binary even
 * though local dev works fine (dev script injects it from the shell).
 */
function MissingConfigScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0B0B0F" }}>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 12 }}>
        Configuration missing
      </Text>
      <Text style={{ color: "#A0A0AB", fontSize: 14, textAlign: "center" }}>
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY was not set at build time. Set it as an EAS
        secret/environment variable for this build profile and rebuild.
      </Text>
    </View>
  );
}

function GlobalCelebrations() {
  const {
    pendingLevelUp,
    clearLevelUp,
    pendingFreezeUsed,
    clearFreezeUsed,
    pendingStreakMilestone,
    clearStreakMilestone,
  } = useUser();
  // Priority order so modals never stack: a level-up is the biggest win and
  // takes precedence, then a freeze-used notice (time-sensitive transparency
  // about something that just happened), then a streak milestone celebration.
  // A freeze-used event and a streak-milestone event can't co-occur (they're
  // mutually exclusive branches of the same day-check), but level-up can
  // overlap with either.
  if (pendingLevelUp) {
    return <LevelUpModal level={pendingLevelUp.level} onClose={clearLevelUp} />;
  }
  if (pendingFreezeUsed) {
    return (
      <StreakFreezeUsedModal
        freezesRemaining={pendingFreezeUsed.freezesRemaining}
        onClose={clearFreezeUsed}
      />
    );
  }
  return <StreakMilestoneModal days={pendingStreakMilestone} onClose={clearStreakMilestone} />;
}

/**
 * Redirects to auth screens when not signed in, to onboarding when signed in
 * but the user hasn't completed it yet, and to the app otherwise.
 *
 * This previously sent every freshly signed-in user straight to "/" (the
 * tabs/home screen), so the onboarding screen (name, subjects, daily goal)
 * was never actually reached automatically — it only existed as dead code
 * reachable by manual navigation. New users landed on the home tab with
 * default/empty state instead.
 */
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
  }, [isSignedIn, isLoaded, segments, user.isOnboarded]);

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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!publishableKey) {
    return (
      <SafeAreaProvider>
        <MissingConfigScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ClerkProvider
              publishableKey={publishableKey}
              tokenCache={tokenCache}
              proxyUrl={proxyUrl}
            >
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
