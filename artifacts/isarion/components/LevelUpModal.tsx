import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  level: number | null;
  onClose: () => void;
}

const PARTICLE_COLORS = ["#FBBF24", "#818CF8", "#34D399", "#22D3EE", "#F472B6"];
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * Math.PI * 2,
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  distance: 90 + (i % 3) * 30,
}));

export default function LevelUpModal({ level, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
  const badgeSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (level == null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scaleAnim.setValue(0.6);
    fadeAnim.setValue(0);
    particleAnim.setValue(0);
    badgeSpin.setValue(0);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 90, friction: 8, useNativeDriver: true }),
      Animated.timing(particleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(badgeSpin, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [level]);

  if (level == null) return null;

  const rotate = badgeSpin.interpolate({ inputRange: [0, 1], outputRange: ["-20deg", "0deg"] });

  return (
    <Modal visible={level != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center" }}>
          <View style={styles.particleField} pointerEvents="none">
            {PARTICLES.map((p, i) => {
              const tx = particleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.cos(p.angle) * p.distance],
              });
              const ty = particleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.sin(p.angle) * p.distance],
              });
              const op = particleAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1, 0] });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.particle,
                    { backgroundColor: p.color, opacity: op, transform: [{ translateX: tx }, { translateY: ty }] },
                  ]}
                />
              );
            })}
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate }] }}>
            <LinearGradient
              colors={["#4F46E5", "#818CF8", "#22D3EE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <Ionicons name="trophy" size={48} color="#fff" />
            </LinearGradient>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: "center", marginTop: 22 }}>
            <Text style={styles.eyebrow}>LEVEL UP</Text>
            <Text style={styles.title}>Level {level}</Text>
            <Text style={styles.sub}>You're building real momentum. Keep the streak alive.</Text>

            <Pressable style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.88 : 1 }]} onPress={onClose}>
              <Text style={styles.btnTxt}>Keep going</Text>
              <Ionicons name="arrow-forward" size={18} color="#0A0C12" />
            </Pressable>
          </Animated.View>
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
  particleField: {
    position: "absolute",
    top: 40,
    alignSelf: "center",
    width: 4,
    height: 4,
  },
  particle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    width: 120,
    height: 120,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#818CF8",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    color: "#FBBF24",
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
