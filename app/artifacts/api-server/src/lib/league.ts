/**
 * Pure weekly-league rules (no I/O) so they can be unit-tested.
 */

export const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"] as const;
export const MAX_TIER = TIER_NAMES.length - 1;
export const GROUP_SIZE = 30;
/** Largest XP jump credited from one sync; blunts client-side spoofing. */
export const MAX_DELTA_PER_SYNC = 2000;

export type LeagueResult = "promoted" | "demoted" | "stayed";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `d`, as YYYY-MM-DD. */
export function weekStartUtc(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

export function previousWeekStart(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
}

export function weekEndsAt(weekStart: string): string {
  return new Date(Date.parse(`${weekStart}T00:00:00Z`) + 7 * DAY_MS).toISOString();
}

/**
 * Total lifetime XP from the client's (level, xp-within-level) pair. The
 * client starts at 500 XP for level 1 and each next level needs
 * floor(previous * 1.25).
 */
export function totalXpFromLevel(level: number, xpInLevel: number): number {
  let need = 500;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += need;
    need = Math.floor(need * 1.25);
  }
  return total + xpInLevel;
}

export function creditedDelta(previousTotal: number, newTotal: number): number {
  return Math.min(MAX_DELTA_PER_SYNC, Math.max(0, newTotal - previousTotal));
}

export function promoteCount(size: number): number {
  return Math.min(10, Math.max(1, Math.ceil(size / 3)));
}

/** Small groups never demote, so a quiet league does not punish anyone. */
export function demoteCount(size: number): number {
  return size >= 10 ? Math.min(5, Math.floor(size / 6)) : 0;
}

/**
 * Decides tier movement from a finished week. `rank` is 1-based within the
 * group. Promotion needs at least some XP earned; demotion hits the bottom
 * of larger groups.
 */
export function resolveMovement(
  tier: number,
  rank: number,
  size: number,
  weeklyXp: number,
): { tier: number; result: LeagueResult } {
  if (rank <= promoteCount(size) && weeklyXp > 0 && tier < MAX_TIER) {
    return { tier: tier + 1, result: "promoted" };
  }
  if (rank > size - demoteCount(size) && tier > 0) {
    return { tier: tier - 1, result: "demoted" };
  }
  return { tier, result: "stayed" };
}
