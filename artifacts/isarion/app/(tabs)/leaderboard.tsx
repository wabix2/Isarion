import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { shadows } from "@/constants/theme";
import RankShareModal from "@/components/RankShareModal";
import { API_BASE } from "@/utils/apiConfig";

type Period = "week" | "month" | "all";
const BASE_URL = API_BASE;

interface Player {
  id: number;
  rank: number;
  name: string;
  xp: number;
  level: number;
  streak: number;
  totalQuizzes: number;
  isMe?: boolean;
}

const PODIUM_GRADIENTS = [
  ["#FBBF24", "#F59E0B"] as const,
  ["#94A3B8", "#6B7280"] as const,
  ["#FB923C", "#F97316"] as const,
];

const PODIUM_MEDAL_COLORS = ["#FBBF24", "#94A3B8", "#FB923C"];
const PODIUM_SIZES = [72, 60, 52];
const PODIUM_HEIGHTS = [88, 62, 48];

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [period, setPeriod] = useState<Period>("week");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankShareVisible, setRankShareVisible] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const fetchAndSync = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      // Only sync when authenticated — the endpoint requires a Clerk JWT.
      if (token) {
        await fetch(`${BASE_URL}/api/leaderboard/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: user.userName,
            xp: user.xp,
            level: user.level,
            streak: user.streak,
            totalQuizzes: user.totalQuizzes,
          }),
        });
      }
      const res = await fetch(`${BASE_URL}/api/leaderboard`);
      const raw = (await res.json()) as Array<{
        id: number;
        name: string;
        xp: number;
        level: number;
        streak: number;
        totalQuizzes: number;
      }>;
      const mapped: Player[] = raw.map((p, i) => ({
        ...p,
        rank: i + 1,
        isMe: p.name === user.userName,
      }));
      setPlayers(mapped);
    } catch {
      // Fallback demo data
      setPlayers([
        { id: 1, rank: 1, name: "Alex K.", xp: 4200, level: 12, streak: 28, totalQuizzes: 84, isMe: false },
        { id: 2, rank: 2, name: "Sara M.", xp: 3800, level: 10, streak: 21, totalQuizzes: 73, isMe: false },
        { id: 3, rank: 3, name: "Jordan L.", xp: 3100, level: 9, streak: 14, totalQuizzes: 61, isMe: false },
        { id: 4, rank: 4, name: user.userName, xp: user.xp, level: user.level, streak: user.streak, totalQuizzes: user.totalQuizzes, isMe: true },
        { id: 5, rank: 5, name: "Chris R.", xp: 1900, level: 6, streak: 7, totalQuizzes: 38, isMe: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndSync();
  }, []);

  const podium = players.slice(0, 3);
  const rest = players.slice(3);
  const me = players.find((p) => p.isMe) ?? null;
  const percentile = me ? Math.max(1, Math.ceil((me.rank / Math.max(1, players.length)) * 100)) : 100;

  return (
    <>
      <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: botPad }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={() => (
        <>
          {/* Header */}
          <View style={[styles.header, { paddingTop: topPad + 20 }]}>
            <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              Leaderboard
            </Text>
            <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              This week's top learners
            </Text>
          </View>

          {/* Period Tabs */}
          <View style={[styles.periodRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {(["week", "month", "all"] as Period[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPeriod(p);
                }}
                style={[styles.periodTab, period === p && { backgroundColor: colors.primary }]}
              >
                <Text
                  style={[
                    styles.periodTxt,
                    { color: period === p ? "#fff" : colors.textMuted, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {p === "week" ? "Week" : p === "month" ? "Month" : "All Time"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Podium */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : podium.length >= 3 ? (
            <View style={styles.podiumWrap}>
              {/* 2nd */}
              <View style={[styles.podiumCol, { marginTop: PODIUM_HEIGHTS[0] - PODIUM_HEIGHTS[1] }]}>
                <Ionicons name="medal" size={22} color={PODIUM_MEDAL_COLORS[1]} style={styles.podiumEmoji} />
                <View style={[styles.podiumAvatar, { width: PODIUM_SIZES[1], height: PODIUM_SIZES[1], borderRadius: PODIUM_SIZES[1] / 2, backgroundColor: "#94A3B820" }]}>
                  <Text style={[styles.podiumInitial, { fontSize: 20 }]}>{podium[1].name[0]}</Text>
                </View>
                <Text style={[styles.podiumName, { color: colors.text, fontFamily: "Inter_600SemiBold", maxWidth: 80 }]} numberOfLines={1}>{podium[1].name}</Text>
                <LinearGradient colors={PODIUM_GRADIENTS[1]} style={[styles.podiumBlock, { height: PODIUM_HEIGHTS[1] }]}>
                  <Text style={[styles.podiumXP, { fontFamily: "Inter_700Bold" }]}>{(podium[1].xp / 1000).toFixed(1)}k</Text>
                </LinearGradient>
              </View>

              {/* 1st */}
              <View style={styles.podiumCol}>
                <View style={styles.crownWrap}>
                  <Ionicons name="trophy" size={22} color="#FBBF24" />
                </View>
                <Ionicons name="medal" size={22} color={PODIUM_MEDAL_COLORS[0]} style={styles.podiumEmoji} />
                <View style={[styles.podiumAvatar, { width: PODIUM_SIZES[0], height: PODIUM_SIZES[0], borderRadius: PODIUM_SIZES[0] / 2, backgroundColor: "#FBBF2420" }]}>
                  <Text style={[styles.podiumInitial, { fontSize: 26 }]}>{podium[0].name[0]}</Text>
                </View>
                <Text style={[styles.podiumName, { color: colors.text, fontFamily: "Inter_700Bold", maxWidth: 90 }]} numberOfLines={1}>{podium[0].name}</Text>
                <LinearGradient colors={PODIUM_GRADIENTS[0]} style={[styles.podiumBlock, { height: PODIUM_HEIGHTS[0] }]}>
                  <Text style={[styles.podiumXP, { fontFamily: "Inter_700Bold" }]}>{(podium[0].xp / 1000).toFixed(1)}k</Text>
                </LinearGradient>
              </View>

              {/* 3rd */}
              <View style={[styles.podiumCol, { marginTop: PODIUM_HEIGHTS[0] - PODIUM_HEIGHTS[2] }]}>
                <Ionicons name="medal" size={22} color={PODIUM_MEDAL_COLORS[2]} style={styles.podiumEmoji} />
                <View style={[styles.podiumAvatar, { width: PODIUM_SIZES[2], height: PODIUM_SIZES[2], borderRadius: PODIUM_SIZES[2] / 2, backgroundColor: "#FB923C20" }]}>
                  <Text style={[styles.podiumInitial, { fontSize: 18 }]}>{podium[2].name[0]}</Text>
                </View>
                <Text style={[styles.podiumName, { color: colors.text, fontFamily: "Inter_600SemiBold", maxWidth: 72 }]} numberOfLines={1}>{podium[2].name}</Text>
                <LinearGradient colors={PODIUM_GRADIENTS[2]} style={[styles.podiumBlock, { height: PODIUM_HEIGHTS[2] }]}>
                  <Text style={[styles.podiumXP, { fontFamily: "Inter_700Bold" }]}>{(podium[2].xp / 1000).toFixed(1)}k</Text>
                </LinearGradient>
              </View>
            </View>
          ) : null}

          {!loading && me && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setRankShareVisible(true);
              }}
              style={[styles.myRankCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }, shadows.sm]}
            >
              <View style={[styles.myRankAvatar, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[styles.myRankInitial, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  {me.name[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.myRankTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                  You're #{me.rank} · Top {percentile}%
                </Text>
                <Text style={[styles.myRankSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                  {me.xp.toLocaleString()} XP this {period === "all" ? "season" : period} · Tap to share
                </Text>
              </View>
              <View style={[styles.myRankShareBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="share-social" size={16} color="#fff" />
              </View>
            </Pressable>
          )}

          {rest.length > 0 && (
            <Text style={[styles.restLabel, { color: colors.textMuted, fontFamily: "Inter_700Bold" }]}>
              RANKINGS
            </Text>
          )}
        </>
      )}
      data={rest}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.rankRow,
            {
              backgroundColor: item.isMe ? colors.primary + "15" : colors.card,
              borderColor: item.isMe ? colors.primary + "50" : colors.cardBorder,
              marginHorizontal: 22,
              marginBottom: 8,
            },
            shadows.xs,
          ]}
        >
          <Text style={[styles.rankNum, { color: colors.textMuted, fontFamily: "Inter_700Bold" }]}>
            #{item.rank}
          </Text>
          <View style={[styles.rankAvatar, { backgroundColor: item.isMe ? colors.primary + "30" : colors.muted }]}>
            <Text style={[styles.rankInitial, { color: item.isMe ? colors.primary : colors.textSecondary }]}>
              {item.name[0]}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rankName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
              {item.name}{item.isMe ? " (you)" : ""}
            </Text>
            <View style={styles.rankMetaRow}>
              <Text style={[styles.rankMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                Lv {item.level}
              </Text>
              <Text style={[styles.rankMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}> · </Text>
              <Ionicons name="flame" size={12} color={colors.textMuted} />
              <Text style={[styles.rankMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                {" "}{item.streak}d streak
              </Text>
            </View>
          </View>
          <Text style={[styles.rankXP, { color: colors.xp ?? "#FBBF24", fontFamily: "Inter_700Bold" }]}>
            {item.xp.toLocaleString()}
          </Text>
        </View>
      )}
    />
      {me && (
        <RankShareModal
          visible={rankShareVisible}
          userName={me.name}
          rank={me.rank}
          totalPlayers={players.length}
          percentile={percentile}
          xp={me.xp}
          streak={me.streak}
          period={period}
          referralCode={user.referralCode}
          onClose={() => setRankShareVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 22, marginBottom: 20 },
  headerTitle: { fontSize: 28, letterSpacing: -0.3, marginBottom: 4 },
  headerSub: { fontSize: 14 },
  periodRow: { flexDirection: "row", marginHorizontal: 22, borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 28 },
  periodTab: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: "center" },
  periodTxt: { fontSize: 13 },
  loadingWrap: { height: 200, alignItems: "center", justifyContent: "center" },
  myRankCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 22,
    marginBottom: 20,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  myRankAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  myRankInitial: { fontSize: 17 },
  myRankTitle: { fontSize: 15, marginBottom: 2 },
  myRankSub: { fontSize: 12 },
  myRankShareBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  podiumWrap: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8, paddingHorizontal: 22, marginBottom: 32 },
  podiumCol: { flex: 1, alignItems: "center", gap: 6 },
  crownWrap: { marginBottom: -4 },
  podiumEmoji: { fontSize: 20 },
  podiumAvatar: { alignItems: "center", justifyContent: "center" },
  podiumInitial: { color: "#fff", fontFamily: "Inter_700Bold" },
  podiumName: { fontSize: 12, textAlign: "center" },
  podiumBlock: { width: "100%", borderTopLeftRadius: 10, borderTopRightRadius: 10, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  podiumXP: { color: "#fff", fontSize: 12 },
  restLabel: { fontSize: 11, letterSpacing: 1.4, paddingHorizontal: 22, marginBottom: 12 },
  rankRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, gap: 12 },
  rankNum: { fontSize: 13, width: 28 },
  rankAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rankInitial: { fontSize: 16, fontFamily: "Inter_700Bold" },
  rankName: { fontSize: 14 },
  rankMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  rankMeta: { fontSize: 12 },
  rankXP: { fontSize: 14 },
});
