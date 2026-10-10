import type { Lesson, LessonMeta } from "../lessonTypes";
import { BIOLOGY_ENZYMES } from "./biology-enzymes";
import { CHEMISTRY_STOICHIOMETRY } from "./chemistry-stoichiometry";
import { MATH_LINEAR_EQUATIONS } from "./math-linear-equations";
import { PHYSICS_ELECTRIC_CIRCUITS } from "./physics-electric-circuits";

/**
 * Published lessons. They ship inside the app bundle as compact text (a few
 * KB each), so they work offline from first launch with no download step.
 * Only lessons that pass validateLesson() belong here.
 */
export const PUBLISHED_LESSONS: Lesson[] = [
  MATH_LINEAR_EQUATIONS,
  PHYSICS_ELECTRIC_CIRCUITS,
  CHEMISTRY_STOICHIOMETRY,
  BIOLOGY_ENZYMES,
];

const BY_ID = new Map(PUBLISHED_LESSONS.map((l) => [l.id, l]));

export function getLesson(id: string): Lesson | null {
  return BY_ID.get(id) ?? null;
}

export function lessonForSkill(subject: string, skillId: string): Lesson | null {
  return PUBLISHED_LESSONS.find((l) => l.subject === subject && l.skillId === skillId) ?? null;
}

export function lessonMetas(subject?: string): LessonMeta[] {
  return PUBLISHED_LESSONS.filter((l) => !subject || l.subject === subject).map((l) => ({
    id: l.id,
    version: l.version,
    subject: l.subject,
    skillId: l.skillId,
    title: l.title,
    minutes: l.minutes,
    blurb: l.objectives[0],
  }));
}
