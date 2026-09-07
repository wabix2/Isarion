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
  topic: string;
  score: number; // 0-100
  userName: string;
  referralCode: string;
  onClose: () => void;
}

function scoreTier(score: number): { label: string; color: [string, string, string] } {
  if (score >= 85) return { label: "Taught it like a pro", color: ["#0F172A", "#065F46", "#10B981"] };
  if (score >= 65) return { label: "Explanation held up", color: ["#0F172A", "#1E3A8A", "#3B82F6"] };
  return { label: "Good first pass", color: ["#0F172A", "#4C1D95", "#8B5CF6"] };
}

export default function FeynmanResultModal({ visible, topic, score, userName, referralCode, onClose }: Props) {
  const colors = useColors();
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  if (!visible) return null;

  const tier = scoreTier(score);

  const handleShare = async () => {
    if (sharing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      const inviteLink = getInviteLink(referralCode);
      const result = await shareCardAsImage(shotRef, {
        fallbackMessage: `I explained "${topic}" well enough to score ${score}/100 in Feynman Mentor on ${APP_NAME}. Can you beat it?`,
        fallbackUrl: inviteLink,
        dialogTitle: `Feynman score: ${topic}`,
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
                Explanation scored
              </Text>
              <Text style={[styles.sheetSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                Teaching it back is how the Feynman Technique works — here's how it landed
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
                  <Ionicons name="bulb" size={15} color="#0F172A" />
                </View>
                <Text style={[styles.brandName, { fontFamily: "Inter_700Bold" }]}>{APP_NAME}</Text>
                <View style={styles.brandLine} />
                <Text style={[styles.cardMeta, { fontFamily: "Inter_500Medium" }]}>FEYNMAN MENTOR</Text>
              </View>

              <View style={styles.center}>
                <Text style={[styles.scoreValue, { fontFamily: "Inter_700Bold" }]}>{score}</Text>
                <Text style={[styles.scoreOutOf, { fontFamily: "Inter_600SemiBold" }]}>/ 100</Text>
                <Text style={[styles.tierLabel, { fontFamily: "Inter_700Bold" }]}>{tier.label}</Text>
                <Text style={[styles.topicLabel, { fontFamily: "Inter_500Medium" }]} numberOfLines={2}>
                  Explained: {topic}
                </Text>
              </View>

              <View style={styles.userRow}>
                <View style={styles.userAvatar}>
                  <Text style={[styles.userAvatarTxt, { fontFamily: "Inter_700Bold" }]}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.userName, { fontFamily: "Inter_700Bold" }]}>{userName}</Text>
                  <Text style={[styles.cardLink, { fontFamily: "Inter_500Medium" }]}>
                    Invite: wabix2.github.io/Launchpad/invite/{referralCode}
                  </Text>
                </View>
              </View>
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
              {sharing ? "Preparing card…" : "Share my score"}
            </Text>
          </Pressable>

          <Pressable style={[styles.doneBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.doneBtnTxt, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
              Keep explaining
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
  sheetSub: { fontSize: 12, marginTop: 3, maxWidth: 260, lineHeight: 17 },
  closeBtn: { padding: 6 },
  card: { minHeight: 400, borderRadius: 26, padding: 22, overflow: "hidden", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  brandName: { color: "#FFFFFF", fontSize: 14 },
  brandLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.22)" },
  cardMeta: { color: "rgba(255,255,255,0.72)", fontSize: 10, letterSpacing: 1.4 },
  center: { alignItems: "center", gap: 4 },
  scoreValue: { color: "#FFFFFF", fontSize: 72, lineHeight: 78 },
  scoreOutOf: { color: "rgba(255,255,255,0.65)", fontSize: 16, marginTop: -8 },
  tierLabel: { color: "#FFFFFF", fontSize: 19, marginTop: 10 },
  topicLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "center", marginTop: 6, maxWidth: 260 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  userAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  userAvatarTxt: { color: "#0F172A", fontSize: 15 },
  userName: { color: "#FFFFFF", fontSize: 14 },
  cardLink: { color: "rgba(255,255,255,0.62)", fontSize: 11, marginTop: 2 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 16, borderRadius: 18 },
  shareBtnTxt: { color: "#FFFFFF", fontSize: 16 },
  doneBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  doneBtnTxt: { fontSize: 13 },
});
