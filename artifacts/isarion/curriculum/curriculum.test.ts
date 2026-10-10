/**
 * Run from artifacts/isarion with:
 *   pnpm exec tsx --test curriculum/*.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREDIT_DIRECT,
  CREDIT_INFERRED,
  PLACEMENT_MAX_QUESTIONS,
  buildIndex,
  newPlacement,
  nextPlacementQuestion,
  nextSkills,
  placementResult,
  presentProbe,
  recordAnswer,
  reviewSkills,
  roadmapSummary,
  roadmapTo,
  skillKey,
  statusOf,
  validateCurriculum,
  weakestPrerequisite,
} from "./index";
import type { PlacementState, Progress } from "./index";
import { MATH_CURRICULUM } from "./math";

const index = buildIndex(MATH_CURRICULUM);

/** Simulate a student who truly knows exactly `known`, answering honestly. */
function simulate(known: Set<string>, targets?: string[]) {
  let state: PlacementState = newPlacement("Math");
  let asked = 0;
  for (;;) {
    const q = nextPlacementQuestion(index, state, { targets });
    if (!q) break;
    state = recordAnswer(state, q.id, known.has(q.id) ? "correct" : "wrong");
    asked++;
    assert.ok(asked <= PLACEMENT_MAX_QUESTIONS, "placement must stop at the cap");
  }
  return { state, asked, result: placementResult(index, state, {}, { targets }) };
}

const closureOf = (id: string) => new Set([id, ...index.ancestors.get(id)!]);

test("math curriculum is valid", () => {
  assert.deepEqual(validateCurriculum(MATH_CURRICULUM), []);
  assert.equal(MATH_CURRICULUM.skills.length, 51);
});

test("validation catches cycles, unknown prereqs and bad probes", () => {
  const [a, b] = MATH_CURRICULUM.skills;
  const cyclic = {
    ...MATH_CURRICULUM,
    skills: [{ ...a, prereqs: [b.id] }, { ...b, prereqs: [a.id] }],
    goals: [],
  };
  assert.ok(validateCurriculum(cyclic).some((e) => e.includes("cycle")));

  const unknown = { ...MATH_CURRICULUM, skills: [{ ...a, prereqs: ["nope"] }], goals: [] };
  assert.ok(validateCurriculum(unknown).some((e) => e.includes("unknown prerequisite")));

  const badProbe = {
    ...MATH_CURRICULUM,
    skills: [{ ...a, probe: { ...a.probe, options: ["x", "x", "y", "z"] as [string, string, string, string] } }],
    goals: [],
  };
  assert.ok(validateCurriculum(badProbe).some((e) => e.includes("different")));
});

test("topological order puts every prerequisite first", () => {
  for (const s of MATH_CURRICULUM.skills) {
    for (const p of s.prereqs) {
      assert.ok(index.position.get(p)! < index.position.get(s.id)!, `${p} should come before ${s.id}`);
    }
  }
});

test("ids shared with the API prerequisite graph exist here", () => {
  for (const id of ["factoring", "quadratic_equations", "functions", "derivatives"]) {
    assert.ok(index.byId.has(id), id);
  }
  assert.ok(index.ancestors.get("derivatives")!.has("functions"));
  assert.ok(index.ancestors.get("quadratic_equations")!.has("factoring"));
});

test("calculus is genuinely downstream of arithmetic", () => {
  assert.ok(index.ancestors.get("differential_equations")!.has("whole_number_ops"));
  assert.ok(index.descendants.get("whole_number_ops")!.has("taylor_series"));
});

test("a new student starts at the very bottom and sees only unlocked skills", () => {
  const next = nextSkills(index, {}).map((s) => s.id);
  assert.deepEqual(next, ["whole_number_ops"]);
});

test("unlocking: passing a prerequisite opens what depends on it", () => {
  const progress: Progress = { [skillKey("Math", "whole_number_ops")]: 0.7 };
  const next = nextSkills(index, progress).map((s) => s.id);
  assert.ok(next.includes("fractions_basics"));
  assert.ok(next.includes("negative_numbers"));
  assert.ok(!next.includes("fraction_operations"));
  assert.equal(statusOf(index, progress, "fraction_operations"), "locked");
  assert.equal(statusOf(index, progress, "fractions_basics"), "ready");
});

test("roadmap to calculus-ready includes arithmetic but not calculus", () => {
  const goal = MATH_CURRICULUM.goals.find((g) => g.id === "precalculus")!;
  const items = roadmapTo(index, {}, goal.targets);
  const ids = items.map((i) => i.skill.id);
  assert.ok(ids.includes("whole_number_ops"));
  assert.ok(ids.includes("logarithms"));
  assert.ok(!ids.includes("derivatives"));
  const summary = roadmapSummary(items);
  assert.equal(summary.mastered, 0);
  assert.equal(summary.remaining, items.length);
  assert.ok(summary.remainingMinutes > 0);
});

test("every goal is reachable and ordered", () => {
  for (const g of MATH_CURRICULUM.goals) {
    const items = roadmapTo(index, {}, g.targets);
    assert.ok(items.length >= g.targets.length);
    for (const t of g.targets) assert.ok(items.some((i) => i.skill.id === t));
  }
});

test("gap tracing points at the weakest unmastered prerequisite", () => {
  const progress: Progress = {};
  for (const id of index.ancestors.get("chain_rule")!) progress[skillKey("Math", id)] = 0.9;
  assert.equal(weakestPrerequisite(index, progress, "chain_rule"), null);

  progress[skillKey("Math", "function_composition")] = 0.3;
  assert.equal(weakestPrerequisite(index, progress, "chain_rule")!.id, "function_composition");
});

