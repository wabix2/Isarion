/**
 * Isarion curriculum model.
 *
 * A subject is a graph of small skills. Each skill lists the skills a student
 * must already understand ("prereqs"), so the app can:
 *   - place a new student at the right starting point,
 *   - show a roadmap to any goal (e.g. "ready for calculus"),
 *   - trace a struggle back to the missing prerequisite.
 *
 * Progress is stored in the existing `user.skillProgress` map (0..1), keyed by
 * `skillKey(subject, skillId)` -> "Math:derivatives". The old numeric keys
 * ("Math:0".."Math:4") can live beside them while the UI is migrated.
 */

export type SkillId = string;

/** One multiple-choice question used by the placement test. */
export interface Probe {
  question: string;
  /** Always exactly 4 options. Shuffle when showing (see presentProbe). */
  options: [string, string, string, string];
  /** Index of the correct option in `options`. */
  answer: 0 | 1 | 2 | 3;
  /** One-line explanation shown after answering. */
  why: string;
}

export interface Skill {
  id: SkillId;
  unit: string;
  title: string;
  /** One plain sentence: what the student will be able to do. */
  blurb: string;
  prereqs: SkillId[];
  /** Rough study time to learn the skill, in minutes. */
  minutes: number;
  probe: Probe;
}

/** A named milestone: finish all `targets` (and what they need). */
export interface Goal {
  id: string;
  title: string;
  blurb: string;
  targets: SkillId[];
}

export interface Curriculum {
  subject: string;
  /** Display order of units. */
  units: string[];
  skills: Skill[];
  goals: Goal[];
}
