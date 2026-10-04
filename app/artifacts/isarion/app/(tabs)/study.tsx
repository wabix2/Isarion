import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import QuizModal from "@/components/QuizModal";
import FlashcardModal from "@/components/FlashcardModal";
import { shadows } from "@/constants/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  PATH_STAGE_TITLES,
  PATH_STAGE_MODES,
  UNLOCK_THRESHOLD,
  MASTERED_THRESHOLD,
  findNextStage,
} from "@/utils/learningPath";

const { width } = Dimensions.get("window");

const ALL_SUBJECTS = ["Math", "Biology", "Chemistry", "Physics", "History"];

const STAGE_ICONS = {
  Foundations: "flag-outline",
  "Core Concepts": "layers-outline",
  Practice: "barbell-outline",
  Application: "bulb-outline",
  "Mastery Check": "school-outline",
} as const;

const STAGE_MODE_LABEL = {
  quiz: "Quiz",
  flashcard: "Flashcards",
  feynman: "Feynman",
} as const;

const PATH_STAGES = PATH_STAGE_TITLES.map((title, i) => ({
  title,
  mode: PATH_STAGE_MODES[i],
  icon: STAGE_ICONS[title],
}));

const MODES = [
  {
    id: "quiz",
    icon: "help-circle" as const,
    label: "Quiz Mode",
    desc: "Multiple-choice questions with instant feedback",
    color: "#818CF8",
    gradientColors: ["#4F46E5", "#818CF8"] as const,
    xpLabel: "+5 XP per correct answer",
    badgeIcon: "locate" as const,
    badge: "Adaptive",
  },
  {
    id: "flashcard",
    icon: "layers" as const,
    label: "Flashcards",
    desc: "Spaced repetition for long-term memory",
    color: "#34D399",
    gradientColors: ["#059669", "#34D399"] as const,
    xpLabel: "+25 XP per deck",
    badgeIcon: "layers" as const,
    badge: "Memory",
  },
  {
    id: "feynman",
    icon: "school" as const,
    label: "Feynman Mentor",
    desc: "Teach the idea back — get challenged on the actual gaps",
    color: "#F472B6",
    gradientColors: ["#DB2777", "#F472B6"] as const,
    xpLabel: "+10 XP per session",
    badgeIcon: "sparkles" as const,
    badge: "Teach-back",
  },
];

