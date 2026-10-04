import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  freezesRemaining: number | null;
  onClose: () => void;
}

export default function StreakFreezeUsedModal({ freezesRemaining, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const visible = freezesRemaining != null;

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    scaleAnim.setValue(0.6);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 90, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center", transform: [{ scale: scaleAnim }] }}>
          <LinearGradient
            colors={["#38BDF8", "#60A5FA", "#818CF8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Ionicons name="snow" size={52} color="#0A0C12" />
          </LinearGradient>

          <View style={{ alignItems: "center", marginTop: 22 }}>
            <Text style={styles.eyebrow}>STREAK FREEZE USED</Text>
            <Text style={styles.title}>You missed a day</Text>
            <Text style={styles.sub}>
              A streak freeze covered it automatically, so your streak stayed intact. You have{" "}
              {freezesRemaining} freeze{freezesRemaining === 1 ? "" : "s"} left — earn more by keeping a 7‑day streak going.
            </Text>

            <Pressable style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.88 : 1 }]} onPress={onClose}>
              <Text style={styles.btnTxt}>Got it</Text>
              <Ionicons name="checkmark" size={18} color="#0A0C12" />
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
    width: 110,
    height: 110,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#60A5FA",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "#60A5FA",
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#F0F2F8",
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#8892A4",
    textAlign: "center",
    maxWidth: 280,
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
