import * as Haptics from "expo-haptics";
import { useAuth } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import PremiumPaywallModal from "@/components/PremiumPaywallModal";
import FeynmanResultModal from "@/components/FeynmanResultModal";
import { shadows } from "@/constants/theme";
import { postLearnerEvidence } from "@/utils/learnerEvidence";
import { getFeatureAccess, recordFeatureUse, consumeFeature } from "@/utils/access";
import { pickStudyDocument, extractDocumentText, type ExtractedDocument } from "@/utils/fileUpload";
import { isPremiumUser } from "@/utils/premium";
import { findWeakestActiveStage, PATH_STAGE_TITLES } from "@/utils/learningPath";
import { API_BASE } from "@/utils/apiConfig";

type Mode = "ai" | "feynman";

interface Message {
  id: string;
  text: string;
  role: "user" | "assistant" | "insight";
  weakestPart?: string;
}

const FEYNMAN_TOPICS = [
  { title: "Cell Division", meta: "Biology foundation", icon: "git-branch-outline" as const, subject: "Biology" },
  { title: "Photosynthesis", meta: "Energy flow", icon: "leaf-outline" as const, subject: "Biology" },
  { title: "Gravity & Orbits", meta: "Physics reasoning", icon: "planet-outline" as const, subject: "Physics" },
  { title: "Linear Algebra", meta: "Math structure", icon: "grid-outline" as const, subject: "Math" },
  { title: "Acid-Base Reactions", meta: "Chemistry patterns", icon: "flask-outline" as const, subject: "Chemistry" },
  { title: "The French Revolution", meta: "Cause and effect", icon: "library-outline" as const, subject: "History" },
];

const FREE_LIMIT = 3;

function genId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

