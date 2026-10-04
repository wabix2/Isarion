/**
 * Single source of truth for the study path's stage structure and the
 * "what's most worth reviewing right now" logic.
 *
 * Previously this existed twice — once in app/(tabs)/study.tsx and once,
 * duplicated by hand, in hooks/useNotifications.ts (which even carried a
 * comment warning the two had to be kept in sync manually). Importing from
 * here instead removes that drift risk entirely.
 */

export const PATH_STAGE_TITLES = [
  "Foundations",
  "Core Concepts",
  "Practice",
  "Application",
  "Mastery Check",
] as const;

export type PathStageMode = "quiz" | "flashcard" | "feynman";

/**
 * The mechanic each stage uses, aligned index-for-index with
 * PATH_STAGE_TITLES. Recognition modes (quiz, flashcard) build the base;
 * Mastery Check is deliberately "feynman" — teaching a skill back is the
 * actual test of whether it's mastered, not just another MCQ pass. This is
 * also the single place that decision lives, so study.tsx and any other
 * consumer stay in sync automatically instead of re-deriving it (e.g. the
 * old `i % 2` alternation had no room for a third mechanic).
 */
export const PATH_STAGE_MODES: readonly PathStageMode[] = [
  "quiz",
  "flashcard",
  "quiz",
  "flashcard",
  "feynman",
] as const;

export const UNLOCK_THRESHOLD = 0.6;
export const MASTERED_THRESHOLD = 0.8;

export interface WeakestStage {
  subject: string;
  stageIndex: number;
  mastery: number;
}

/**
 * Finds the subject and stage most worth reviewing: the lowest-mastery
 * unlocked-but-incomplete stage across the given subjects. Used to point
 * both the daily reminder and in-app personalization at the same place.
 */
export function findWeakestActiveStage(
  subjects: string[],
  skillProgress: Record<string, number>
): WeakestStage | null {
  let best: WeakestStage | null = null;

  for (const subject of subjects) {
    for (let stageIndex = 0; stageIndex < PATH_STAGE_TITLES.length; stageIndex++) {
      const skillId = `${subject}:${stageIndex}`;
      const mastery = skillProgress[skillId] ?? 0;
      const prevMastery = stageIndex === 0 ? 1 : skillProgress[`${subject}:${stageIndex - 1}`] ?? 0;
      const unlocked = stageIndex === 0 || prevMastery >= UNLOCK_THRESHOLD;
      if (!unlocked || mastery >= UNLOCK_THRESHOLD) continue;

      if (!best || mastery < best.mastery) {
        best = { subject, stageIndex, mastery };
      }
    }
  }
  return best;
}

/**
 * Same idea, scoped to a single subject: the first stage that's unlocked
 * but not yet mastered. Used by the study screen to tell the person what's
 * next within whichever subject they currently have selected.
 */
export function findNextStage(
  subject: string,
  skillProgress: Record<string, number>
): WeakestStage | null {
  for (let stageIndex = 0; stageIndex < PATH_STAGE_TITLES.length; stageIndex++) {
    const skillId = `${subject}:${stageIndex}`;
    const mastery = skillProgress[skillId] ?? 0;
    const prevMastery = stageIndex === 0 ? 1 : skillProgress[`${subject}:${stageIndex - 1}`] ?? 0;
    const unlocked = stageIndex === 0 || prevMastery >= UNLOCK_THRESHOLD;
    if (unlocked && mastery < MASTERED_THRESHOLD) {
      return { subject, stageIndex, mastery };
    }
  }
  return null;
}
