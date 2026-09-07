import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import {
  getHomeRecommendation,
  getLocalRecommendation,
  type HomeRecommendation,
} from "@/utils/homeRecommendation";
import { getTimePeriod, getPeriodTheme, getDailyQuote } from "@/utils/timeOfDay";
import { API_BASE } from "@/utils/apiConfig";

// How often the hero re-evaluates the time of day while the screen stays
// mounted, so a user who lingers past a period boundary (e.g. 11:59 -> 12:00)
// still sees it update without needing to reopen the tab.
const TIME_REFRESH_MS = 60_000;

export default function TabOneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [recommendation, setRecommendation] = useState<HomeRecommendation>(() =>
    getLocalRecommendation({ subjects: user.subjects, skillProgress: user.skillProgress }),
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TIME_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const period = useMemo(() => getTimePeriod(now), [now]);
  const theme = useMemo(() => getPeriodTheme(period), [period]);
  const quote = useMemo(() => getDailyQuote(period, now), [period, now]);
  const dateLabel = useMemo(
    () => now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    [now],
  );
  const firstName = useMemo(() => user.userName.split(" ")[0] || user.userName, [user.userName]);

  useEffect(() => {
    let active = true;
    getToken()
      .then((token) =>
        getHomeRecommendation({
          baseUrl: API_BASE,
          token,
          subject: user.subjects[0],
          fallback: { subjects: user.subjects, skillProgress: user.skillProgress },
        }),
      )
      .then((next) => {
        if (active) setRecommendation(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [getToken, user.subjects, user.skillProgress]);

  const openRecommendation = () => {
    if (recommendation.mode === "chat") {
      if (recommendation.skillId) {
        router.push({ pathname: "/(tabs)/chat", params: { topic: recommendation.skillId } });
      } else {
        router.push("/(tabs)/chat");
      }
    } else {
      const mode = recommendation.mode === "flashcard" ? "flashcard" : "quiz";
      router.push({
        pathname: "/(tabs)/study",
        params: {
          mode,
          skillId: recommendation.skillId ?? "",
          subject: user.subjects[0] ?? "",
        },
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 22 }]}
      >
        {/* Soft glow disc behind the period icon — the "sunlight" the ask was after,
            built as part of the hero rather than a separate decorative banner. */}
        <View style={styles.glowWrap} pointerEvents="none">
          <View style={[styles.glow, { backgroundColor: theme.onGradientText + "22" }]} />
        </View>

        <View style={styles.heroTopRow}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.onGradientMuted }]}>{dateLabel}</Text>
            <Text style={[styles.greeting, { color: theme.onGradientText }]}>
              {theme.greeting}, {firstName}
            </Text>
            <Text style={[styles.tagline, { color: theme.onGradientText }]}>
              Explain it — don't just answer it.
            </Text>
          </View>
          <View style={[styles.periodIconWrap, { backgroundColor: theme.onGradientText + "1F" }]}>
            <Ionicons name={theme.icon} size={26} color={theme.onGradientText} />
          </View>
        </View>

        <Text style={[styles.quote, { color: theme.onGradientMuted }]}>“{quote}”</Text>

        {user.streak > 0 && (
          <View style={[styles.streakChip, { backgroundColor: theme.onGradientText + "1F" }]}>
            <Ionicons name="flame" size={15} color={theme.onGradientText} />
            <Text style={[styles.streakChipText, { color: theme.onGradientText }]}>
              {user.streak} day{user.streak === 1 ? "" : "s"} in a row
            </Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>Your next best step</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.icon, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{recommendation.title}</Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>{recommendation.reason}</Text>
          <Pressable onPress={openRecommendation} style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={styles.buttonText}>{recommendation.action}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  glowWrap: {
    position: "absolute",
    top: -40,
    right: -40,
  },
  glow: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  eyebrow: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 6 },
  greeting: { fontSize: 26, fontWeight: "700" },
  tagline: { fontSize: 13, fontWeight: "600", marginTop: 6, opacity: 0.85 },
  periodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quote: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    marginTop: 18,
    maxWidth: 320,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  streakChipText: { fontSize: 13, fontWeight: "700" },
  body: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
  },
  card: { borderWidth: 1, borderRadius: 24, padding: 22 },
  icon: {
    alignItems: "center",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    marginBottom: 18,
    width: 48,
  },
  cardTitle: { fontSize: 22, fontWeight: "700", marginBottom: 10 },
  text: { fontSize: 15, lineHeight: 23, marginBottom: 22 },
  button: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});

