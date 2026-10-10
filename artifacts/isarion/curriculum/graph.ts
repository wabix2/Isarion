import { MASTERED_THRESHOLD, UNLOCK_THRESHOLD } from "../utils/learningPath";
import type { Curriculum, Skill, SkillId } from "./types";

/**
 * Pure functions over a curriculum. No React, no storage, no network, so they
 * are easy to test and can move to the API server unchanged later.
 *
 * Thresholds are shared with the existing study path:
 *   mastery >= UNLOCK_THRESHOLD   (0.6) -> skills that depend on it unlock
 *   mastery >= MASTERED_THRESHOLD (0.8) -> counted as mastered
 */

export type Progress = Record<string, number>;

export interface CurriculumIndex {
  subject: string;
  byId: Map<SkillId, Skill>;
  /** Topological order: every skill appears after all of its prerequisites. */
  order: SkillId[];
  position: Map<SkillId, number>;
  /** All skills that must come before this one (not including itself). */
  ancestors: Map<SkillId, Set<SkillId>>;
  /** All skills that need this one (not including itself). */
  descendants: Map<SkillId, Set<SkillId>>;
}

// ------------------------------------------------------------------ validation

function topoSort(skills: Skill[]): { order: SkillId[]; stuck: SkillId[] } {
  const remaining = new Map(skills.map((s) => [s.id, s.prereqs]));
  const done = new Set<SkillId>();
  const order: SkillId[] = [];
  while (remaining.size > 0) {
    let progressed = false;
    for (const [id, deps] of remaining) {
      if (deps.every((d) => done.has(d))) {
        order.push(id);
        done.add(id);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) return { order, stuck: [...remaining.keys()] };
  }
  return { order, stuck: [] };
}

/** Returns a list of human-readable problems. Empty means the curriculum is sound. */
export function validateCurriculum(c: Curriculum): string[] {
  const errors: string[] = [];
  const ids = new Set<SkillId>();
  for (const s of c.skills) {
    if (ids.has(s.id)) errors.push(`Duplicate skill id: ${s.id}`);
    ids.add(s.id);
  }
  for (const s of c.skills) {
    if (!c.units.includes(s.unit)) errors.push(`${s.id}: unknown unit "${s.unit}"`);
    for (const p of s.prereqs) {
      if (p === s.id) errors.push(`${s.id}: lists itself as a prerequisite`);
      else if (!ids.has(p)) errors.push(`${s.id}: unknown prerequisite "${p}"`);
    }
    const { options, answer } = s.probe;
    if (options.length !== 4) errors.push(`${s.id}: probe needs exactly 4 options`);
    if (new Set(options).size !== options.length) errors.push(`${s.id}: probe options must be different`);
    if (!(answer >= 0 && answer < options.length)) errors.push(`${s.id}: probe answer index is out of range`);
  }
  for (const g of c.goals) {
    if (g.targets.length === 0) errors.push(`Goal ${g.id} has no targets`);
    for (const t of g.targets) if (!ids.has(t)) errors.push(`Goal ${g.id}: unknown target "${t}"`);
  }
  if (errors.length === 0) {
    const { stuck } = topoSort(c.skills);
    if (stuck.length > 0) errors.push(`Prerequisite cycle involving: ${stuck.join(", ")}`);
  }
  return errors;
}

export function buildIndex(c: Curriculum): CurriculumIndex {
  const errors = validateCurriculum(c);
  if (errors.length > 0) {
    throw new Error(`Invalid ${c.subject} curriculum:\n- ${errors.join("\n- ")}`);
  }
  const byId = new Map(c.skills.map((s) => [s.id, s]));
  const { order } = topoSort(c.skills);
  const position = new Map(order.map((id, i) => [id, i]));

  const ancestors = new Map<SkillId, Set<SkillId>>();
  for (const id of order) {
    const set = new Set<SkillId>();
    for (const p of byId.get(id)!.prereqs) {
      set.add(p);
      for (const a of ancestors.get(p)!) set.add(a);
    }
    ancestors.set(id, set);
  }

  const children = new Map<SkillId, SkillId[]>(order.map((id) => [id, []]));
  for (const s of c.skills) for (const p of s.prereqs) children.get(p)!.push(s.id);
  const descendants = new Map<SkillId, Set<SkillId>>();
  for (const id of [...order].reverse()) {
    const set = new Set<SkillId>();
    for (const ch of children.get(id)!) {
      set.add(ch);
      for (const d of descendants.get(ch)!) set.add(d);
    }
    descendants.set(id, set);
  }

  return { subject: c.subject, byId, order, position, ancestors, descendants };
}

// -------------------------------------------------------------------- progress

/** Key used inside user.skillProgress, e.g. "Math:derivatives". */
export const skillKey = (subject: string, id: SkillId): string => `${subject}:${id}`;

export function masteryOf(index: CurriculumIndex, progress: Progress, id: SkillId): number {
  return progress[skillKey(index.subject, id)] ?? 0;
}

export type SkillStatus = "mastered" | "ready" | "locked";

export function isUnlocked(index: CurriculumIndex, progress: Progress, id: SkillId): boolean {
  return index.byId.get(id)!.prereqs.every((p) => masteryOf(index, progress, p) >= UNLOCK_THRESHOLD);
}

export function statusOf(index: CurriculumIndex, progress: Progress, id: SkillId): SkillStatus {
  if (masteryOf(index, progress, id) >= MASTERED_THRESHOLD) return "mastered";
  return isUnlocked(index, progress, id) ? "ready" : "locked";
}

/** The skills a goal needs: its targets plus everything they depend on. */
export function scopeOf(index: CurriculumIndex, targets: SkillId[]): Set<SkillId> {
  const scope = new Set<SkillId>();
  for (const t of targets) {
    scope.add(t);
    for (const a of index.ancestors.get(t) ?? []) scope.add(a);
  }
  return scope;
}

// -------------------------------------------------------------------- roadmaps

export interface RoadmapItem {
  skill: Skill;
  status: SkillStatus;
  mastery: number;
}

/** Full ordered path to a goal, including skills already mastered. */
export function roadmapTo(index: CurriculumIndex, progress: Progress, targets: SkillId[]): RoadmapItem[] {
  const scope = scopeOf(index, targets);
  return index.order
    .filter((id) => scope.has(id))
    .map((id) => ({
      skill: index.byId.get(id)!,
      status: statusOf(index, progress, id),
      mastery: masteryOf(index, progress, id),
    }));
}

export function roadmapSummary(items: RoadmapItem[]) {
  const remaining = items.filter((i) => i.status !== "mastered");
  return {
    total: items.length,
    mastered: items.length - remaining.length,
    remaining: remaining.length,
    remainingMinutes: remaining.reduce((sum, i) => sum + i.skill.minutes, 0),
  };
}

export interface NextOptions {
  /** Only consider the path to these skills (a goal). Default: whole subject. */
  targets?: SkillId[];
  limit?: number;
}

/**
 * What to LEARN next: unlocked skills the student has not yet passed
 * (mastery below the unlock threshold), earliest in the roadmap first.
 */
export function nextSkills(index: CurriculumIndex, progress: Progress, opts: NextOptions = {}): Skill[] {
  const scope = opts.targets ? scopeOf(index, opts.targets) : null;
  const out: Skill[] = [];
  for (const id of index.order) {
    if (scope && !scope.has(id)) continue;
    if (masteryOf(index, progress, id) >= UNLOCK_THRESHOLD) continue;
    if (!isUnlocked(index, progress, id)) continue;
    out.push(index.byId.get(id)!);
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

/**
 * What to REVIEW: skills passed but not yet mastered (for example credited by
 * the placement test), weakest first. Reviewing these confirms the placement.
 */
export function reviewSkills(index: CurriculumIndex, progress: Progress, limit?: number): Skill[] {
  const out = index.order
    .filter((id) => {
      const m = masteryOf(index, progress, id);
      return m >= UNLOCK_THRESHOLD && m < MASTERED_THRESHOLD;
    })
    .sort((a, b) => masteryOf(index, progress, a) - masteryOf(index, progress, b))
    .map((id) => index.byId.get(id)!);
  return limit ? out.slice(0, limit) : out;
}

/**
 * Gap tracing: a student is struggling on `id`. Which earlier skill is the
 * most likely hole? Weakest not-yet-mastered prerequisite, preferring the one
 * closest to `id` on ties. Returns null if every prerequisite is mastered,
 * meaning the trouble is in the skill itself.
 */
export function weakestPrerequisite(index: CurriculumIndex, progress: Progress, id: SkillId): Skill | null {
  const candidates = [...(index.ancestors.get(id) ?? [])].filter(
    (a) => masteryOf(index, progress, a) < MASTERED_THRESHOLD,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const diff = masteryOf(index, progress, a) - masteryOf(index, progress, b);
    return diff !== 0 ? diff : index.position.get(b)! - index.position.get(a)!;
  });
  return index.byId.get(candidates[0])!;
}
