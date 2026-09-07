import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { makeReferralCode } from "@/utils/referral";
import { API_BASE } from "@/utils/apiConfig";

interface UserState {
  userName: string;
  level: number;
  xp: number;
  xpToNext: number;
  streak: number;
  streakFreezes: number;
  totalQuizzes: number;
  totalFeynmanSessions: number;
  rank: number;
  feynmanSessionsToday: number;
  lastActiveDate: string;
  isOnboarded: boolean;
  subjects: string[];
  dailyGoalMinutes: number;
  skillProgress: Record<string, number>; // skillId -> 0..1 mastery
  email: string | null;
  referralCode: string;
  referralsCompleted: number;
  referralRewardGranted: boolean;
}

type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface RemoteProgress {
  name: string;
  xp: number;
  level: number;
  streak: number;
  streakFreezes: number;
  totalQuizzes: number;
  totalFeynmanSessions?: number;
  subjects: string[];
  dailyGoalMinutes: number;
  skillProgress: Record<string, number>;
  referralCode?: string | null;
  referralCount?: number;
  referralRewardGranted?: boolean;
}

interface LevelUpEvent {
  level: number;
}

interface FreezeUsedEvent {
  freezesRemaining: number;
}

interface UserContextType {
  user: UserState;
  addXP: (amount: number) => void;
  incrementFeynman: () => void;
  incrementQuizzes: () => void;
  completeOnboarding: (
    name: string,
    subjects: string[],
    dailyGoalMinutes: number,
    referredByCode?: string
  ) => void;
  advanceSkill: (skillId: string, scoreFraction: number) => void;
  pendingLevelUp: LevelUpEvent | null;
  clearLevelUp: () => void;
  pendingStreakMilestone: number | null;
  clearStreakMilestone: () => void;
  pendingFreezeUsed: FreezeUsedEvent | null;
  clearFreezeUsed: () => void;
  linkAccount: (email: string) => Promise<{ ok: boolean; message: string }>;
  unlinkAccount: () => void;
  syncStatus: SyncStatus;
}

const DEFAULT: UserState = {
  userName: "Scholar",
  level: 1,
  xp: 0,
  xpToNext: 500,
  streak: 0,
  streakFreezes: 1,
  totalQuizzes: 0,
  totalFeynmanSessions: 0,
  rank: 999,
  feynmanSessionsToday: 0,
  lastActiveDate: "",
  isOnboarded: false,
  subjects: [],
  dailyGoalMinutes: 10,
  skillProgress: {},
  email: null,
  referralCode: "",
  referralsCompleted: 0,
  referralRewardGranted: false,
};

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
// One freeze earned per 7-day streak milestone, capped so it stays a modest
// safety net rather than a way to coast indefinitely without ever studying.
const MAX_STREAK_FREEZES = 2;

