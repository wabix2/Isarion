/**
 * Explicit, user-initiated merge of on-device (guest) progress with an
 * account backup. Never discards either side: counters and mastery take the
 * maximum, subject lists are unioned, and XP/level come from whichever side
 * has more total progress.
 */

export interface LocalProgress {
  email: string | null;
  userName: string;
  xp: number;
  level: number;
  streak: number;
  streakFreezes: number;
  totalQuizzes: number;
  totalFeynmanSessions: number;
  dailyGoalMinutes: number;
  subjects: string[];
  skillProgress: Record<string, number>;
  referralCode: string;
  referralsCompleted: number;
  referralRewardGranted: boolean;
}

export interface RemoteProgressShape {
  name: string;
  xp: number;
  level: number;
  streak: number;
  streakFreezes?: number;
  totalQuizzes: number;
  totalFeynmanSessions?: number;
  dailyGoalMinutes?: number;
  subjects?: string[];
  skillProgress?: Record<string, number>;
  referralCode?: string;
  referralCount?: number;
  referralRewardGranted?: boolean;
}

export function mergeProgress<T extends LocalProgress>(
  local: T,
  remote: RemoteProgressShape,
  email: string,
): { next: T; usedRemote: boolean } {
  const usedRemote = remote.level * 100000 + remote.xp > local.level * 100000 + local.xp;

  const skillProgress: Record<string, number> = { ...local.skillProgress };
  for (const [k, v] of Object.entries(remote.skillProgress ?? {})) {
    if (typeof v === "number" && Number.isFinite(v)) {
      skillProgress[k] = Math.max(skillProgress[k] ?? 0, Math.min(1, Math.max(0, v)));
    }
  }

  const shared = {
    email,
    streak: Math.max(local.streak, remote.streak ?? 0),
    streakFreezes: Math.max(local.streakFreezes, remote.streakFreezes ?? 1),
    totalQuizzes: Math.max(local.totalQuizzes, remote.totalQuizzes ?? 0),
    totalFeynmanSessions: Math.max(local.totalFeynmanSessions, remote.totalFeynmanSessions ?? 0),
    subjects: Array.from(new Set([...local.subjects, ...(remote.subjects ?? [])])),
    skillProgress,
    referralsCompleted: Math.max(local.referralsCompleted, remote.referralCount ?? 0),
    referralRewardGranted: local.referralRewardGranted || remote.referralRewardGranted === true,
  };

  const next: T = usedRemote
    ? {
        ...local,
        ...shared,
        userName: remote.name || local.userName,
        xp: remote.xp,
        level: remote.level,
        dailyGoalMinutes: remote.dailyGoalMinutes ?? local.dailyGoalMinutes,
        referralCode: remote.referralCode || local.referralCode,
      }
    : { ...local, ...shared };

  return { next, usedRemote };
}
