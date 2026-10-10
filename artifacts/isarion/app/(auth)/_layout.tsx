import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function AccountsUnavailable() {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>Accounts aren&apos;t available in this build</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        You can keep learning as a guest. Your lessons and progress are saved on this device.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={[styles.btn, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.btnTxt}>Continue learning</Text>
      </Pressable>
    </View>
  );
}

// Sign-in screens call Clerk hooks that require ClerkProvider, so they are
// only mounted when Clerk is configured.
export default function AuthLayout() {
  const { clerkEnabled } = useAppAuth();
  if (!clerkEnabled) return <AccountsUnavailable />;
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  btn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  btnTxt: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});
