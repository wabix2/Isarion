import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/context/UserContext";

const { width, height } = Dimensions.get("window");

const STEPS = [
  {
    headline: "Learn anything,\nmaster it fast.",
    sub: "AI-powered Feynman tutoring, adaptive quizzes, and spaced-repetition flashcards — all in one place.",
    icon: "school-outline" as const,
    accent: "#818CF8",
  },
  {
    headline: "Stay on a\nwinning streak.",
    sub: "Build daily habits with streak tracking, XP rewards, and a global leaderboard that keeps you hungry.",
    icon: "flame-outline" as const,
    accent: "#FB923C",
  },
  {
    headline: "Your AI study\nmentor awaits.",
    sub: "Ask anything. Get Feynman-style explanations that actually stick. No fluff, no filler.",
    icon: "sparkles-outline" as const,
    accent: "#34D399",
  },
];

const SUBJECT_OPTIONS = [
  { id: "Math", icon: "calculator-outline" as const },
  { id: "Biology", icon: "leaf-outline" as const },
  { id: "Chemistry", icon: "flask-outline" as const },
  { id: "Physics", icon: "planet-outline" as const },
  { id: "History", icon: "time-outline" as const },
];

const GOAL_OPTIONS = [
  { minutes: 5, label: "Casual", sub: "5 min/day" },
  { minutes: 10, label: "Regular", sub: "10 min/day" },
  { minutes: 20, label: "Serious", sub: "20 min/day" },
  { minutes: 30, label: "Intense", sub: "30 min/day" },
];