test("placement: a complete beginner is asked few questions and starts at the bottom", () => {
  const { asked, result } = simulate(new Set());
  assert.ok(asked <= PLACEMENT_MAX_QUESTIONS);
  assert.equal(result.known.length, 0);
  assert.deepEqual(result.startHere.map((s) => s.id), ["whole_number_ops"]);
});

test("placement: someone who knows everything is credited everything", () => {
  const all = new Set(index.order);
  const { asked, result } = simulate(all);
  // Each separate branch of the graph must be confirmed once, so an expert
  // needs about one question per branch end (11) rather than 51.
  assert.ok(asked <= PLACEMENT_MAX_QUESTIONS, `asked ${asked}`);
  assert.equal(result.known.length, 51);
  assert.equal(result.startHere.length, 0);
});

test("placement: finds the frontier for an algebra student without false credit", () => {
  const known = closureOf("quadratic_equations");
  for (const id of ["functions", "systems_equations", "inequalities"]) for (const k of closureOf(id)) known.add(k);
  const { asked, result } = simulate(known);
  assert.ok(asked <= PLACEMENT_MAX_QUESTIONS);
  // Honest answers can never credit a skill the student does not know.
  for (const id of result.known) assert.ok(known.has(id), `${id} credited but unknown`);
  // And it should find most of what they do know.
  assert.ok(result.known.length >= Math.floor(known.size * 0.8), `${result.known.length}/${known.size}`);
  // Learning resumes right after the frontier, not in the middle of known material.
  const startIds = result.startHere.map((s) => s.id);
  assert.ok(startIds.length > 0);
  for (const id of startIds) assert.ok(!known.has(id), `${id} is already known`);
});

test("placement: calculus student is placed in far fewer questions than skills", () => {
  const known = closureOf("transcendental_derivatives");
  for (const k of closureOf("curve_sketching_optimization")) known.add(k);
  const { asked, result } = simulate(known);
  assert.ok(asked <= PLACEMENT_MAX_QUESTIONS);
  for (const id of result.known) assert.ok(known.has(id));
  assert.ok(result.known.length >= Math.floor(known.size * 0.8));
});

test("placement across many random knowledge levels never credits unknown skills", () => {
  // Deterministic pseudo-random prefix of the topological order.
  for (let cut = 0; cut <= index.order.length; cut += 3) {
    const known = new Set<string>();
    for (const id of index.order.slice(0, cut)) {
      // Only keep skills whose prerequisites are also known (a valid knowledge state).
      if (index.byId.get(id)!.prereqs.every((p) => known.has(p))) known.add(id);
    }
    const { result } = simulate(known);
    for (const id of result.known) assert.ok(known.has(id), `cut ${cut}: ${id} credited but unknown`);
  }
});

test("placement credit: direct answers count as mastered, inferred ones get reviewed", () => {
  let state = newPlacement("Math");
  state = recordAnswer(state, "quadratic_equations", "correct");
  const result = placementResult(index, state, {});
  assert.equal(result.progress[skillKey("Math", "quadratic_equations")], CREDIT_DIRECT);
  assert.equal(result.progress[skillKey("Math", "factoring")], CREDIT_INFERRED);
  // Inferred skills are unlocked but queued for review rather than "learn next".
  const learn = nextSkills(index, result.progress).map((s) => s.id);
  assert.ok(!learn.includes("factoring"));
  assert.ok(reviewSkills(index, result.progress).some((s) => s.id === "factoring"));
});

test("placement never lowers existing progress", () => {
  const existing: Progress = { [skillKey("Math", "whole_number_ops")]: 0.95 };
  let state = newPlacement("Math");
  state = recordAnswer(state, "whole_number_ops", "correct");
  const result = placementResult(index, state, existing);
  assert.equal(result.progress[skillKey("Math", "whole_number_ops")], 0.95);
});

test("unsure is treated like wrong, and conflicting evidence is re-asked", () => {
  let state = newPlacement("Math");
  state = recordAnswer(state, "functions", "unsure");
  assert.equal(placementResult(index, state, {}).known.length, 0);

  // Lucky guess on a hard skill, then a miss on an easy one it implies.
  let conflict = newPlacement("Math");
  conflict = recordAnswer(conflict, "taylor_series", "correct");
  conflict = recordAnswer(conflict, "fractions_basics", "wrong");
  const result = placementResult(index, conflict, {});
  // fractions_basics directly answered wrong stays unknown; its dependents are in conflict, so not credited.
  assert.ok(!result.known.includes("fractions_basics"));
  assert.ok(!result.known.includes("fraction_operations"));
});

test("goal-scoped placement only asks about that goal's skills", () => {
  const goal = MATH_CURRICULUM.goals.find((g) => g.id === "algebra")!;
  const scope = new Set<string>(goal.targets);
  for (const t of goal.targets) for (const a of index.ancestors.get(t)!) scope.add(a);
  let state = newPlacement("Math");
  for (let i = 0; i < PLACEMENT_MAX_QUESTIONS; i++) {
    const q = nextPlacementQuestion(index, state, { targets: goal.targets });
    if (!q) break;
    assert.ok(scope.has(q.id), `${q.id} is outside the algebra goal`);
    state = recordAnswer(state, q.id, "wrong");
  }
});

test("presentProbe shuffles but keeps the right answer right", () => {
  const positions = new Set<number>();
  for (const s of MATH_CURRICULUM.skills) {
    for (let seed = 1; seed <= 5; seed++) {
      const p = presentProbe(s.probe, seed * 7919 + s.id.length);
      assert.equal(p.options[p.answer], s.probe.options[s.probe.answer]);
      assert.deepEqual([...p.options].sort(), [...s.probe.options].sort());
      positions.add(p.answer);
    }
  }
  assert.equal(positions.size, 4, "the correct answer should land in every slot over many probes");
});
