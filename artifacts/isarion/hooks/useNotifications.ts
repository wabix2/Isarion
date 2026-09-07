import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { PATH_STAGE_TITLES, UNLOCK_THRESHOLD, findWeakestActiveStage } from "@/utils/learningPath";

const PREF_KEY = "@lumiq_notifications_enabled";
const CHANNEL_ID = "streak-reminder";

export interface NotificationContext {
  streak: number;
  streakFreezes: number;
  subjects: string[];
  skillProgress: Record<string, number>;
}

interface ReminderContent {
  title: string;
  body: string;
}

function buildReminderContent(ctx: NotificationContext): ReminderContent {
  const weakest = findWeakestActiveStage(ctx.subjects, ctx.skillProgress);

  // A day is genuinely on the line — no freeze left to fall back on.
  if (ctx.streak > 0 && ctx.streakFreezes === 0) {
    if (weakest) {
      return {
        title: `Your ${ctx.streak}-day streak needs today`,
        body: `No freeze left to cover a miss. A quick ${PATH_STAGE_TITLES[weakest.stageIndex]} review in ${weakest.subject} keeps it alive.`,
      };
    }
    return {
      title: `Your ${ctx.streak}-day streak needs today`,
      body: "No freeze left to cover a miss — one short session keeps it going.",
    };
  }

  // Point at the specific weak stage — this is the spaced-repetition part:
  // surface what's actually due for reinforcement, not a random subject.
  if (weakest) {
    const pct = Math.round(weakest.mastery * 100);
    return {
      title: `${weakest.subject}: ${PATH_STAGE_TITLES[weakest.stageIndex]} is due`,
      body: `You're at ${pct}% mastery here — a short review now is when spaced repetition works best.`,
    };
  }

  // No weak stage found (e.g. everything mastered, or no subjects yet).
  if (ctx.streak > 0) {
    return {
      title: "Keep your streak moving",
      body: `Day ${ctx.streak} and counting — a short session today keeps the habit alive.`,
    };
  }

  return {
    title: "Ready for one focused win?",
    body: "Open Isarion and make one concept clearer.",
  };
}

async function setupAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Daily Streak Reminder",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
    });
  }
}

async function requestPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function scheduleDailyReminder(ctx: NotificationContext) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const msg = buildReminderContent(ctx);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title,
      body: msg.body,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

async function cancelReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * @param context Real progress data used to personalize the daily reminder
 * (which subject/stage is due for review, and honest streak/freeze status).
 * Pass the latest values from `useUser()` — the hook re-schedules whenever
 * they change meaningfully so the notification stays accurate.
 */
export function useNotifications(context: NotificationContext) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stabilize skillProgress/subjects identity for the effect dependency
  // array below (they're new object/array references on every render).
  const contextKey = useMemo(
    () =>
      JSON.stringify({
        streak: context.streak,
        streakFreezes: context.streakFreezes,
        subjects: context.subjects,
        skillProgress: context.skillProgress,
      }),
    [context.streak, context.streakFreezes, context.subjects, context.skillProgress]
  );

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    setupAndroidChannel().catch(() => {});
    AsyncStorage.getItem(PREF_KEY)
      .then((val) => {
        setEnabled(val === "true");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Keep the scheduled reminder's content current as progress changes,
  // without requiring the user to retoggle the setting.
  useEffect(() => {
    if (loading || !enabled) return;
    scheduleDailyReminder(context).catch(() => {});
    // contextKey captures everything context depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, enabled, contextKey]);

  const toggle = useCallback(async () => {
    const next = !enabled;
    if (next) {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
      await scheduleDailyReminder(context);
    } else {
      await cancelReminders();
    }
    setEnabled(next);
    await AsyncStorage.setItem(PREF_KEY, String(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, contextKey]);

  return { enabled, loading, toggle };
}