const KEY = "@lumiq_user_v2";
const BASE_URL = API_BASE;

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();
  const [user, setUser] = useState<UserState>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpEvent | null>(null);
  const [pendingStreakMilestone, setPendingStreakMilestone] = useState<number | null>(null);
  const [pendingFreezeUsed, setPendingFreezeUsed] = useState<FreezeUsedEvent | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registeredReferralCode = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) {
          const next = { ...DEFAULT, referralCode: makeReferralCode(userId) };
          setUser(next);
          AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
          setLoaded(true);
          return;
        }
        const parsed = JSON.parse(raw) as UserState;
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86_400_000).toDateString();

        // Fix streak
        let streak = parsed.streak ?? 0;
        let streakFreezes = parsed.streakFreezes ?? 0;
        if (parsed.lastActiveDate === today) {
          // already counted today
        } else if (parsed.lastActiveDate === yesterday) {
          streak += 1; // consecutive day!
          if (STREAK_MILESTONES.includes(streak)) {
            setPendingStreakMilestone(streak);
            // Earn a freeze at weekly milestones, capped so it stays a safety
            // net rather than a way to skip studying indefinitely.
            if (streak % 7 === 0 && streakFreezes < MAX_STREAK_FREEZES) {
              streakFreezes += 1;
            }
          }
        } else if (parsed.lastActiveDate !== today && parsed.lastActiveDate !== "") {
          if (streakFreezes > 0) {
            // Spend a freeze to protect the streak — and say so. A freeze that
            // burns silently isn't a fair trade for the user; they earned it
            // and should see it spent.
            streakFreezes -= 1;
            setPendingFreezeUsed({ freezesRemaining: streakFreezes });
          } else {
            streak = 1; // broke streak, start fresh
          }
        }

        // Reset daily feynman counter
        const feynmanSessionsToday =
          parsed.lastActiveDate === today ? parsed.feynmanSessionsToday : 0;

        const next: UserState = {
          ...DEFAULT,
          ...parsed,
          referralCode: parsed.referralCode || makeReferralCode(userId),
          referralsCompleted: parsed.referralsCompleted ?? 0,
          referralRewardGranted: parsed.referralRewardGranted ?? false,
          streak,
          streakFreezes,
          feynmanSessionsToday,
          lastActiveDate: today,
        };

        setUser(next);
        // Persist immediately: this branch can consume a freeze or award one,
        // and without a write here that change is lost if the app closes
        // before any other action triggers a save — the freeze would then be
        // (re-)evaluated against stale data on the next launch.
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  const persist = useCallback((next: UserState) => {
    setUser(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addXP = useCallback((amount: number) => {
    setUser((prev) => {
      let { xp, xpToNext, level } = prev;
      const startLevel = level;
      xp += amount;
      while (xp >= xpToNext) {
        xp -= xpToNext;
        level += 1;
        xpToNext = Math.floor(xpToNext * 1.25);
      }
      if (level > startLevel) setPendingLevelUp({ level });
      const next = { ...prev, xp, xpToNext, level };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const advanceSkill = useCallback((skillId: string, scoreFraction: number) => {
    setUser((prev) => {
      const current = prev.skillProgress[skillId] ?? 0;
      const value = Math.max(current, Math.max(0, Math.min(1, scoreFraction)));
      const next = { ...prev, skillProgress: { ...prev.skillProgress, [skillId]: value } };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearLevelUp = useCallback(() => setPendingLevelUp(null), []);
  const clearStreakMilestone = useCallback(() => setPendingStreakMilestone(null), []);
  const clearFreezeUsed = useCallback(() => setPendingFreezeUsed(null), []);

  // Auto-backup to the server a couple seconds after any change, once an account is linked.
  useEffect(() => {
    if (!loaded || !user.email || !BASE_URL) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setSyncStatus("syncing");
      getToken()
        .then((token) =>
          fetch(`${BASE_URL}/api/progress/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
          email: user.email,
          name: user.userName,
          xp: user.xp,
          level: user.level,
          streak: user.streak,
          streakFreezes: user.streakFreezes,
          totalQuizzes: user.totalQuizzes,
          totalFeynmanSessions: user.totalFeynmanSessions,
          feynmanSessionsToday: user.feynmanSessionsToday,
          lastActiveDate: user.lastActiveDate,
          subjects: user.subjects,
          dailyGoalMinutes: user.dailyGoalMinutes,
          skillProgress: user.skillProgress,
              referralCode: user.referralCode,
            }),
          }),
        )
        .then((r) => {
          if (!r.ok) throw new Error("sync failed");
          setSyncStatus("synced");
        })
        .catch(() => setSyncStatus("error"));
    }, 2000);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [
    loaded,
    user.email,
    user.userName,
    user.xp,
    user.level,
    user.streak,
    user.streakFreezes,
    user.totalQuizzes,
    user.totalFeynmanSessions,
    user.feynmanSessionsToday,
    user.lastActiveDate,
    user.subjects,
    user.dailyGoalMinutes,
    user.skillProgress,
    user.referralCode,
    getToken,
  ]);

  // Register the invite code independently of email backup. Referrals should
  // work for every signed-in learner, not only users who linked a device.
  useEffect(() => {
    if (!loaded || !userId || !user.referralCode || !BASE_URL) return;
    if (registeredReferralCode.current === user.referralCode) return;
    registeredReferralCode.current = user.referralCode;

    getToken()
      .then((token) =>
        fetch(`${BASE_URL}/api/referrals/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ code: user.referralCode }),
        })
      )
      .then((response) => {
        if (!response.ok) return null;
        return getToken().then((token) =>
          fetch(`${BASE_URL}/api/referrals/me`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
        );
      })
      .then((response) => (response?.ok ? response.json() : null))
      .then((result: { referralsCompleted?: number; rewardGranted?: boolean } | null) => {
        if (!result) return;
        setUser((prev) => {
          const next = {
            ...prev,
            referralsCompleted: Math.max(prev.referralsCompleted, result.referralsCompleted ?? 0),
            referralRewardGranted: prev.referralRewardGranted || result.rewardGranted === true,
          };
          AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      })
      .catch(() => {
        registeredReferralCode.current = null;
      });
  }, [getToken, loaded, user.referralCode, userId]);

  // Link (or restore) an account by email. If a backup already exists for this email and
  // has more progress than the local device, the remote copy wins; otherwise the local
  // progress is preserved and immediately backed up under this email.
  const linkAccount = useCallback(
    async (rawEmail: string): Promise<{ ok: boolean; message: string }> => {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return { ok: false, message: "Enter a valid email address." };
      }
      if (!BASE_URL) {
        return { ok: false, message: "Sync isn't available in this environment." };
      }
      try {
        const token = await getToken();
        const res = await fetch(`${BASE_URL}/api/progress/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.status === 401) {
          return { ok: false, message: "Sign in to link your progress securely." };
        }
        if (res.status === 404) {
          // No backup yet — link this device's progress to the email going forward.
          setUser((prev) => {
            const next = { ...prev, email };
            AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
            return next;
          });
          return { ok: true, message: "Account linked. Your progress will now be backed up." };
        }
        if (!res.ok) throw new Error("lookup failed");
        const remote = (await res.json()) as RemoteProgress;

        const localScore = user.level * 100000 + user.xp;
        const remoteScore = remote.level * 100000 + remote.xp;
        const useRemote = remoteScore > localScore;

        const mergedSkillProgress: Record<string, number> = { ...user.skillProgress };
        for (const [k, v] of Object.entries(remote.skillProgress ?? {})) {
          mergedSkillProgress[k] = Math.max(mergedSkillProgress[k] ?? 0, v);
        }
        const mergedSubjects = Array.from(new Set([...user.subjects, ...(remote.subjects ?? [])]));

        const next: UserState = useRemote
          ? {
              ...user,
              email,
              userName: remote.name,
              xp: remote.xp,
              level: remote.level,
              streak: Math.max(user.streak, remote.streak),
              streakFreezes: Math.max(user.streakFreezes, remote.streakFreezes ?? 1),
              totalQuizzes: Math.max(user.totalQuizzes, remote.totalQuizzes),
              totalFeynmanSessions: Math.max(user.totalFeynmanSessions, remote.totalFeynmanSessions ?? 0),
              dailyGoalMinutes: remote.dailyGoalMinutes ?? user.dailyGoalMinutes,
              subjects: mergedSubjects,
              skillProgress: mergedSkillProgress,
              referralCode: remote.referralCode || user.referralCode,
              referralsCompleted: Math.max(user.referralsCompleted, remote.referralCount ?? 0),
              referralRewardGranted: user.referralRewardGranted || remote.referralRewardGranted === true,
            }
          : {
              ...user,
              email,
              streak: Math.max(user.streak, remote.streak),
              streakFreezes: Math.max(user.streakFreezes, remote.streakFreezes ?? 1),
              totalQuizzes: Math.max(user.totalQuizzes, remote.totalQuizzes),
              totalFeynmanSessions: Math.max(user.totalFeynmanSessions, remote.totalFeynmanSessions ?? 0),
              subjects: mergedSubjects,
              skillProgress: mergedSkillProgress,
              referralCode: user.referralCode,
              referralsCompleted: Math.max(user.referralsCompleted, remote.referralCount ?? 0),
              referralRewardGranted: user.referralRewardGranted || remote.referralRewardGranted === true,
            };

        persist(next);
        return {
          ok: true,
          message: useRemote
            ? "Welcome back — restored your saved progress."
            : "Account linked. This device already had more progress, so it was kept and backed up.",
        };
      } catch {
        return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
      }
    },
    [getToken, user, persist]
  );

  const redeemReferral = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code || !BASE_URL) return;
      try {
        const token = await getToken();
        const response = await fetch(`${BASE_URL}/api/referrals/redeem`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ code }),
        });
        if (!response.ok) return;
        const result = (await response.json()) as {
          referralsCompleted?: number;
          rewardGranted?: boolean;
        };
        setUser((prev) => {
          const next = {
            ...prev,
            referralsCompleted: Math.max(prev.referralsCompleted, result.referralsCompleted ?? 0),
            referralRewardGranted: prev.referralRewardGranted || result.rewardGranted === true,
          };
          AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      } catch {
        // Referral redemption is best effort; onboarding should never be blocked by it.
      }
    },
    [getToken]
  );

  const unlinkAccount = useCallback(() => {
    setUser((prev) => {
      const next = { ...prev, email: null };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setSyncStatus("idle");
  }, []);

  const incrementFeynman = useCallback(() => {
    setUser((prev) => {
      const next = {
        ...prev,
        feynmanSessionsToday: prev.feynmanSessionsToday + 1,
        totalFeynmanSessions: prev.totalFeynmanSessions + 1,
      };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    addXP(10);
  }, [addXP]);

  const incrementQuizzes = useCallback(() => {
    // XP is awarded separately by QuizModal per correct answer — don't double-add here
    setUser((prev) => {
      const next = { ...prev, totalQuizzes: prev.totalQuizzes + 1 };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(
    (name: string, subjects: string[], dailyGoalMinutes: number, referredByCode?: string) => {
      const today = new Date().toDateString();
      const next = {
        ...DEFAULT,
        referralCode: user.referralCode || makeReferralCode(userId),
        userName: name.trim() || "Scholar",
        isOnboarded: true,
        lastActiveDate: today,
        streak: 1,
        subjects,
        dailyGoalMinutes,
      };
      persist(next);
      if (referredByCode) void redeemReferral(referredByCode);
    },
    [persist, redeemReferral, user.referralCode, userId]
  );

  if (!loaded) return null;

  return (
    <UserContext.Provider
      value={{
        user,
        addXP,
        incrementFeynman,
        incrementQuizzes,
        completeOnboarding,
        advanceSkill,
        pendingLevelUp,
        clearLevelUp,
        pendingStreakMilestone,
        clearStreakMilestone,
        pendingFreezeUsed,
        clearFreezeUsed,
        linkAccount,
        unlinkAccount,
        syncStatus,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