export default function StudyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, advanceSkill } = useUser();
  const params = useLocalSearchParams<{ mode?: string; skillId?: string; subject?: string }>();
  const paramSubject = typeof params.subject === "string" && params.subject ? params.subject : undefined;
  const paramSkillId = typeof params.skillId === "string" && params.skillId ? params.skillId : undefined;

  // The user's own onboarding picks come first, in the order they picked
  // them, so the chip row reflects what they actually chose rather than a
  // fixed alphabetical/arbitrary list. Anything not picked still appears
  // after, so nothing becomes unreachable.
  const orderedSubjects = useMemo(() => {
    const chosen = user.subjects.filter((s) => ALL_SUBJECTS.includes(s));
    const rest = ALL_SUBJECTS.filter((s) => !chosen.includes(s));
    return [...chosen, ...rest];
  }, [user.subjects]);

  const [subject, setSubject] = useState(paramSubject ?? orderedSubjects[0] ?? "Math");
  const [quizVisible, setQuizVisible] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const nextStage = useMemo(
    () => findNextStage(subject, user.skillProgress),
    [subject, user.skillProgress],
  );

  useEffect(() => {
    if (!paramSkillId || (params.mode !== "quiz" && params.mode !== "flashcard")) return;
    setActiveSkillId(paramSkillId);
    if (paramSubject) setSubject(paramSubject);
    if (params.mode === "quiz") setQuizVisible(true);
    else setFlashVisible(true);
  }, [paramSkillId, paramSubject, params.mode]);

  const openPathNode = (stageIndex: number) => {
    const skillId = `${subject}:${stageIndex}`;
    const prevSkillId = `${subject}:${stageIndex - 1}`;
    const unlocked = stageIndex === 0 || (user.skillProgress[prevSkillId] ?? 0) >= UNLOCK_THRESHOLD;
    if (!unlocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const stageMode = PATH_STAGES[stageIndex].mode;
    if (stageMode === "feynman") {
      // The mentor lives on the Chat tab, not a modal — hand off skillId
      // and subject so chat.tsx can auto-start the session and write
      // mastery back via advanceSkill when the learner scores it.
      router.push({
        pathname: "/(tabs)/chat",
        params: { skillId, subject, pathMode: "1" },
      });
      return;
    }
    setActiveSkillId(skillId);
    if (stageMode === "quiz") setQuizVisible(true);
    else setFlashVisible(true);
  };

  const handleNodeComplete = (scoreFraction: number) => {
    if (activeSkillId) advanceSkill(activeSkillId, scoreFraction);
    setActiveSkillId(null);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 20, paddingHorizontal: 22 }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Study</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              {nextStage
                ? `${Math.round(nextStage.mastery * 100)}% on ${PATH_STAGE_TITLES[nextStage.stageIndex]} — that's next`
                : `${subject} fully mastered — pick another subject or keep sharpening it`}
            </Text>
          </View>
          <View style={[styles.streakPill, { backgroundColor: "#FB923C15" }]}>
            <Ionicons name="flame" size={14} color="#FB923C" />
            <Text style={[styles.streakTxt, { color: "#FB923C", fontFamily: "Inter_700Bold" }]}>
              {user.streak}d
            </Text>
          </View>
        </View>

        {/* Subject Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipsRow, { paddingHorizontal: 22 }]}
          style={{ marginBottom: 28 }}
        >
          {orderedSubjects.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                Haptics.selectionAsync();
                setSubject(s);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: subject === s ? colors.primary : colors.card,
                  borderColor: subject === s ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipTxt,
                  { color: subject === s ? "#fff" : colors.textSecondary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Learning Path */}
        <View style={{ paddingHorizontal: 22, marginBottom: 32 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 4 }]}>
            {subject} Path
          </Text>
          <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: "Inter_400Regular", marginBottom: 18 }]}>
            Clear each stage to unlock the next
          </Text>

          <View style={styles.pathTrack}>
            {PATH_STAGES.map((stage, i) => {
              const skillId = `${subject}:${i}`;
              const prevId = `${subject}:${i - 1}`;
              const mastery = user.skillProgress[skillId] ?? 0;
              const unlocked = i === 0 || (user.skillProgress[prevId] ?? 0) >= UNLOCK_THRESHOLD;
              const completed = mastery >= MASTERED_THRESHOLD;
              const nodeColor = completed ? "#34D399" : unlocked ? colors.primary : colors.mutedForeground;
              const align = i % 2 === 0 ? "flex-start" : "flex-end";

              return (
                <View key={skillId} style={[styles.pathRow, { justifyContent: align }]}>
                  {i > 0 && (
                    <View
                      style={[
                        styles.pathConnector,
                        { backgroundColor: unlocked ? colors.primary + "50" : colors.cardBorder },
                        i % 2 === 0 ? { right: "50%" } : { left: "50%" },
                      ]}
                    />
                  )}
                  <Pressable
                    onPress={() => openPathNode(i)}
                    style={[
                      styles.pathNode,
                      {
                        backgroundColor: unlocked ? colors.card : colors.muted,
                        borderColor: completed ? "#34D399" : unlocked ? colors.primary : colors.cardBorder,
                      },
                      shadows.xs,
                    ]}
                  >
                    <View style={[styles.pathIconRing, { backgroundColor: nodeColor + "20" }]}>
                      <Ionicons
                        name={completed ? "checkmark" : unlocked ? stage.icon : "lock-closed"}
                        size={20}
                        color={nodeColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pathStageTitle, { color: unlocked ? colors.text : colors.textMuted, fontFamily: "Inter_700Bold" }]}>
                        {stage.title}
                      </Text>
                      <Text style={[styles.pathStageMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                        {STAGE_MODE_LABEL[stage.mode]} · {Math.round(mastery * 100)}% mastery
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>


        <View style={{ paddingHorizontal: 22, marginBottom: 14 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            Free Practice
          </Text>
          <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 }]}>
            Jump in without following the path
          </Text>
        </View>
        <View style={{ paddingHorizontal: 22, gap: 14, marginBottom: 32 }}>
          {MODES.map((m) => (
            <Pressable
              key={m.id}
              style={({ pressed }) => [
                styles.modeCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.88 : 1 },
                shadows.md,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setActiveSkillId(null);
                if (m.id === "quiz") setQuizVisible(true);
                else if (m.id === "flashcard") setFlashVisible(true);
                else router.push("/(tabs)/chat"); // Feynman mentor lives on the Chat tab
              }}
            >
              {/* Top badge */}
              <View style={[styles.modeBadge, { flexDirection: "row", alignItems: "center", gap: 5 }]}>
                <Ionicons name={m.badgeIcon} size={12} color={m.color} />
                <Text style={[styles.modeBadgeTxt, { color: m.color, fontFamily: "Inter_600SemiBold" }]}>
                  {m.badge}
                </Text>
              </View>

              <View style={styles.modeMain}>
                <LinearGradient
                  colors={m.gradientColors}
                  style={styles.modeIconGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={m.icon} size={26} color="#fff" />
                </LinearGradient>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.modeDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {m.desc}
                  </Text>
                </View>

                <View style={[styles.startChev, { backgroundColor: m.color + "20" }]}>
                  <Ionicons name="arrow-forward" size={18} color={m.color} />
                </View>
              </View>

              <View style={[styles.xpBadge, { backgroundColor: m.color + "15" }]}>
                <Ionicons name="star" size={12} color={m.color} />
                <Text style={[styles.xpBadgeTxt, { color: m.color, fontFamily: "Inter_600SemiBold" }]}>
                  {m.xpLabel}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

      </ScrollView>

      <QuizModal
        visible={quizVisible}
        subject={subject}
        onClose={() => setQuizVisible(false)}
        skillId={activeSkillId ?? undefined}
        onComplete={handleNodeComplete}
      />
      <FlashcardModal
        visible={flashVisible}
        subject={subject}
        onClose={() => setFlashVisible(false)}
        skillId={activeSkillId ?? undefined}
        onComplete={handleNodeComplete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 },
  headerTitle: { fontSize: 28, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 2 },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  streakTxt: { fontSize: 14 },
  chipsRow: { gap: 8 },
  chip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5 },
  chipTxt: { fontSize: 13 },
  modeCard: { borderRadius: 22, borderWidth: 1, padding: 20, gap: 14, overflow: "hidden" },
  modeBadge: { alignSelf: "flex-start", backgroundColor: "transparent" },
  modeBadgeTxt: { fontSize: 12 },
  modeMain: { flexDirection: "row", alignItems: "center", gap: 16 },
  modeIconGrad: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modeLabel: { fontSize: 18, marginBottom: 4 },
  modeDesc: { fontSize: 13, lineHeight: 18 },
  startChev: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  xpBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  xpBadgeTxt: { fontSize: 12 },
  sectionTitle: { fontSize: 18 },
  pathTrack: { gap: 14 },
  pathRow: { flexDirection: "row", position: "relative" },
  pathConnector: { position: "absolute", top: -14, height: 14, width: 2 },
  pathNode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "82%",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  pathIconRing: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pathStageTitle: { fontSize: 14, marginBottom: 2 },
  pathStageMeta: { fontSize: 11 },
});
