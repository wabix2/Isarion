import type { Skill } from "./types";

export type ProbeTuple = [question: string, options: [string, string, string, string], answer: 0 | 1 | 2 | 3, why: string];

/** Compact constructor shared by the subject graphs. */
export function skill(
  id: string,
  unit: string,
  title: string,
  blurb: string,
  prereqs: string[],
  minutes: number,
  probe: ProbeTuple,
): Skill {
  const [question, options, answer, why] = probe;
  return { id, unit, title, blurb, prereqs, minutes, probe: { question, options, answer, why } };
}
