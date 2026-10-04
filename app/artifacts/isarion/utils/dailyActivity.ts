import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "isarion_daily_xp_v1";
const KEEP_DAYS = 60;

export type DailyXpMap = Record<string, number>;

/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's day). */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** XP target for the daily goal: roughly 10 XP per goal minute. */
export function goalXpForMinutes(minutes: number): number {
  return Math.max(20, Math.round(minutes) * 10);
}

export interface DayStat {
  key: string;
  label: string;
  xp: number;
  isToday: boolean;
  metGoal: boolean;
}

/** Last 7 days ending today, oldest first. */
export function lastSevenDays(map: DailyXpMap, goalXp: number, now: Date = new Date()): DayStat[] {
  const out: DayStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateKey(d);
    const xp = map[key] ?? 0;
    out.push({
      key,
      label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      xp,
      isToday: i === 0,
      metGoal: xp >= goalXp,
    });
  }
  return out;
}

export function addToMap(map: DailyXpMap, amount: number, now: Date = new Date()): DailyXpMap {
  const key = dateKey(now);
  const next: DailyXpMap = { ...map, [key]: (map[key] ?? 0) + Math.max(0, Math.round(amount)) };
  const keys = Object.keys(next).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete next[k];
  return next;
}

export async function loadDailyXp(): Promise<DailyXpMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DailyXpMap) : {};
  } catch {
    return {};
  }
}

// Serialize writes so two quick XP awards cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

export function recordDailyXp(amount: number): void {
  if (!(amount > 0)) return;
  queue = queue
    .then(async () => {
      const map = await loadDailyXp();
      await AsyncStorage.setItem(KEY, JSON.stringify(addToMap(map, amount)));
    })
    .catch(() => {});
}
