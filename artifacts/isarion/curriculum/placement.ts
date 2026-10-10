import { MASTERED_THRESHOLD } from "../utils/learningPath";
import { masteryOf, nextSkills, scopeOf, skillKey } from "./graph";
import type { CurriculumIndex, Progress } from "./graph";
import type { Probe, Skill, SkillId } from "./types";

/**
 * Adaptive placement: find where a student really is in at most 15
 * questions (a complete beginner needs about 2) instead of testing every skill.
 *
 *   correct on skill S  -> S and everything S depends on are probably known
 *   wrong on skill S    -> S and everything that depends on S are probably unknown
 *
 * Each next question is chosen to settle as many skills as possible:
 *   - mixed results so far -> the skill whose answer splits the open skills most
 *     evenly (a binary search over the graph);
 *   - mostly correct so far -> climb: the hardest open skill, so one correct
 *     answer credits as much as possible;
 *   - mostly wrong so far  -> descend: the most foundational open skill, so one
 *     wrong answer rules out as much as possible.
 * The strategy only affects how few questions are needed. Credit always comes
 * from the student's actual answers.
 *
 * Guessing protection: the UI should offer an "I don't know" button (outcome
 * "unsure", treated like wrong), and skills that are only INFERRED as known get
 * less credit than skills answered directly, so the study path re-checks them.
 */

export type PlacementOutcome = "correct" | "wrong" | "unsure";

export interface PlacementState {
  subject: string;
  /** Direct answers, by skill id. */
  answers: Record<SkillId, PlacementOutcome>;
}

export type PlacementStatus = "known" | "unknown" | "undetermined";

export const PLACEMENT_MAX_QUESTIONS = 15;
/** Credit for a skill the student answered correctly (counts as mastered). */
export const CREDIT_DIRECT = MASTERED_THRESHOLD;
/** Credit for a skill only inferred from a harder correct answer (unlocks, but is reviewed). */
export const CREDIT_INFERRED = 0.65;

export const newPlacement = (subject: string): PlacementState => ({ subject, answers: {} });

export function recordAnswer(state: PlacementState, id: SkillId, outcome: PlacementOutcome): PlacementState {
  return { ...state, answers: { ...state.answers, [id]: outcome } };
}

export function placementStatuses(index: CurriculumIndex, state: PlacementState): Map<SkillId, PlacementStatus> {
  const inferredKnown = new Set<SkillId>();
  const inferredUnknown = new Set<SkillId>();
  for (const [id, outcome] of Object.entries(state.answers)) {
    if (!index.byId.has(id)) continue;
    const related = outcome === "correct" ? index.ancestors.get(id)! : index.descendants.get(id)!;
    for (const r of related) (outcome === "correct" ? inferredKnown : inferredUnknown).add(r);
  }
  const out = new Map<SkillId, PlacementStatus>();
  for (const id of index.order) {
    const direct = state.answers[id];
    if (direct) {
      out.set(id, direct === "correct" ? "known" : "unknown");
      continue;
    }
    const k = inferredKnown.has(id);
    const u = inferredUnknown.has(id);
    // Conflicting evidence (e.g. a lucky guess higher up) -> ask directly.
    out.set(id, k && !u ? "known" : u && !k ? "unknown" : "undetermined");
  }
  return out;
}

export interface NextQuestionOptions {
  max?: number;
  /** Only ask about the path to these skills (placement for one goal). */
  targets?: SkillId[];
}

/** The next skill to ask about, or null when placement is finished. */
export function nextPlacementQuestion(
  index: CurriculumIndex,
  state: PlacementState,
  opts: NextQuestionOptions = {},
): Skill | null {
  const max = opts.max ?? PLACEMENT_MAX_QUESTIONS;
  if (Object.keys(state.answers).length >= max) return null;

  const statuses = placementStatuses(index, state);
  const scope = opts.targets ? scopeOf(index, opts.targets) : null;
  const open = (id: SkillId) => statuses.get(id) === "undetermined" && (!scope || scope.has(id));

  // Laplace-smoothed share of correct direct answers so far.
  const given = Object.values(state.answers);
  const p = (given.filter((o) => o === "correct").length + 1) / (given.length + 2);
  const mode: "climb" | "descend" | "split" = p >= 0.66 ? "climb" : p <= 0.34 ? "descend" : "split";

  let best: { id: SkillId; score: number; total: number } | null = null;
  for (const id of index.order) {
    if (!open(id)) continue;
    // If correct, this skill and its open ancestors get settled; if wrong, it and its open descendants.
    let a = 1;
    for (const x of index.ancestors.get(id)!) if (open(x)) a++;
    let d = 1;
    for (const x of index.descendants.get(id)!) if (open(x)) d++;
    const score = mode === "climb" ? a : mode === "descend" ? d : Math.min(a, d);
    const total = a + d;
    if (!best || score > best.score || (score === best.score && total > best.total)) {
      best = { id, score, total };
    }
  }
  return best ? index.byId.get(best.id)! : null;
}

export interface PlacementResult {
  /** New progress map: existing progress, raised by placement credit (never lowered). */
  progress: Progress;
  known: SkillId[];
  unknown: SkillId[];
  /** Where the student should start learning. */
  startHere: Skill[];
}

export function placementResult(
  index: CurriculumIndex,
  state: PlacementState,
  existing: Progress,
  opts: { targets?: SkillId[] } = {},
): PlacementResult {
  const statuses = placementStatuses(index, state);
  const progress: Progress = { ...existing };
  const known: SkillId[] = [];
  const unknown: SkillId[] = [];
  for (const id of index.order) {
    const status = statuses.get(id);
    if (status === "known") {
      known.push(id);
      const credit = state.answers[id] === "correct" ? CREDIT_DIRECT : CREDIT_INFERRED;
      const key = skillKey(index.subject, id);
      progress[key] = Math.max(masteryOf(index, existing, id), credit);
    } else if (status === "unknown") {
      unknown.push(id);
    }
  }
  return {
    progress,
    known,
    unknown,
    startHere: nextSkills(index, progress, { targets: opts.targets, limit: 3 }),
  };
}

// ------------------------------------------------------------------ presenting

export interface PresentedProbe {
  question: string;
  options: string[];
  /** Index of the correct option AFTER shuffling. */
  answer: number;
  why: string;
}

/**
 * Shuffle a probe's options so the right answer is not always in the same
 * slot. Deterministic for a given seed (use e.g. a hash of skill id + session).
 */
export function presentProbe(probe: Probe, seed: number): PresentedProbe {
  const order = [0, 1, 2, 3];
  let s = (seed >>> 0) || 1;
  for (let i = order.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    question: probe.question,
    options: order.map((i) => probe.options[i]),
    answer: order.indexOf(probe.answer),
    why: probe.why,
  };
}
