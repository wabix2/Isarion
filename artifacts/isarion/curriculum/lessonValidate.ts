import type { Block, Lesson, Question, Verification } from "./lessonTypes";
import { LESSON_SCHEMA_VERSION } from "./lessonTypes";
import type { Curriculum } from "./types";
import { checkChemicalEquation, evaluate } from "./verify";
import { withinTolerance } from "./scoring";

/**
 * Publishing gate for lesson content. A lesson that fails any rule here is a
 * content bug: the tests fail and the lesson must not ship.
 */

function checkVerification(v: Verification, where: string): string[] {
  try {
    const got = evaluate(v.expr);
    return withinTolerance(got, v.equals, v.tolerance ?? 1e-9)
      ? []
      : [`${where}: ${v.expr} = ${got}, but the lesson says ${v.equals}`];
  } catch (e) {
    return [`${where}: cannot evaluate "${v.expr}": ${(e as Error).message}`];
  }
}

function checkBlocks(blocks: Block[], where: string): string[] {
  const out: string[] = [];
  blocks.forEach((b, i) => {
    if (b.kind === "chem") out.push(...checkChemicalEquation(b.text).map((p) => `${where}[${i}]: ${p}`));
    if (b.kind === "table" && b.rows.some((r) => r.length !== b.headers.length)) {
      out.push(`${where}[${i}]: table row width does not match headers`);
    }
  });
  return out;
}

function checkQuestion(q: Question, where: string, skillIds: Set<string>): string[] {
  const out: string[] = [];
  const at = `${where}/${q.id}`;
  if (!q.prompt.length) out.push(`${at}: empty prompt`);
  if (!q.explanation.trim()) out.push(`${at}: missing explanation`);
  if (q.gapSkill && !skillIds.has(q.gapSkill)) out.push(`${at}: unknown gapSkill ${q.gapSkill}`);
  out.push(...checkBlocks(q.prompt, at));
  switch (q.type) {
    case "mcq":
      if (q.options.length < 2) out.push(`${at}: needs 2+ options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) out.push(`${at}: answer out of range`);
      if (new Set(q.options).size !== q.options.length) out.push(`${at}: duplicate options`);
      if (q.optionFeedback && q.optionFeedback.length !== q.options.length) out.push(`${at}: optionFeedback length mismatch`);
      break;
    case "numeric":
      if (!Number.isFinite(q.answer)) out.push(`${at}: answer is not a number`);
      if (!(q.tolerance >= 0 && q.tolerance <= 0.05)) out.push(`${at}: tolerance must be within 0..5%`);
      if (q.verify) {
        out.push(...checkVerification(q.verify, at));
        if (!withinTolerance(q.verify.equals, q.answer, Math.max(q.tolerance, 1e-9))) {
          out.push(`${at}: verify.equals ${q.verify.equals} disagrees with answer ${q.answer}`);
        }
      }
      break;
    case "order":
      if (q.items.length < 3) out.push(`${at}: ordering needs 3+ items`);
      if (new Set(q.items).size !== q.items.length) out.push(`${at}: duplicate items`);
      break;
    case "match":
      if (q.pairs.length < 3) out.push(`${at}: matching needs 3+ pairs`);
      if (new Set(q.pairs.map((p) => p[1])).size !== q.pairs.length) out.push(`${at}: duplicate right-hand items`);
      break;
    case "short":
      if (!q.modelAnswer.trim() || q.rubric.length === 0) out.push(`${at}: needs a model answer and rubric`);
      break;
  }
  return out;
}

export function validateLesson(lesson: Lesson, curriculum: Curriculum): string[] {
  const out: string[] = [];
  const id = lesson.id;
  const skillIds = new Set(curriculum.skills.map((s) => s.id));
  const skill = curriculum.skills.find((s) => s.id === lesson.skillId);

  if (lesson.schema !== LESSON_SCHEMA_VERSION) out.push(`${id}: schema ${lesson.schema} is not ${LESSON_SCHEMA_VERSION}`);
  if (lesson.subject !== curriculum.subject) out.push(`${id}: subject mismatch`);
  if (!skill) out.push(`${id}: unknown skill ${lesson.skillId}`);
  if (lesson.objectives.length < 2) out.push(`${id}: needs 2+ objectives`);
  if (skill) {
    const reviewed = new Set(lesson.prerequisiteReview.map((p) => p.skillId));
    for (const p of skill.prereqs) if (!reviewed.has(p)) out.push(`${id}: prerequisite ${p} is not reviewed`);
  }
  for (const p of lesson.prerequisiteReview) if (!skillIds.has(p.skillId)) out.push(`${id}: unknown prerequisite ${p.skillId}`);
  if (lesson.concept.length === 0) out.push(`${id}: missing concept explanation`);
  if (lesson.workedExamples.length < 2) out.push(`${id}: needs 2+ worked examples`);
  if (lesson.misconceptions.length < 2) out.push(`${id}: needs 2+ misconceptions`);
  if (lesson.guided.length < 2) out.push(`${id}: needs 2+ guided questions`);
  for (const g of lesson.guided) if (g.hints.length < 2) out.push(`${id}/${g.id}: guided practice needs 2+ progressive hints`);
  if (lesson.exercises.length < 5 || lesson.exercises.length > 8) out.push(`${id}: needs 5-8 exercises`);
  if (lesson.application.questions.length < 1) out.push(`${id}: needs an application task`);
  if (lesson.assessment.length < 4) out.push(`${id}: assessment needs 4+ questions`);
  if (new Set(lesson.assessment.map((q) => q.focus)).size < 2) out.push(`${id}: assessment needs a mix of focuses`);
  if (lesson.summary.points.length < 3) out.push(`${id}: summary needs 3+ points`);

  out.push(...checkBlocks(lesson.concept, `${id}/concept`));
  out.push(...checkBlocks(lesson.formal ?? [], `${id}/formal`));
  out.push(...checkBlocks(lesson.application.scenario, `${id}/application`));
  for (const ex of lesson.workedExamples) {
    if (ex.steps.length < 2) out.push(`${id}/${ex.id}: worked example needs 2+ steps`);
    out.push(...checkBlocks(ex.problem, `${id}/${ex.id}`));
    for (const v of ex.verify ?? []) out.push(...checkVerification(v, `${id}/${ex.id}`));
  }

  const all = [...lesson.guided, ...lesson.exercises, ...lesson.application.questions, ...lesson.assessment];
  const seen = new Set<string>();
  for (const q of all) {
    if (seen.has(q.id)) out.push(`${id}: duplicate question id ${q.id}`);
    seen.add(q.id);
    out.push(...checkQuestion(q, id, skillIds));
  }
  return out;
}

/** Quantitative lessons must have every worked example checked by arithmetic. */
export function unverifiedExamples(lesson: Lesson): string[] {
  return lesson.workedExamples.filter((e) => !e.verify?.length).map((e) => `${lesson.id}/${e.id}`);
}