function TypingDots({ color }: { color: string }) {
  const a = useRef(new Animated.Value(0.35)).current;
  const b = useRef(new Animated.Value(0.35)).current;
  const c = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const make = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        ])
      );
    const loops = [make(a, 0), make(b, 120), make(c, 240)];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [a, b, c]);

  return (
    <View style={styles.dots}>
      {[a, b, c].map((opacity, index) => (
        <Animated.View key={index} style={[styles.dot, { backgroundColor: color, opacity }]} />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, addXP, incrementFeynman, advanceSkill } = useUser();
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{ topic?: string; skillId?: string; subject?: string; pathMode?: string }>();
  const [mode, setMode] = useState<Mode>("feynman");
  const [topic, setTopic] = useState<string | null>(
    typeof params.topic === "string" && params.topic ? params.topic : null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [feynmanScores, setFeynmanScores] = useState<number[]>([]);
  const [resultVisible, setResultVisible] = useState(false);
  const [sourceDoc, setSourceDoc] = useState<ExtractedDocument | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Holds the mastery-path skillId (subject:stageIndex) when this session
  // was launched from the Study tab's Mastery Check node, so "Score it" can
  // write progress back via advanceSkill. Ref, not state — it shouldn't
  // trigger a re-render and only needs to survive until the session ends.
  const pathSkillIdRef = useRef<string | null>(
    typeof params.pathMode === "string" && params.pathMode === "1" && typeof params.skillId === "string"
      ? params.skillId
      : null,
  );

  const feynmanLeft = Math.max(0, FREE_LIMIT - user.feynmanSessionsToday);
  const feynmanLocked = !isPro && user.feynmanSessionsToday >= FREE_LIMIT;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Topics matching a subject the user actually picked at onboarding come
  // first — a stable partition, so the two Biology topics (say) still keep
  // their relative order to each other, they just move up as a pair.
  const orderedTopics = useMemo(() => {
    if (user.subjects.length === 0) return FEYNMAN_TOPICS;
    const mine = FEYNMAN_TOPICS.filter((t) => user.subjects.includes(t.subject));
    const rest = FEYNMAN_TOPICS.filter((t) => !user.subjects.includes(t.subject));
    return [...mine, ...rest];
  }, [user.subjects]);

  // The user's own subjects come first — reused wherever chat text mentions
  // "your subjects" instead of a generic prompt.
  const subjectsLabel = useMemo(() => {
    const subs = user.subjects;
    if (subs.length === 0) return null;
    if (subs.length === 1) return subs[0];
    if (subs.length === 2) return `${subs[0]} and ${subs[1]}`;
    return `${subs.slice(0, -1).join(", ")}, and ${subs[subs.length - 1]}`;
  }, [user.subjects]);

  // The single topic most worth reviewing right now, from real mastery
  // data — same logic the daily reminder uses, so what gets highlighted
  // here is consistent with what the notification (if enabled) points at.
  const recommendedTopic = useMemo(() => {
    const weakest = findWeakestActiveStage(user.subjects, user.skillProgress);
    if (!weakest) return null;
    const stageTitle = PATH_STAGE_TITLES[weakest.stageIndex];
    const match = FEYNMAN_TOPICS.find((t) => t.subject === weakest.subject);
    return match ? { title: match.title, stageTitle } : null;
  }, [user.subjects, user.skillProgress]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || typing) return;

    if (mode === "feynman") {
      if (!topic) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const userMsg: Message = { id: genId(), text, role: "user" };
      const priorMessages = messages;
      setMessages((prev) => [userMsg, ...prev]);
      setInput("");
      setTyping(true);
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/api/feynman/evaluate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            explanation: text,
            topic,
            history: priorMessages
              .filter((m) => m.role !== "insight")
              .slice(0, 10)
              .reverse()
              .map((m) => ({ role: m.role, text: m.text })),
            sourceExcerpt: sourceDoc?.text,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          reply?: string;
          weakestPart?: string;
          suggestion?: string;
          score?: number;
          error?: string;
        };
        if (!res.ok || !data.reply) {
          throw new Error(data.error ?? `Mentor request failed with status ${res.status}`);
        }

        setMessages((prev) => {
          const withReply: Message[] = [{ id: genId(), text: data.reply!, role: "assistant" }, ...prev];
          if (!data.weakestPart) return withReply;
          const insight: Message = {
            id: genId(),
            role: "insight",
            text: data.suggestion ?? "",
            weakestPart: data.weakestPart,
          };
          return [insight, ...withReply];
        });

        // The model's own completeness score replaces the old
        // text-length heuristic — a short, precise explanation should
        // score higher than a long, vague one.
        const evidenceScore = typeof data.score === "number" ? Math.max(0, Math.min(1, data.score)) : 0.5;
        setFeynmanScores((prev) => [...prev, evidenceScore]);
        addXP(10);
        getToken()
          .then((freshToken) =>
            postLearnerEvidence({
              token: freshToken,
              evidenceType: "feynman",
              skillId: pathSkillIdRef.current ?? topic,
              subject: topic.split(" ")[0],
              score: evidenceScore,
              response: text,
            }),
          )
          .catch(() => {});
      } catch {
        setMessages((prev) => [
          { id: genId(), text: "Connection issue. Check your internet and try again.", role: "assistant" },
          ...prev,
        ]);
      } finally {
        setTyping(false);
      }
      return;
    }

    const chatAccess = await getFeatureAccess("aiChat");
    if (!chatAccess.allowed) {
      setPaywallVisible(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg: Message = { id: genId(), text, role: "user" };
    const updatedMessages = [userMsg, ...messages];
    setMessages(updatedMessages);
    setInput("");
    setTyping(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: updatedMessages,
          mode,
          topic: topic ?? undefined,
        }),
      });
       const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
       if (!res.ok) {
         throw new Error(data.error ?? `Chat request failed with status ${res.status}`);
       }
       const reply = data.text?.trim();
       if (!reply) throw new Error("Chat response did not include any text.");
      setMessages((prev) => [{ id: genId(), text: reply, role: "assistant" }, ...prev]);
       await recordFeatureUse("aiChat");
      addXP(10);
    } catch {
      setMessages((prev) => [
        { id: genId(), text: "Connection issue. Check your internet and try again.", role: "assistant" },
        ...prev,
      ]);
    } finally {
      setTyping(false);
    }
  }, [input, typing, mode, topic, messages, addXP, getToken, sourceDoc]);

  const startFeynman = async (t: string) => {
    if (feynmanLocked) return;
    const feynmanAccess = await consumeFeature("feynman");
    if (!feynmanAccess.allowed) {
      setPaywallVisible(true);
      return;
    }
    incrementFeynman();
    setMode("feynman");
    setTopic(t);
    setFeynmanScores([]);
    setSourceDoc(null);
    setMessages([
      {
        id: genId(),
        role: "assistant",
        text: `Teach me ${t} like I am new to it. I will listen for gaps, ask sharper questions, and help you simplify the idea until it clicks.`,
      },
    ]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleUploadDocument = useCallback(async () => {
    try {
      const picked = await pickStudyDocument();
      if (!picked) return;

      const uploadAccess = await consumeFeature("docUpload");
      if (!uploadAccess.allowed) {
        setPaywallVisible(true);
        return;
      }

      setUploadingDoc(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const token = await getToken();
      const extracted = await extractDocumentText({ baseUrl: API_BASE, token, doc: picked });
      setSourceDoc(extracted);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessages((prev) => [
        {
          id: genId(),
          role: "assistant",
          text: err instanceof Error ? err.message : "Couldn't read that file. Try a different one.",
        },
        ...prev,
      ]);
    } finally {
      setUploadingDoc(false);
    }
  }, [getToken]);

  const switchMode = (m: Mode) => {
    Haptics.selectionAsync();
    setMode(m);
    setTopic(null);
    setMessages([]);
    setInput("");
    setSourceDoc(null);
  };

  useEffect(() => {
    isPremiumUser().then(setIsPro).catch(() => setIsPro(false));
  }, []);

  // Arrived here from Study's Mastery Check node — skip the topic picker
  // and drop straight into a session on that subject, same as picking a
  // topic card by hand. Runs once on mount; the params that trigger it
  // don't change for the life of this screen instance.
  useEffect(() => {
    const subj = typeof params.subject === "string" && params.subject ? params.subject : null;
    if (!pathSkillIdRef.current || !subj) return;
    startFeynman(subj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTopicPicker = mode === "feynman" && !topic;

  const renderMsg = ({ item }: { item: Message }) => {
    if (item.role === "insight") {
      return (
        <View style={[styles.insightCard, { backgroundColor: "#F59E0B14", borderColor: "#F59E0B40" }]}>
          <View style={styles.insightHeader}>
            <Ionicons name="flag" size={13} color="#B45309" />
            <Text style={[styles.insightLabel, { color: "#B45309", fontFamily: "Inter_700Bold" }]}>
              WEAKEST PART
            </Text>
          </View>
          <Text style={[styles.insightWeakest, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
            {item.weakestPart}
          </Text>
          {item.text ? (
            <Text style={[styles.insightSuggestion, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              Try this: {item.text}
            </Text>
          ) : null}
        </View>
      );
    }
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.aiIcon}>
            <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          </LinearGradient>
        )}
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.bubbleTxt, { color: isUser ? "#fff" : colors.text, fontFamily: "Inter_400Regular" }]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { paddingTop: topPad + 14, borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            {mode === "feynman" && topic ? (
              <Pressable onPress={() => { setTopic(null); setMessages([]); setFeynmanScores([]); setSourceDoc(null); }} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={21} color={colors.text} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>
                {mode === "feynman" ? "FEYNMAN MENTOR" : "STUDY ASSISTANT"}
              </Text>
              <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                {mode === "feynman" && topic ? topic : "Learn by explaining"}
              </Text>
            </View>
            {mode === "feynman" && topic && feynmanScores.length > 0 ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (pathSkillIdRef.current) {
                    const avg =
                      feynmanScores.reduce((sum, s) => sum + s, 0) / Math.max(1, feynmanScores.length);
                    advanceSkill(pathSkillIdRef.current, avg);
                  }
                  setResultVisible(true);
                }}
                style={[styles.scoreBtn, { backgroundColor: colors.primary + "16", borderColor: colors.primary + "33" }]}
              >
                <Ionicons name="trophy" size={15} color={colors.primary} />
                <Text style={[styles.scoreBtnTxt, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>Score it</Text>
              </Pressable>
            ) : null}
          </View>

          {mode === "feynman" && topic ? (
            <View style={styles.docRow}>
              {sourceDoc ? (
                <View style={[styles.docChip, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "30" }]}>
                  <Ionicons name="document-text" size={13} color={colors.primary} />
                  <Text
                    style={[styles.docChipTxt, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}
                    numberOfLines={1}
                  >
                    Teaching from: {sourceDoc.name}
                  </Text>
                  <Pressable onPress={() => setSourceDoc(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={15} color={colors.primary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleUploadDocument}
                  disabled={uploadingDoc}
                  style={[styles.uploadChip, { backgroundColor: colors.card, borderColor: colors.border, opacity: uploadingDoc ? 0.6 : 1 }]}
                >
                  <Ionicons name={uploadingDoc ? "hourglass-outline" : "attach-outline"} size={14} color={colors.textSecondary} />
                  <Text style={[styles.uploadChipTxt, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
                    {uploadingDoc ? "Reading file..." : "Upload notes or a PDF to teach from"}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={[styles.modeSwitcher, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(["feynman", "ai"] as Mode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                style={[styles.modeTab, mode === m && { backgroundColor: colors.primary }]}
              >
                <Ionicons
                  name={m === "ai" ? "chatbubbles-outline" : "sparkles-outline"}
                  size={14}
                  color={mode === m ? "#fff" : colors.textSecondary}
                />
                <Text style={[styles.modeTxt, { color: mode === m ? "#fff" : colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>
                  {m === "ai" ? "Ask" : "Feynman"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {showTopicPicker ? (
          <FlatList
            data={orderedTopics}
            keyExtractor={(item) => item.title}
            numColumns={2}
            columnWrapperStyle={styles.topicColumns}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: botPad + 22 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={() => (
              <View style={styles.feynmanIntro}>
                <LinearGradient colors={["#0F172A", "#1D4ED8"]} style={styles.mentorCard}>
                  <View style={styles.mentorIcon}>
                    <Ionicons name="school" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.mentorTitle, { fontFamily: "Inter_700Bold" }]}>
                    Explain it. Find the gaps. Make it simple.
                  </Text>
                  <Text style={[styles.mentorSub, { fontFamily: "Inter_400Regular" }]}>
                    Choose a topic and teach it out loud in text. The mentor will challenge unclear parts without making you feel stuck.
                  </Text>
                  <View style={styles.sessionRow}>
                    <Ionicons name={feynmanLocked ? "lock-closed" : "timer-outline"} size={15} color="#FFFFFF" />
                    <Text style={[styles.sessionText, { fontFamily: "Inter_600SemiBold" }]}>
                      {isPro
                        ? "Unlimited mentor sessions"
                        : feynmanLocked
                          ? "Daily limit reached"
                          : `${feynmanLeft} mentor sessions left today`}
                    </Text>
                  </View>
                </LinearGradient>
                {feynmanLocked && (
                  <Pressable
                    style={[styles.lockBanner, { backgroundColor: colors.card, borderColor: colors.border }, shadows.sm]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setPaywallVisible(true);
                    }}
                  >
                    <Ionicons name="lock-closed" size={16} color={colors.primary} />
                    <Text style={[styles.lockTxt, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      Unlock unlimited mentor sessions
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
                <Text style={[styles.topicsLabel, { color: colors.textMuted, fontFamily: "Inter_700Bold" }]}>
                  PICK A STARTING POINT
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const isRecommended = recommendedTopic?.title === item.title;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.topicCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isRecommended ? colors.primary : colors.border,
                      borderWidth: isRecommended ? 1.5 : 1,
                      opacity: feynmanLocked ? 0.45 : pressed ? 0.82 : 1,
                    },
                    shadows.sm,
                  ]}
                  onPress={() => !feynmanLocked && startFeynman(item.title)}
                  disabled={feynmanLocked}
                >
                  {isRecommended && (
                    <View style={[styles.recommendedBadge, { backgroundColor: colors.primary + "18" }]}>
                      <Ionicons name="sparkles" size={10} color={colors.primary} />
                      <Text style={[styles.recommendedBadgeTxt, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                        DUE · {recommendedTopic?.stageTitle.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.topicIcon, { backgroundColor: colors.primary + "14" }]}>
                    <Ionicons name={item.icon} size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.topicTxt, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{item.title}</Text>
                  <Text style={[styles.topicMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{item.meta}</Text>
                </Pressable>
              );
            }}
          />
        ) : (
          <>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMsg}
              inverted
              contentContainerStyle={{ padding: 16, gap: 10 }}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                typing ? (
                  <View style={styles.msgRow}>
                    <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.aiIcon}>
                      <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={[styles.bubble, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                      <TypingDots color={colors.primary} />
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !typing ? (
                  <View style={styles.emptyChat}>
                    <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "14" }]}>
                      <Ionicons name={mode === "ai" ? "chatbubbles-outline" : "sparkles-outline"} size={30} color={colors.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                      {mode === "ai" ? "Ask a sharper study question" : "Start with your simplest explanation"}
                    </Text>
                    <Text style={[styles.emptyChatTxt, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                      {mode === "ai"
                        ? subjectsLabel
                          ? `Ask about ${subjectsLabel} — hints, examples, and quick checks.`
                          : "Use it for hints, examples, and quick checks."
                        : "The best Feynman sessions begin messy. Clarity comes next."}
                    </Text>
                  </View>
                ) : null
              }
            />

            <View style={[styles.inputBar, { borderTopColor: colors.border, paddingBottom: botPad + 12, backgroundColor: colors.background }]}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                placeholder={mode === "ai" ? "Ask for a hint, example, or check..." : "Explain the idea in your own words..."}
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={700}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  { backgroundColor: input.trim() ? colors.primary : colors.card, borderColor: colors.border },
                ]}
                onPress={sendMessage}
                disabled={!input.trim() || typing}
              >
                <Ionicons name="send" size={18} color={input.trim() ? "#fff" : colors.textMuted} />
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <PremiumPaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPurchaseSuccess={() => setIsPro(true)}
      />

      <FeynmanResultModal
        visible={resultVisible}
        topic={topic ?? ""}
        score={Math.round(
          (feynmanScores.reduce((sum, s) => sum + s, 0) / Math.max(1, feynmanScores.length)) * 100
        )}
        userName={user.userName}
        referralCode={user.referralCode}
        onClose={() => {
          setResultVisible(false);
          // Mastery was already written on "Score it" — closing just
          // returns the learner to where the path node sent them from.
          if (pathSkillIdRef.current) {
            pathSkillIdRef.current = null;
            router.back();
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scoreBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  scoreBtnTxt: { fontSize: 12 },
  kicker: { fontSize: 10, letterSpacing: 1.4, marginBottom: 3 },
  headerTitle: { fontSize: 22 },
  modeSwitcher: { flexDirection: "row", borderRadius: 15, borderWidth: 1, padding: 3 },
  modeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12 },
  modeTxt: { fontSize: 13 },
  docRow: { flexDirection: "row" },
  docChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, maxWidth: "100%" },
  docChipTxt: { fontSize: 12, flexShrink: 1 },
  uploadChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  uploadChipTxt: { fontSize: 12 },
  insightCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6, marginVertical: 2, maxWidth: "92%", alignSelf: "flex-start" },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  insightLabel: { fontSize: 10, letterSpacing: 1 },
  insightWeakest: { fontSize: 13, lineHeight: 18 },
  insightSuggestion: { fontSize: 12, lineHeight: 17 },
  feynmanIntro: { paddingTop: 18, paddingBottom: 14, gap: 12 },
  mentorCard: { borderRadius: 28, padding: 22, minHeight: 220, justifyContent: "space-between", overflow: "hidden" },
  mentorIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  mentorTitle: { color: "#FFFFFF", fontSize: 25, lineHeight: 31, marginTop: 18 },
  mentorSub: { color: "rgba(255,255,255,0.76)", fontSize: 13, lineHeight: 19, marginTop: 8 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 18 },
  sessionText: { color: "#FFFFFF", fontSize: 12 },
  lockBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 18, borderWidth: 1 },
  lockTxt: { flex: 1, fontSize: 13 },
  topicsLabel: { fontSize: 11, letterSpacing: 1.4, marginTop: 4 },
  topicColumns: { gap: 10, marginBottom: 10 },
  topicCard: { flex: 1, minHeight: 138, borderRadius: 20, borderWidth: 1, padding: 15 },
  topicIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  recommendedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  recommendedBadgeTxt: { fontSize: 9, letterSpacing: 0.4 },
  topicTxt: { fontSize: 15, lineHeight: 20 },
  topicMeta: { fontSize: 12, marginTop: 5 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "92%" },
  msgRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  aiIcon: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  bubble: { maxWidth: "84%", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18 },
  bubbleTxt: { fontSize: 14, lineHeight: 21 },
  dots: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  emptyChat: { alignItems: "center", gap: 10, paddingTop: 72, paddingHorizontal: 24 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, textAlign: "center" },
  emptyChatTxt: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, maxHeight: 116 },
  sendBtn: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
