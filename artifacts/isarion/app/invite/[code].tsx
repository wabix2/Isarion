import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useUser } from "@/context/UserContext";

export default function InviteRedirectScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { user } = useUser();
  const referralCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    if (!referralCode) return;
    router.replace(
      user.isOnboarded
        ? "/(tabs)"
        : { pathname: "/onboarding", params: { ref: referralCode } }
    );
  }, [referralCode, user.isOnboarded]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color="#818CF8" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0C12", alignItems: "center", justifyContent: "center" },
});