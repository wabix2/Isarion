import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColorScheme } from "react-native";

const ACCENT = "#818CF8";
const MUTED = "#6B7A94";

// Tab bar colors match Isarion dark theme — ignore system color scheme for tab bar
// because the app is always dark.
const TAB_BG = "#0D1117";
const TAB_BG_IOS = "transparent";

const isIOS = Platform.OS === "ios";
const isWeb = Platform.OS === "web";

function TabIcon({ sfName, featherName, color, size = 22 }: {
  sfName: string;
  featherName: string;
  color: string;
  size?: number;
}) {
  if (isIOS) {
    return <SymbolView name={sfName as any} tintColor={color} size={size} />;
  }
  return <Feather name={featherName as any} size={size} color={color} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== "light"; // app is always dark

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? TAB_BG_IOS : TAB_BG,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: "#1E293B",
          elevation: 0,
          ...(isWeb ? { height: 64 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: TAB_BG }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <TabIcon sfName="house" featherName="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: "Study",
          tabBarIcon: ({ color }) => (
            <TabIcon sfName="book.fill" featherName="book-open" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <TabIcon sfName="bubble.left.and.bubble.right.fill" featherName="message-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Ranks",
          tabBarIcon: ({ color }) => (
            <TabIcon sfName="trophy.fill" featherName="award" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <TabIcon sfName="person.fill" featherName="user" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
