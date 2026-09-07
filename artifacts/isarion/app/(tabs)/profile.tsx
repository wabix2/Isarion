import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { useNotifications } from "@/hooks/useNotifications";
import AchievementShareModal from "@/components/AchievementShareModal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { shadows } from "@/constants/theme";
import { isPremiumUser } from "@/utils/premium";
import PremiumPaywallModal from "@/components/PremiumPaywallModal";
import { getInviteLink } from "@/utils/referral";

const { width } = Dimensions.get("window");

interface Achievement {
  id: string;
  icon: string;
  label: string;
  unlocked: boolean;
  color: string;
  description: string;
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

const STATS = [
  { label: "Total XP", icon: "star" as const, color: "#FBBF24" },
  { label: "Quizzes", icon: "help-circle" as const, color: "#818CF8" },
  { label: "Streak", icon: "flame" as const, color: "#FB923C" },
  { label: "Level", icon: "trophy" as const, color: "#34D399" },
];

function getAchievements(user: {
  streak: number;
  totalQuizzes: number;
  rank: number;
  xp: number;
  totalFeynmanSessions: number;
}): Achievement[] {
  return [
    { id: "1", icon: "flame", label: "7-Day Streak", unlocked: user.streak >= 7, color: "#FB923C", description: "Study on 7 consecutive days." },
    { id: "2", icon: "school", label: "First Quiz", unlocked: user.totalQuizzes >= 1, color: "#818CF8", description: "Complete your first quiz." },
    { id: "3", icon: "trophy", label: "Top 10", unlocked: user.rank <= 10, color: "#FBBF24", description: "Reach the top 10 on the leaderboard." },
    { id: "4", icon: "book", label: "Bookworm", unlocked: user.totalQuizzes >= 50, color: "#22D3EE", description: "Complete 50 quizzes." },
    { id: "5", icon: "star", label: "XP Master", unlocked: user.xp >= 5000, color: "#FBBF24", description: "Earn 5,000 total XP." },
    { id: "6", icon: "bulb", label: "Feynman Pro", unlocked: user.totalFeynmanSessions >= 10, color: "#34D399", description: "Complete 10 Feynman sessions." },
  ];
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, linkAccount, unlinkAccount, syncStatus } = useUser();
  const { enabled: notifEnabled, loading: notifLoading, toggle: toggleNotif } = useNotifications({
    streak: user.streak,
    streakFreezes: user.streakFreezes,
    subjects: user.subjects,
    skillProgress: user.skillProgress,
  });
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 24;
  const xpFraction = Math.min(1, user.xp / user.xpToNext);
  const achievements = getAchievements(user);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const todayIndex = (new Date().getDay() + 6) % 7;
  const isActiveToday = user.lastActiveDate === new Date().toDateString();

  const handleLink = async () => {
    if (!emailInput.trim() || linking) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLinking(true);
    setLinkMessage(null);
    const result = await linkAccount(emailInput);
    setLinking(false);
    setLinkMessage(result.message);
    if (result.ok) setEmailInput("");
  };

