import { BIOLOGY_CURRICULUM } from "./biology";
import { CHEMISTRY_CURRICULUM } from "./chemistry";
import { buildIndex } from "./graph";
import type { CurriculumIndex } from "./graph";
import { MATH_CURRICULUM } from "./math";
import { PHYSICS_CURRICULUM } from "./physics";
import type { Curriculum } from "./types";

/**
 * Subjects with a real skill graph. Subject names match the app's existing
 * subject chips. Subjects not listed (History) keep the 5-stage study path.
 * Computer Science is intentionally not part of this curriculum release.
 */
export const CURRICULA: Record<string, Curriculum> = {
  Math: MATH_CURRICULUM,
  Physics: PHYSICS_CURRICULUM,
  Chemistry: CHEMISTRY_CURRICULUM,
  Biology: BIOLOGY_CURRICULUM,
};

const cache = new Map<string, CurriculumIndex>();

export function hasCurriculum(subject: string): boolean {
  return subject in CURRICULA;
}

export function getCurriculum(subject: string): { curriculum: Curriculum; index: CurriculumIndex } | null {
  const curriculum = CURRICULA[subject];
  if (!curriculum) return null;
  let index = cache.get(subject);
  if (!index) {
    index = buildIndex(curriculum);
    cache.set(subject, index);
  }
  return { curriculum, index };
}

export * from "./graph";
export * from "./placement";
export * from "./types";
export * from "./lessonTypes";
