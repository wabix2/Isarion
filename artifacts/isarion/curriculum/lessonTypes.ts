import type { SkillId } from "./types";

/**
 * Lesson content schema. Lessons are plain JSON-serialisable data so the API
 * can send them as-is, the app can cache them as-is, and validation can run in
 * plain Node. Mathematical notation is written in Unicode (x², √, ×, −, ≤, →,
 * subscripts) so it renders on every platform without a math engine.
 */

export const LESSON_SCHEMA_VERSION = 1;

export type Block =
  | { kind: "text"; text: string }
  /** A displayed expression or equation, rendered in a monospace block. */
  | { kind: "formula"; text: string; note?: string }
  /** A chemical equation. Validation checks that atoms balance. */
  | { kind: "chem"; text: string; note?: string }
  | { kind: "definition"; term: string; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "table"; caption?: string; headers: string[]; rows: string[][] }
  | { kind: "callout"; tone: "assumption" | "note" | "caution"; text: string };

/** A numeric fact the validator recomputes, e.g. { expr: "(17-5)/2", equals: 6 }. */
export interface Verification {
  expr: string;
  equals: number;
  /** Relative tolerance, default 1e-9. */
  tolerance?: number;
}

export interface WorkedStep {
  text: string;
  /** Optional expression shown under the step. */
  math?: string;
}

export interface WorkedExample {
  id: string;
  title: string;
  problem: Block[];
  /** Known values, listed before the method for quantitative problems. */
  given?: string[];
  steps: WorkedStep[];
  answer: string;
  /** How a student could check the result independently. */
  check?: string;
  verify?: Verification[];
}

export interface Misconception {
  claim: string;
  correction: string;
}

/** What the question is testing. Assessments need a mix. */
export type QuestionFocus = "conceptual" | "procedural" | "application";

interface QuestionBase {
  id: string;
  prompt: Block[];
  /** Revealed one at a time. */
  hints: string[];
  /** Shown after answering: the full correct reasoning. */
  explanation: string;
  difficulty: 1 | 2 | 3;
  focus: QuestionFocus;
  /** Prerequisite skill most likely responsible when this is missed. */
  gapSkill?: SkillId;
}

export interface McqQuestion extends QuestionBase {
  type: "mcq";
  options: string[];
  answer: number;
  /** Targeted feedback per wrong option (same length as options, null for none). */
  optionFeedback?: (string | null)[];
}

export interface NumericQuestion extends QuestionBase {
  type: "numeric";
  answer: number;
  /** Relative tolerance (0.01 = 1%). */
  tolerance: number;
  /** Expected unit shown next to the input, e.g. "m/s²". */
  unit?: string;
  /** Recomputed by the validator. */
  verify?: Verification;
}

export interface OrderQuestion extends QuestionBase {
  type: "order";
  /** Items in the correct order. The UI presents them shuffled. */
  items: string[];
}

export interface MatchQuestion extends QuestionBase {
  type: "match";
  /** Correct [left, right] pairs. The UI shuffles the right column. */
  pairs: [string, string][];
}

/** Open written explanation. Self-checked against a model answer, never auto-scored. */
export interface ShortQuestion extends QuestionBase {
  type: "short";
  modelAnswer: string;
  /** Points a good answer must contain. */
  rubric: string[];
}

export type Question = McqQuestion | NumericQuestion | OrderQuestion | MatchQuestion | ShortQuestion;
export type GradedQuestion = Exclude<Question, ShortQuestion>;

export interface PrerequisiteReview {
  skillId: SkillId;
  text: string;
}

export interface Lesson {
  schema: typeof LESSON_SCHEMA_VERSION;
  id: string;
  /** Bump on every content revision so cached copies update. */
  version: number;
  subject: string;
  skillId: SkillId;
  title: string;
  minutes: number;
  objectives: string[];
  prerequisiteReview: PrerequisiteReview[];
  concept: Block[];
  formal?: Block[];
  workedExamples: WorkedExample[];
  misconceptions: Misconception[];
  guided: Question[];
  exercises: Question[];
  application: { title: string; scenario: Block[]; questions: Question[] };
  assessment: GradedQuestion[];
  summary: { points: string[]; formulas?: string[] };
}

/** Bundled metadata. Lesson bodies are fetched separately. */
export interface LessonMeta {
  id: string;
  version: number;
  subject: string;
  skillId: SkillId;
  title: string;
  minutes: number;
  blurb: string;
}

export type LessonSectionId =
  | "objectives"
  | "prerequisites"
  | "concept"
  | "formal"
  | "examples"
  | "misconceptions"
  | "guided"
  | "exercises"
  | "application"
  | "assessment"
  | "summary";

export const SECTION_TITLES: Record<LessonSectionId, string> = {
  objectives: "Objectives",
  prerequisites: "Prerequisite review",
  concept: "Concept",
  formal: "Formal treatment",
  examples: "Worked examples",
  misconceptions: "Misconceptions",
  guided: "Guided practice",
  exercises: "Exercises",
  application: "Application",
  assessment: "Mastery check",
  summary: "Summary",
};

/** Sections present in this lesson, in teaching order. Empty sections are skipped. */
export function lessonSections(lesson: Lesson): LessonSectionId[] {
  const out: LessonSectionId[] = [];
  if (lesson.objectives.length) out.push("objectives");
  if (lesson.prerequisiteReview.length) out.push("prerequisites");
  if (lesson.concept.length) out.push("concept");
  if (lesson.formal?.length) out.push("formal");
  if (lesson.workedExamples.length) out.push("examples");
  if (lesson.misconceptions.length) out.push("misconceptions");
  if (lesson.guided.length) out.push("guided");
  if (lesson.exercises.length) out.push("exercises");
  if (lesson.application.questions.length) out.push("application");
  if (lesson.assessment.length) out.push("assessment");
  if (lesson.summary.points.length) out.push("summary");
  return out;
}