  const handleInvite = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const inviteLink = getInviteLink(user.referralCode);
    try {
      await Share.share({
        title: "Join me on Isarion",
        message: `I'm building a study streak on Isarion. Join me and get your first session started:\n\n${inviteLink}`,
        url: inviteLink,
      });
    } catch {
      // The native share sheet can be dismissed without an action.
    }
  };

  useEffect(() => {
    if (Platform.OS !== "web") {
      isPremiumUser().then(setIsPremium).catch(() => {});
    }
  }, []);

  const statValues = [
    user.xp.toLocaleString(),
    user.totalQuizzes.toString(),
    `${user.streak}d`,
    `${user.level}`,
  ];

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={{ paddingTop: topPad }}>
          <LinearGradient
            colors={["#0A0C12", "#181C28"]}
            style={[styles.heroCard, { marginHorizontal: 0, borderRadius: 0 }]}
          >
            {/* Avatar */}
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={["#818CF8", "#4F46E5"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarInitial}>{user.userName[0].toUpperCase()}</Text>
              </LinearGradient>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="flash" size={12} color="#0A0C12" />
                </View>
              )}
            </View>

            <Text style={[styles.profileName, { fontFamily: "Inter_700Bold" }]}>{user.userName}</Text>
            <Text style={[styles.profileSub, { fontFamily: "Inter_400Regular" }]}>
              Level {user.level} Scholar
            </Text>

            {/* XP Bar */}
            <View style={styles.xpSection}>
              <View style={styles.xpLabels}>
                <Text style={[styles.xpCurrent, { fontFamily: "Inter_600SemiBold" }]}>{user.xp} XP</Text>
                <Text style={[styles.xpNext, { fontFamily: "Inter_400Regular" }]}>
                  {user.xpToNext - user.xp} to Lv {user.level + 1}
                </Text>
              </View>
              <ProgressBar progress={xpFraction} height={6} color="#818CF8" backgroundColor="#1E2130" />
            </View>
          </LinearGradient>
        </View>

        {/* Stats Grid */}
        <View style={[styles.statsGrid, { paddingHorizontal: 22, marginTop: 20 }]}>
          {STATS.map((stat, i) => (
            <View
              key={stat.label}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadows.sm]}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.color + "20" }]}>
                <Ionicons name={stat.icon} size={16} color={stat.color} />
              </View>
              <Text style={[styles.statVal, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                {statValues[i]}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Streak Calendar */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 14 }]}>
            This Week
          </Text>
          <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadows.sm]}>
            <View style={styles.streakDays}>
              {DAYS.map((day, i) => {
                const active = isActiveToday && i === todayIndex;
                return (
                <View key={i} style={styles.dayCol}>
                  <View
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor: active ? "#FB923C" : colors.muted,
                        borderWidth: i === new Date().getDay() - 1 ? 2 : 0,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    {active && <Ionicons name="flame" size={10} color="#0A0C12" />}
                  </View>
                  <Text style={[styles.dayLabel, { color: active ? colors.text : colors.textMuted, fontFamily: "Inter_500Medium" }]}>
                    {day}
                  </Text>
                </View>
                );
              })}
            </View>
            <View style={[styles.streakSummary, { borderTopColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="flame" size={16} color="#FB923C" />
                <Text style={[styles.streakCount, { color: "#FB923C", fontFamily: "Inter_700Bold" }]}>
                  {user.streak} day streak
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="snow" size={15} color="#60A5FA" />
                <Text style={[styles.streakSub, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>
                  {user.streakFreezes} freeze{user.streakFreezes === 1 ? "" : "s"} saved
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Achievements */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              Achievements
            </Text>
            <Text style={[styles.sectionBadge, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {unlockedCount}/{achievements.length}
            </Text>
          </View>
          <View style={styles.achieveGrid}>
            {achievements.map((a) => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [
                  styles.achieveCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: a.unlocked ? a.color + "40" : colors.cardBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                  shadows.xs,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (a.unlocked) setSelectedAchievement(a);
                }}
              >
                <View
                  style={[
                    styles.achieveIcon,
                    { backgroundColor: a.unlocked ? a.color + "20" : colors.muted },
                  ]}
                >
                  <Ionicons
                    name={a.icon as any}
                    size={22}
                    color={a.unlocked ? a.color : colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.achieveLabel,
                    { color: a.unlocked ? colors.text : colors.textMuted, fontFamily: "Inter_600SemiBold" },
                  ]}
                  numberOfLines={2}
                >
                  {a.label}
                </Text>
                {!a.unlocked && (
                  <Ionicons name="lock-closed" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upgrade Banner */}
        {!isPremium && (
          <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setPaywallVisible(true);
              }}
            >
              <LinearGradient
                colors={["#4F46E5", "#818CF8"]}
                style={styles.upgradeBanner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.upgradeTitle, { fontFamily: "Inter_700Bold" }]}>Go Pro</Text>
                    <Ionicons name="flash" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.upgradeSub, { fontFamily: "Inter_400Regular" }]}>
                    Unlimited AI sessions, no daily limits
                  </Text>
                </View>
                <View style={styles.upgradeChev}>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Referral loop */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <Pressable onPress={handleInvite}>
            <LinearGradient
              colors={["#0E7490", "#22D3EE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.inviteBanner}
            >
              <View style={styles.inviteIcon}>
                <Ionicons name={user.referralRewardGranted ? "snow" : "people"} size={21} color="#083344" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inviteTitle, { fontFamily: "Inter_700Bold" }]}>
                  {user.referralRewardGranted ? "Permanent freeze unlocked" : "Invite friends, earn a freeze"}
                </Text>
                <Text style={[styles.inviteSub, { fontFamily: "Inter_500Medium" }]}>
                  {user.referralRewardGranted
                    ? "Thanks for growing the Isarion study crew."
                    : `${Math.min(3, user.referralsCompleted)} of 3 friends finished onboarding`}
                </Text>
                {!user.referralRewardGranted && (
                  <View style={styles.inviteProgressTrack}>
                    <View
                      style={[
                        styles.inviteProgressFill,
                        { width: `${Math.min(100, (user.referralsCompleted / 3) * 100)}%` },
                      ]}
                    />
                  </View>
                )}
              </View>
              <View style={styles.inviteArrow}>
                <Ionicons name={user.referralRewardGranted ? "checkmark" : "share-social"} size={18} color="#083344" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Backup & Sync */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 14 }]}>
            Backup & Sync
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }, shadows.sm]}>
            {user.email ? (
              <>
                <View style={styles.syncRow}>
                  <View style={[styles.settingIcon, { backgroundColor: "#34D39920" }]}>
                    <Ionicons
                      name={syncStatus === "error" ? "cloud-offline-outline" : "cloud-done-outline"}
                      size={18}
                      color={syncStatus === "error" ? "#F87171" : "#34D399"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      {user.email}
                    </Text>
                    <Text style={[styles.syncStatusTxt, { color: colors.textMuted }]}>
                      {syncStatus === "syncing" && "Backing up…"}
                      {syncStatus === "synced" && "Progress is backed up"}
                      {syncStatus === "error" && "Couldn't reach server — will retry"}
                      {syncStatus === "idle" && "Linked — backs up automatically"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.unlinkBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    unlinkAccount();
                  }}
                >
                  <Text style={[styles.unlinkBtnTxt, { color: colors.textSecondary }]}>Unlink this device</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.syncExplain, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  Link an email so your streak, XP, and path progress survive a reinstall or a new
                  device. No password needed — we just match this device to your email.
                </Text>
                <View style={[styles.emailInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    style={[styles.emailInput, { color: colors.text }]}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    value={emailInput}
                    onChangeText={setEmailInput}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onSubmitEditing={handleLink}
                    returnKeyType="done"
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.linkBtn,
                    { backgroundColor: colors.primary, opacity: pressed || linking ? 0.8 : 1 },
                  ]}
                  onPress={handleLink}
                  disabled={linking}
                >
                  <Text style={styles.linkBtnTxt}>{linking ? "Linking…" : "Save my progress"}</Text>
                </Pressable>
                {linkMessage && (
                  <Text style={[styles.linkMessage, { color: colors.textMuted }]}>{linkMessage}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Settings */}
        <View style={{ paddingHorizontal: 22, marginTop: 28 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 14 }]}>
            Settings
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadows.sm]}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: "#818CF820" }]}>
                <Ionicons name="notifications-outline" size={18} color="#818CF8" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                Streak Reminders
              </Text>
              <Switch
                value={notifEnabled}
                onValueChange={() => {
                  if (!notifLoading) {
                    Haptics.selectionAsync();
                    toggleNotif();
                  }
                }}
                trackColor={{ false: colors.muted, true: "#818CF8" }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
            <Pressable
              style={styles.settingRow}
              onPress={() => router.push("/privacy-policy")}
            >
              <View style={[styles.settingIcon, { backgroundColor: "#34D39920" }]}>
                <Ionicons name="shield-outline" size={18} color="#34D399" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                Privacy Policy
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {selectedAchievement && (
        <AchievementShareModal
          achievement={selectedAchievement}
          userName={user.userName}
          userLevel={user.level}
          referralCode={user.referralCode}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
      <PremiumPaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPurchaseSuccess={() => setIsPremium(true)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: 28, alignItems: "center", gap: 8, paddingBottom: 32 },
  avatarWrap: { position: "relative", marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 34, color: "#fff", fontFamily: "Inter_700Bold" },
  premiumBadge: { position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: "#FBBF24", alignItems: "center", justifyContent: "center" },
  profileName: { fontSize: 24, color: "#F0F2F8", letterSpacing: -0.3 },
  profileSub: { fontSize: 14, color: "#6B7A94" },
  xpSection: { width: "100%", marginTop: 12, gap: 8 },
  xpLabels: { flexDirection: "row", justifyContent: "space-between" },
  xpCurrent: { fontSize: 14, color: "#818CF8" },
  xpNext: { fontSize: 13, color: "#4B5563" },

  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 6 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 15 },
  statLabel: { fontSize: 11, textAlign: "center" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 18 },
  sectionBadge: { fontSize: 13 },

  streakCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  streakDays: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, justifyContent: "space-between" },
  dayCol: { alignItems: "center", gap: 8 },
  dayDot: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dayLabel: { fontSize: 12 },
  streakSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  streakCount: { fontSize: 15 },
  streakSub: { fontSize: 13 },

  achieveGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achieveCard: {
    width: (width - 44 - 20) / 3,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  achieveIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  achieveLabel: { fontSize: 11, textAlign: "center", lineHeight: 15 },

  upgradeBanner: { borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  upgradeTitle: { fontSize: 18, color: "#fff", marginBottom: 4 },
  upgradeSub: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  upgradeChev: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  inviteBanner: { borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  inviteIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.82)", alignItems: "center", justifyContent: "center" },
  inviteTitle: { color: "#ECFEFF", fontSize: 15, marginBottom: 3 },
  inviteSub: { color: "rgba(236,254,255,0.82)", fontSize: 12 },
  inviteProgressTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(8,51,68,0.28)", overflow: "hidden", marginTop: 9 },
  inviteProgressFill: { height: "100%", borderRadius: 3, backgroundColor: "#ECFEFF" },
  inviteArrow: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.78)", alignItems: "center", justifyContent: "center" },

  settingsCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  settingLabel: { flex: 1, fontSize: 15 },
  settingDivider: { height: 1, marginHorizontal: 16 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  syncStatusTxt: { fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
  syncExplain: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  emailInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },
  emailInput: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  linkBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  linkBtnTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  linkMessage: { fontSize: 12, marginTop: 10, lineHeight: 17, fontFamily: "Inter_400Regular" },
  unlinkBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  unlinkBtnTxt: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