// Step indices: 0..2 = intro carousel, 3 = subjects, 4 = daily goal, 5 = name
const SUBJECTS_STEP = STEPS.length;
const GOAL_STEP = STEPS.length + 1;
const NAME_STEP = STEPS.length + 2;
const TOTAL_DOTS = STEPS.length + 3;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useUser();
  const params = useLocalSearchParams<{ ref?: string | string[]; referralCode?: string | string[] }>();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goalMinutes, setGoalMinutes] = useState(10);
  const referredByCode = String(params.referralCode ?? params.ref ?? "").trim();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const dotAnims = useRef(Array.from({ length: TOTAL_DOTS }, () => new Animated.Value(0))).current;

  const isIntroStep = step < STEPS.length;
  const isSubjectsStep = step === SUBJECTS_STEP;
  const isGoalStep = step === GOAL_STEP;
  const isNameStep = step === NAME_STEP;

  const canContinue =
    (isIntroStep && true) ||
    (isSubjectsStep && subjects.length > 0) ||
    (isGoalStep && true) ||
    (isNameStep && name.trim().length >= 2);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    scaleAnim.setValue(0.94);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    animateIn();
    dotAnims.forEach((a, i) => {
      Animated.timing(a, {
        toValue: i === step ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
  }, [step]);

  const toggleSubject = (id: string) => {
    Haptics.selectionAsync();
    setSubjects((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleNext = () => {
    if (!canContinue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isNameStep) {
      completeOnboarding(name.trim(), subjects, goalMinutes, referredByCode || undefined);
      router.replace("/(tabs)");
    } else {
      setStep((s) => s + 1);
    }
  };

  const currentStep = isIntroStep ? STEPS[step] : STEPS[0];
  const accent = isIntroStep ? currentStep.accent : "#818CF8";

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#0A0C12", "#0F1220", "#13161F"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: accent,
            opacity: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
          },
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.inner,
          {
            paddingTop: insets.top + 48,
            paddingBottom: insets.bottom + 40,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Step dots */}
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_DOTS }).map((_, i) => {
            const isActive = i === step;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? accent : "#2A2D3E",
                    width: dotAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, 20],
                    }),
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Icon or name input */}
        <View style={styles.iconArea}>
          {isIntroStep ? (
            <View style={[styles.iconRing, { borderColor: accent + "40", backgroundColor: accent + "15" }]}>
              <Ionicons name={currentStep.icon} size={44} color={accent} />
            </View>
          ) : isSubjectsStep ? (
            <View style={[styles.iconRing, { borderColor: accent + "40", backgroundColor: accent + "15" }]}>
              <Ionicons name="apps-outline" size={44} color={accent} />
            </View>
          ) : isGoalStep ? (
            <View style={[styles.iconRing, { borderColor: accent + "40", backgroundColor: accent + "15" }]}>
              <Ionicons name="speedometer-outline" size={44} color={accent} />
            </View>
          ) : (
            <View style={[styles.iconRing, { borderColor: accent + "40", backgroundColor: accent + "15" }]}>
              <Ionicons name="person-outline" size={44} color={accent} />
            </View>
          )}
        </View>

        {/* Copy */}
        <View style={styles.copy}>
          {isIntroStep && (
            <>
              <Text style={styles.headline}>{currentStep.headline}</Text>
              <Text style={styles.sub}>{currentStep.sub}</Text>
            </>
          )}
          {isSubjectsStep && (
            <>
              <Text style={styles.headline}>{"What do you\nwant to master?"}</Text>
              <Text style={styles.sub}>Pick one or more. You can always change this later.</Text>
            </>
          )}
          {isGoalStep && (
            <>
              <Text style={styles.headline}>{"Set your daily\ngoal."}</Text>
              <Text style={styles.sub}>A little every day beats a lot once in a while.</Text>
            </>
          )}
          {isNameStep && (
            <>
              <Text style={styles.headline}>{"What should we\ncall you?"}</Text>
              <Text style={styles.sub}>Your name appears on the leaderboard. Make it legendary.</Text>
            </>
          )}
        </View>

        {/* Subject chips */}
        {isSubjectsStep && (
          <View style={styles.chipsWrap}>
            {SUBJECT_OPTIONS.map((s) => {
              const active = subjects.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggleSubject(s.id)}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: active ? accent + "20" : "#13161F",
                      borderColor: active ? accent : "#1E2130",
                    },
                  ]}
                >
                  <Ionicons name={s.icon} size={16} color={active ? accent : "#6B7A94"} />
                  <Text style={[styles.subjectChipTxt, { color: active ? accent : "#8892A4" }]}>{s.id}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Goal options */}
        {isGoalStep && (
          <View style={styles.goalWrap}>
            {GOAL_OPTIONS.map((g) => {
              const active = goalMinutes === g.minutes;
              return (
                <Pressable
                  key={g.minutes}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGoalMinutes(g.minutes);
                  }}
                  style={[
                    styles.goalRow,
                    { backgroundColor: active ? accent + "15" : "#13161F", borderColor: active ? accent : "#1E2130" },
                  ]}
                >
                  <View>
                    <Text style={[styles.goalLabel, { color: active ? accent : "#F0F2F8" }]}>{g.label}</Text>
                    <Text style={styles.goalSub}>{g.sub}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={22} color={accent} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Input on name step */}
        {isNameStep && (
          <View style={[styles.inputWrap, focused && { borderColor: accent }]}>
            <TextInput
              style={styles.input}
              placeholder="Enter your name..."
              placeholderTextColor="#4B5563"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
          </View>
        )}

        {/* CTA button */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: canContinue ? accent : "#1E2130", opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={handleNext}
          disabled={!canContinue}
        >
          <Text style={[styles.btnTxt, { color: canContinue ? "#fff" : "#4B5563" }]}>
            {isNameStep ? "Start Learning" : "Continue"}
          </Text>
          <Ionicons
            name={isNameStep ? "rocket-outline" : "arrow-forward"}
            size={20}
            color={canContinue ? "#fff" : "#4B5563"}
          />
        </Pressable>

        {/* Skip */}
        {isIntroStep && (
          <Pressable onPress={() => setStep(SUBJECTS_STEP)} style={styles.skip}>
            <Text style={styles.skipTxt}>Skip intro</Text>
          </Pressable>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: "absolute",
    top: -100,
    left: "50%",
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 52,
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  iconArea: {
    marginBottom: 40,
  },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    alignItems: "center",
    marginBottom: 36,
  },
  headline: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#F0F2F8",
    textAlign: "center",
    lineHeight: 42,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#6B7A94",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  inputWrap: {
    width: "100%",
    backgroundColor: "#13161F",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#1E2130",
    marginBottom: 24,
    paddingHorizontal: 20,
    height: 60,
    justifyContent: "center",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 28,
  },
  subjectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  subjectChipTxt: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  goalWrap: {
    width: "100%",
    gap: 10,
    marginBottom: 28,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  goalLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  goalSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7A94",
  },
  input: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: "#F0F2F8",
  },
  btn: {
    width: "100%",
    height: 60,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  btnTxt: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  skip: {
    marginTop: 20,
    padding: 8,
  },
  skipTxt: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
  },
});
