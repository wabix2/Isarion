import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface AvatarProps {
  name: string;
  size?: number;
}

const GRADIENTS: [string, string][] = [
  ["#818CF8", "#4F46E5"],
  ["#34D399", "#059669"],
  ["#FB923C", "#F97316"],
  ["#22D3EE", "#0891B2"],
  ["#A78BFA", "#7C3AED"],
];

function colorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % GRADIENTS.length;
}

export function Avatar({ name, size = 44 }: AvatarProps) {
  const initial = (name || "?")[0].toUpperCase();
  const [c1, c2] = GRADIENTS[colorIndex(name)];
  const fontSize = size * 0.42;
  const borderRadius = size / 2;

  return (
    <LinearGradient
      colors={[c1, c2]}
      style={[styles.avatar, { width: size, height: size, borderRadius }]}
    >
      <Text style={[styles.initial, { fontSize, color: "#fff", fontFamily: "Inter_700Bold" }]}>
        {initial}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  initial: {},
});
