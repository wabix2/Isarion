// Short, honest nudges used when someone is about to abandon a session or a streak.
// Framing goal: truthfully name the cost of stopping without shaming the person.

export const QUIT_WARNING_QUOTES = [
  "If you stop now, it'll be harder to pick this back up tomorrow than to just finish today.",
  "You're most of the way there. Walking away now means starting over later.",
  "Consistency compounds — one skipped session makes the next one easier to skip too.",
  "The hardest part was starting. You already did that — see it through.",
  "Future you will thank you for finishing this instead of restarting it next week.",
  "Momentum is easier to keep than to rebuild from zero.",
  "A few more minutes now saves you from relearning this later.",
];

export const STREAK_RISK_QUOTES = [
  "Your streak is still alive today — a quick session keeps it that way.",
  "One short session tonight keeps the streak going. Skip it, and tomorrow starts back at zero.",
  "Streaks are built one day at a time, and lost in a single day too.",
  "You've come this far — don't let today be the day it resets.",
];

export function randomQuote(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}
