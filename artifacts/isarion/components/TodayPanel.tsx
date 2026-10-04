import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { PATH_STAGE_TITLES, UNLOCK_THRESHOLD, findNextStage } from "@/utils/learningPath";
import { goalXpForMinutes, lastSevenDays, loadDailyXp, type DailyXpMap } from "@/utils/dailyActivity";

/**
 * Home "Today" panel: daily goal progress, a 7-day activity strip and
 * per-subject path progress. Gives the learner the visible "you're making
 * progress" feedback loop that Duolingo and Khan Academy lean on.
 */
export function TodayPanel() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useUser();
  const [map, setMap] = useState<DailyXpMap>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadDailyXp().then((m) => {
        if (active) setMap(m);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const goalXp = goalXpForMinutes(user.dailyGoalMinutes);
  const days = useMemo(() => lastSevenDays(map, goalXp), [map, goalXp]);
  const today = days[days.length - 1];
  const progress = Math.min(1, today.xp / goalXp);
  const weekXp = days.reduce((sum, d) => sum + d.xp, 0);
  const goalMet = today.xp >= goalXp;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.heading, { color: colors.text }]}>Daily goal</Text>
          <Text style={[styles.small, { color: goalMet ? "#22C55E" : colors.textSecondary }]}>
            {goalMet ? "Goal reached 🎉" : `${today.xp} / ${goalXp} XP`}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: goalMet ? "#22C55E" : colors.primary },
            ]}
          />
        </View>

        <View style={styles.week}>
          {days.map((d) => (
            <View key={d.key} style={styles.dayCol}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: d.metGoal ? "#22C55E" : d.xp > 0 ? colors.primary + "55" : colors.border,
                    borderColor: d.isToday ? colors.primary : "transparent",
                  },
                ]}
              >
                {d.metGoal && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.dayLabel, { color: d.isToday ? colors.text : colors.textSecondary }]}>
                {d.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.small, { color: colors.textSecondary }]}>{weekXp} XP this week</Text>
      </View>

      {user.subjects.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.heading, { color: colors.text, marginBottom: 12 }]}>Your paths</Text>
          {user.subjects.map((subject) => {
            const done = PATH_STAGE_TITLES.filter(
              (_, i) => (user.skillProgress[`${subject}:${i}`] ?? 0) >= UNLOCK_THRESHOLD,
            ).length;
            const next = findNextStage(subject, user.skillProgress);
            return (
              <Pressable
                key={subject}
                onPress={() => router.push({ pathname: "/(tabs)/study", params: { subject } })}
                style={styles.pathRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pathTitle, { color: colors.text }]}>{subject}</Text>
                  <Text style={[styles.small, { color: colors.textSecondary }]}>
                    {next ? `Next: ${PATH_STAGE_TITLES[next.stageIndex]}` : "Path complete"} · {done}/
                    {PATH_STAGE_TITLES.length} stages
                  </Text>
                  <View style={[styles.track, { backgroundColor: colors.border, marginTop: 8 }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.round((done / PATH_STAGE_TITLES.length) * 100)}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, marginTop: 18 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: 16, fontWeight: "700" },
  small: { fontSize: 12, fontWeight: "600" },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  fill: { height: 8, borderRadius: 4 },
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 10 },
  dayCol: { alignItems: "center", gap: 6 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: { fontSize: 11, fontWeight: "600" },
  pathRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  pathTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
});
