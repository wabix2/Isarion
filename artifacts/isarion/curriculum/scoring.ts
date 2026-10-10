import type { GradedQuestion, Question } from "./lessonTypes";

/**
 * Local answer checking for authored exercises. Nothing here calls the network
 * or an AI model, so feedback works offline and instantly.
 */

export type Response =
  | { type: "mcq"; choice: number }
  | { type: "numeric"; text: string }
  | { type: "order"; items: string[] }
  | { type: "match"; rights: string[] };

export interface CheckResult {
  correct: boolean;
  /** Targeted feedback for this specific wrong answer, when we can give one. */
  feedback: string | null;
}

// ------------------------------------------------------------ number parsing

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
};

/**
 * Parse a learner's numeric answer. Accepts "6", "-3.5", "−3,5", "1/2",
 * "2.5e3", "2.5 × 10^3", "2.5×10³" and ignores a trailing unit ("12 m/s").
 */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/[−–]/g, "-").replace(/\s+/g, " ");
  if (!s) return null;
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPT_DIGITS[c]).join(""));
  // Decimal comma only when it is clearly a decimal (one comma, no dot).
  if (/^-?\d+,\d+/.test(s) && !s.includes(".")) s = s.replace(",", ".");
  s = s.replace(/,/g, "");

  const sci = s.match(/^(-?\d*\.?\d+)\s*[×x*·]\s*10\s*\^\s*(-?\d+)/i);
  if (sci) return Number(sci[1]) * 10 ** Number(sci[2]);
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?![\d.])/);
  if (frac) {
    const den = Number(frac[2]);
    return den === 0 ? null : Number(frac[1]) / den;
  }
  const plain = s.match(/^-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/i);
  if (!plain) return null;
  const n = Number(plain[0]);
  return Number.isFinite(n) ? n : null;
}

export function withinTolerance(value: number, expected: number, relTol: number): boolean {
  const scale = Math.max(Math.abs(expected), 1e-12);
  return Math.abs(value - expected) <= relTol * scale + 1e-12;
}

function numericFeedback(value: number, expected: number, tol: number): string | null {
  if (withinTolerance(-value, expected, tol) && expected !== 0) return "The size is right but the sign is not. Check the direction or which quantity is subtracted from which.";
  for (const p of [10, 100, 1000, 1e6]) {
    if (withinTolerance(value * p, expected, tol) || withinTolerance(value / p, expected, tol)) {
      return "Off by a power of ten. Check unit prefixes and conversions.";
    }
  }
  if (withinTolerance(value, expected, Math.max(tol * 5, 0.05))) return "Close. Check your rounding and keep more digits until the final step.";
  return null;
}

// ------------------------------------------------------------ checking

export function isGraded(q: Question): q is GradedQuestion {
  return q.type !== "short";
}

export function checkAnswer(q: GradedQuestion, r: Response): CheckResult {
  switch (q.type) {
    case "mcq": {
      if (r.type !== "mcq") return { correct: false, feedback: null };
      const correct = r.choice === q.answer;
      return { correct, feedback: correct ? null : q.optionFeedback?.[r.choice] ?? null };
    }
    case "numeric": {
      if (r.type !== "numeric") return { correct: false, feedback: null };
      const value = parseNumber(r.text);
      if (value === null) return { correct: false, feedback: "Enter a number, for example 4.5 or 3/4." };
      const correct = withinTolerance(value, q.answer, q.tolerance);
      return { correct, feedback: correct ? null : numericFeedback(value, q.answer, q.tolerance) };
    }
    case "order": {
      if (r.type !== "order") return { correct: false, feedback: null };
      const correct = r.items.length === q.items.length && r.items.every((it, i) => it === q.items[i]);
      if (correct) return { correct, feedback: null };
      const firstWrong = r.items.findIndex((it, i) => it !== q.items[i]);
      return { correct, feedback: `Steps 1–${firstWrong} are in place; step ${firstWrong + 1} is not.` };
    }
    case "match": {
      if (r.type !== "match") return { correct: false, feedback: null };
      const wrong = q.pairs.filter(([, right], i) => r.rights[i] !== right).length;
      const correct = wrong === 0 && r.rights.length === q.pairs.length;
      return { correct, feedback: correct ? null : `${wrong} of ${q.pairs.length} matches are wrong.` };
    }
  }
}

// ------------------------------------------------------------ deterministic shuffle

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Stable shuffle keyed by a seed, so a learner sees the same arrangement when
 * they resume. Never returns the original order for lists of 2+ items, which
 * would give the answer away for ordering questions.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  let h = hash(seed);
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((v, i) => v === items[i])) out.push(out.shift()!);
  return out;
}

// ------------------------------------------------------------ assessment scoring

export interface AssessmentScore {
  correct: number;
  total: number;
  /** 0..1. Only first attempts count; the assessment allows one answer per item. */
  score: number;
  missed: string[];
}

export function scoreAssessment(questions: GradedQuestion[], results: Record<string, boolean>): AssessmentScore {
  const missing = questions.filter((q) => !(q.id in results));
  if (missing.length > 0) {
    throw new Error(`Assessment incomplete: ${missing.map((q) => q.id).join(", ")} not answered`);
  }
  const correct = questions.filter((q) => results[q.id]).length;
  return {
    correct,
    total: questions.length,
    score: questions.length === 0 ? 0 : correct / questions.length,
    missed: questions.filter((q) => !results[q.id]).map((q) => q.id),
  };
}
