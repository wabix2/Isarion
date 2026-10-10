import { Ionicons } from "@expo/vector-icons";
import { useAppAuth } from "@/context/AuthContext";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { API_BASE } from "@/utils/apiConfig";

interface LeagueMember {
  rank: number;
  name: string;
  weeklyXp: number;
  isMe: boolean;
}

interface LeagueData {
  tier: number;
  tierName: string;
  endsAt: string;
  lastResult: "promoted" | "demoted" | "stayed" | null;
  rank: number;
  size: number;
  promoteCount: number;
  demoteCount: number;
  members: LeagueMember[];
}

const TIER_COLORS = ["#CD7F32", "#9CA3AF", "#FBBF24", "#38BDF8", "#A78BFA"];

function timeLeft(endsAt: string): string {
  const ms = Date.parse(endsAt) - Date.now();
  if (!(ms > 0)) return "ending now";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

/** Weekly league: a group of ~30 learners in the same tier, ranked by XP earned this week. */
export default function LeagueView() {
  const colors = useColors();
  const { getToken } = useAppAuth();
  const [data, setData] = useState<LeagueData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "needs-sync" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const token = await getToken();
      if (!token || !API_BASE) {
        setState("needs-sync");
        return;
      }
      const res = await fetch(`${API_BASE}/api/league/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) {
        setState("needs-sync");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as LeagueData);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (state !== "ready" || !data) {
    const msg =
      state === "needs-sync"
        ? "Sign in and finish a study session to join this week's league."
        : "Couldn't load your league. Check your connection and try again.";
    return (
      <View style={styles.center}>
        <Ionicons name="trophy-outline" size={40} color={colors.textSecondary} />
        <Text style={[styles.msg, { color: colors.textSecondary }]}>{msg}</Text>
        <Pressable onPress={load} style={[styles.retry, { backgroundColor: colors.primary }]}>
          <Text style={styles.retryTxt}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const tierColor = TIER_COLORS[data.tier] ?? TIER_COLORS[0];
  const demoteFrom = data.size - data.demoteCount; // ranks above this are safe
  const resultBanner =
    data.lastResult === "promoted"
      ? { text: `You moved up to ${data.tierName} league!`, color: "#22C55E", icon: "arrow-up-circle" as const }
      : data.lastResult === "demoted"
        ? { text: `You dropped to ${data.tierName} league. Earn XP to climb back.`, color: "#EF4444", icon: "arrow-down-circle" as const }
        : null;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: tierColor + "66" }]}>
        <View style={[styles.badge, { backgroundColor: tierColor + "22" }]}>
          <Ionicons name="shield" size={34} color={tierColor} />
        </View>
        <Text style={[styles.tier, { color: colors.text }]}>{data.tierName} League</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Rank {data.rank} of {data.size} · {timeLeft(data.endsAt)}
        </Text>
        <Text style={[styles.rule, { color: colors.textSecondary }]}>
          Top {data.promoteCount} move up
          {data.demoteCount > 0 ? ` · bottom ${data.demoteCount} move down` : ""}
        </Text>
      </View>

      {resultBanner && (
        <View style={[styles.banner, { backgroundColor: resultBanner.color + "1A", borderColor: resultBanner.color + "55" }]}>
          <Ionicons name={resultBanner.icon} size={18} color={resultBanner.color} />
          <Text style={[styles.bannerTxt, { color: resultBanner.color }]}>{resultBanner.text}</Text>
        </View>
      )}

      <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {data.members.map((m) => {
          const promoting = m.rank <= data.promoteCount && m.weeklyXp > 0 && data.tier < 4;
          const demoting = data.demoteCount > 0 && m.rank > demoteFrom && data.tier > 0;
          const accent = promoting ? "#22C55E" : demoting ? "#EF4444" : colors.border;
          return (
            <View
              key={`${m.rank}-${m.name}`}
              style={[styles.row, { borderLeftColor: accent }, m.isMe && { backgroundColor: colors.primary + "1F" }]}
            >
              <Text style={[styles.rank, { color: colors.textSecondary }]}>{m.rank}</Text>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {m.isMe ? `${m.name} (you)` : m.name}
              </Text>
              <Text style={[styles.xp, { color: colors.text }]}>{m.weeklyXp} XP</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 32, gap: 14, flex: 1 },
  msg: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryTxt: { color: "#fff", fontWeight: "700" },
  scroll: { padding: 18, paddingBottom: 120, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 22, alignItems: "center", padding: 22 },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tier: { fontSize: 22, fontWeight: "700" },
  sub: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  rule: { fontSize: 12, marginTop: 8 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, padding: 12 },
  bannerTxt: { flex: 1, fontSize: 13, fontWeight: "600" },
  list: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 4, gap: 12 },
  rank: { width: 26, fontSize: 14, fontWeight: "700" },
  name: { flex: 1, fontSize: 15, fontWeight: "600" },
  xp: { fontSize: 14, fontWeight: "700" },
});
