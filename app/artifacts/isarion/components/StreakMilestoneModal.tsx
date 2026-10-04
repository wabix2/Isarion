import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  days: number | null;
  onClose: () => void;
}

const MILESTONE_COPY: Record<number, string> = {
  3: "Three days in a row. The habit is forming.",
  7: "A full week. That's a real habit now.",
  14: "Two weeks straight. Most people quit by now — you didn't.",
  30: "30 days. You're in the top tier of learners.",
  50: "50 days of showing up. Remarkable consistency.",
  100: "100 days. Legendary streak.",
};

export default function StreakMilestoneModal({ days, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flameAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (days == null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scaleAnim.setValue(0.6);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 90, friction: 8, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
        Animated.timing(flameAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, [days]);

  if (days == null) return null;

  return (
    <Modal visible={days != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center", transform: [{ scale: scaleAnim }] }}>
          <Animated.View style={{ transform: [{ scale: flameAnim }] }}>
            <LinearGradient
              colors={["#F97316", "#FB923C", "#FBBF24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <Ionicons name="flame" size={56} color="#0A0C12" />
            </LinearGradient>
          </Animated.View>

          <View style={{ alignItems: "center", marginTop: 22 }}>
            <Text style={styles.eyebrow}>STREAK MILESTONE</Text>
            <Text style={styles.title}>{days} Days</Text>
            <Text style={styles.sub}>{MILESTONE_COPY[days] ?? "Your streak keeps growing."}</Text>

            <Pressable style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.88 : 1 }]} onPress={onClose}>
              <Text style={styles.btnTxt}>Nice</Text>
              <Ionicons name="flame" size={18} color="#0A0C12" />
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#020617D0",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 120,
    height: 120,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FB923C",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "#FB923C",
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#F0F2F8",
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#8892A4",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
    marginBottom: 26,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnTxt: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0A0C12",
  },
});
