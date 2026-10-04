import type { Ionicons } from "@expo/vector-icons";

export type TimePeriod = "morning" | "afternoon" | "evening" | "night";

export interface PeriodTheme {
  period: TimePeriod;
  greeting: string;
  /** Ionicons glyph name for the period. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Gradient stops used behind the home screen's hero card. */
  gradient: [string, string, string];
  /** Color the greeting/quote text should sit on top of (light on dark gradients). */
  onGradientText: string;
  onGradientMuted: string;
}

/**
 * Local device time only — this is intentionally not timezone-aware beyond
 * "whatever time it is where the phone is right now," which is exactly what
 * a morning/evening greeting should reflect.
 */
export function getTimePeriod(date: Date = new Date()): TimePeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getPeriodTheme(period: TimePeriod): PeriodTheme {
  switch (period) {
    case "morning":
      return {
        period,
        greeting: "Good morning",
        icon: "partly-sunny",
        gradient: ["#312E81", "#F97316", "#FBBF24"],
        onGradientText: "#FFFFFF",
        onGradientMuted: "#FDE9C8",
      };
    case "afternoon":
      return {
        period,
        greeting: "Good afternoon",
        icon: "sunny",
        gradient: ["#0C4A6E", "#0EA5E9", "#818CF8"],
        onGradientText: "#FFFFFF",
        onGradientMuted: "#DCEFFF",
      };
    case "evening":
      return {
        period,
        greeting: "Good evening",
        icon: "partly-sunny-outline",
        gradient: ["#4C1D95", "#C026D3", "#FB7185"],
        onGradientText: "#FFFFFF",
        onGradientMuted: "#F3D8F9",
      };
    case "night":
      return {
        period,
        greeting: "Good night",
        icon: "moon",
        gradient: ["#05060A", "#0A0C12", "#1E1B4B"],
        onGradientText: "#F0F2F8",
        onGradientMuted: "#8892A4",
      };
  }
}

// Original lines — deliberately not attributed to anyone, so nothing here
// is a quotation. Tone matches short, learning-science-informed nudges
// (spaced repetition, active recall, consistency) rather than generic
// motivational filler.
const QUOTES: string[] = [
  "Small steps, repeated daily, outperform big leaps taken rarely.",
  "Understanding beats memorizing, every time.",
  "The concept that confuses you today is the one you'll explain effortlessly next week.",
  "Progress hides inside repetition.",
  "Confusion is what learning feels like while it's happening.",
  "You don't need more time today. You need five focused minutes.",
  "Mastery is just familiarity you haven't noticed yet.",
  "The best time to review this was yesterday. The next best time is now.",
  "One good question is worth ten answers.",
  "Consistency turns effort into skill.",
  "What feels hard right now will feel obvious later.",
  "Learning sticks when you explain it, not just when you read it.",
  "Every expert was once confused by the basics.",
  "Today's five minutes is tomorrow's shortcut.",
];

const NIGHT_QUOTES: string[] = [
  "A short review before sleep helps it consolidate — no need for more than that tonight.",
  "Memory strengthens overnight. A quick pass now, then let it rest.",
  "One light review, then sleep — that's the whole plan tonight.",
];

/**
 * Deterministic by day, not random per render — the quote should stay put
 * for the whole day rather than reshuffling every time the screen mounts.
 * Night uses a smaller, deliberately calmer set: the goal at that hour is a
 * gentle nudge toward winding down, not more stimulation to keep someone up.
 */
export function getDailyQuote(period: TimePeriod, date: Date = new Date()): string {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86_400_000
  );
  const pool = period === "night" ? NIGHT_QUOTES : QUOTES;
  return pool[dayOfYear % pool.length];
}
