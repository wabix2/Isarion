import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ViewShot from "react-native-view-shot";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { shareCardAsImage } from "@/utils/shareCard";
import { getInviteLink } from "@/utils/referral";

const APP_NAME = "Isarion";

interface Props {
  visible: boolean;
  userName: string;
  rank: number;
  totalPlayers: number;
  percentile: number; // 1-100, lower is better (top 1% etc.)
  xp: number;
  streak: number;
  period: "week" | "month" | "all";
  referralCode: string;
  onClose: () => void;
}

function rankTier(percentile: number): { label: string; color: [string, string, string]; icon: string } {
  if (percentile <= 1) return { label: "Top 1%", color: ["#1E1B4B", "#7C3AED", "#FBBF24"], icon: "trophy" };
  if (percentile <= 10) return { label: `Top ${percentile}%`, color: ["#0F172A", "#7C3AED", "#A78BFA"], icon: "medal" };
  if (percentile <= 25) return { label: `Top ${percentile}%`, color: ["#0F172A", "#1E3A8A", "#3B82F6"], icon: "trending-up" };
  return { label: `Top ${percentile}%`, color: ["#0F172A", "#0E7490", "#22D3EE"], icon: "rocket" };
}

const PERIOD_LABEL: Record<Props["period"], string> = {
  week: "THIS WEEK",
  month: "THIS MONTH",
  all: "ALL TIME",
};

export default function RankShareModal({
  visible,
  userName,
  rank,
  totalPlayers,
  percentile,
  xp,
  streak,
  period,
  referralCode,
  onClose,
}: Props) {
  const colors = useColors();
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  if (!visible) return null;

  const tier = rankTier(percentile);

  const handleShare = async () => {
    if (sharing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      const inviteLink = getInviteLink(referralCode);
      const result = await shareCardAsImage(shotRef, {
        fallbackMessage: `I'm #${rank} out of ${totalPlayers} learners on ${APP_NAME} this ${period === "all" ? "season" : period} — top ${percentile}%. Think you can outrank me?`,
        fallbackUrl: inviteLink,
        dialogTitle: `Rank #${rank} on ${APP_NAME}`,
      });
      if (result === "cancelled") {
        Alert.alert("Sharing unavailable", "Your device could not open the share sheet. You can open the public Isarion link instead.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open link", onPress: () => Linking.openURL(inviteLink) },
        ]);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                Share your rank
              </Text>
              <Text style={[styles.sheetSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                Challenge a friend to outrank you
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ViewShot ref={shotRef} options={{ format: "png", quality: 0.95 }}>
            <LinearGradient colors={tier.color} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Ionicons name="school" size={15} color="#0F172A" />
                </View>
                <Text style={[styles.brandName, { fontFamily: "Inter_700Bold" }]}>{APP_NAME}</Text>
                <View style={styles.brandLine} />
                <Text style={[styles.cardMeta, { fontFamily: "Inter_500Medium" }]}>{PERIOD_LABEL[period]}</Text>
              </View>

              <View style={styles.center}>
                <View style={styles.rankBadge}>
                  <Ionicons name={tier.icon as any} size={30} color="#FFFFFF" />
                </View>
                <Text style={[styles.rankValue, { fontFamily: "Inter_700Bold" }]}>#{rank}</Text>
                <Text style={[styles.tierLabel, { fontFamily: "Inter_700Bold" }]}>{tier.label}</Text>
                <Text style={[styles.outOfLabel, { fontFamily: "Inter_500Medium" }]}>
                  out of {totalPlayers.toLocaleString()} learners
                </Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <Text style={[styles.statValue, { fontFamily: "Inter_700Bold" }]}>{xp.toLocaleString()}</Text>
                  <Text style={[styles.statLabel, { fontFamily: "Inter_500Medium" }]}>XP</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBlock}>
                  <Text style={[styles.statValue, { fontFamily: "Inter_700Bold" }]}>{streak}d</Text>
                  <Text style={[styles.statLabel, { fontFamily: "Inter_500Medium" }]}>Streak</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBlock}>
                  <Text style={[styles.userAvatarTxt2, { fontFamily: "Inter_700Bold" }]}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                  <Text style={[styles.statLabel, { fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                    {userName}
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardLink, { fontFamily: "Inter_500Medium" }]}>
                Invite: wabix2.github.io/Launchpad/invite/{referralCode}
              </Text>
            </LinearGradient>
          </ViewShot>

          <Pressable
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: colors.primary, opacity: sharing ? 0.6 : pressed ? 0.88 : 1 },
            ]}
            onPress={handleShare}
            disabled={sharing}
          >
            <Ionicons name="share-social" size={19} color="#fff" />
            <Text style={[styles.shareBtnTxt, { fontFamily: "Inter_700Bold" }]}>
              {sharing ? "Preparing card…" : "Share my rank"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#020617AA", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    gap: 14,
    paddingBottom: Platform.OS === "ios" ? 38 : 22,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 18 },
  sheetSub: { fontSize: 12, marginTop: 3 },
  closeBtn: { padding: 6 },
  card: { minHeight: 420, borderRadius: 26, padding: 22, overflow: "hidden", justifyContent: "space-between", gap: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  brandName: { color: "#FFFFFF", fontSize: 14 },
  brandLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.22)" },
  cardMeta: { color: "rgba(255,255,255,0.72)", fontSize: 10, letterSpacing: 1.4 },
  center: { alignItems: "center", gap: 4 },
  rankBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  rankValue: { color: "#FFFFFF", fontSize: 56, lineHeight: 60 },
  tierLabel: { color: "#FFFFFF", fontSize: 18, marginTop: 4 },
  outOfLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  statBlock: { alignItems: "center", gap: 2, flex: 1 },
  statValue: { color: "#FFFFFF", fontSize: 18 },
  statLabel: { color: "rgba(255,255,255,0.68)", fontSize: 11 },
  statDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.22)" },
  userAvatarTxt2: { color: "#FFFFFF", fontSize: 16 },
  cardLink: { color: "rgba(255,255,255,0.55)", fontSize: 11, textAlign: "center" },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 16, borderRadius: 18 },
  shareBtnTxt: { color: "#FFFFFF", fontSize: 16 },
});
