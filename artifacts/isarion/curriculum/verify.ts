/**
 * Small, safe evaluators used by content validation: an arithmetic expression
 * evaluator (no eval) and a chemical-equation atom counter.
 */

// ------------------------------------------------------------ arithmetic

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  log10: Math.log10,
  ln: Math.log,
  sin: (d) => Math.sin((d * Math.PI) / 180),
  cos: (d) => Math.cos((d * Math.PI) / 180),
  tan: (d) => Math.tan((d * Math.PI) / 180),
  asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI,
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
  abs: Math.abs,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/**
 * Evaluate + - * / ^, parentheses, numbers (incl. 1.5e-3), the constants pi
 * and e, and the functions above (trig in degrees). Throws on anything else.
 */
export function evaluate(expr: string): number {
  const src = expr.replace(/\s+/g, "");
  let i = 0;
  const peek = () => src[i];
  const fail = (msg: string): never => {
    throw new Error(`${msg} at position ${i} in "${expr}"`);
  };

  function primary(): number {
    if (peek() === "(") {
      i++;
      const v = sum();
      if (peek() !== ")") fail("Expected )");
      i++;
      return v;
    }
    const num = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    const word = src.slice(i).match(/^[a-z][a-z0-9]*/i);
    if (word) {
      i += word[0].length;
      const name = word[0].toLowerCase();
      if (name in CONSTS) return CONSTS[name];
      const fn = FUNCS[name];
      if (!fn) fail(`Unknown name "${name}"`);
      if (peek() !== "(") fail("Expected ( after function");
      return fn(primary());
    }
    return fail("Unexpected token");
  }
  function unary(): number {
    if (peek() === "-") {
      i++;
      return -unary();
    }
    if (peek() === "+") {
      i++;
      return unary();
    }
    return power();
  }
  function power(): number {
    const base = primary();
    if (peek() === "^") {
      i++;
      return base ** unary();
    }
    return base;
  }
  function product(): number {
    let v = unary();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = unary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function sum(): number {
    let v = product();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const v = sum();
  if (i !== src.length) fail("Unexpected trailing input");
  if (!Number.isFinite(v)) fail("Result is not finite");
  return v;
}

// ------------------------------------------------------------ chemistry

const SUB: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };
const SUPER_CHARGE = /[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]/g;
const SUPER: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

export type AtomCount = Record<string, number>;

function add(into: AtomCount, from: AtomCount, k: number) {
  for (const [el, n] of Object.entries(from)) into[el] = (into[el] ?? 0) + n * k;
}

/** Count atoms and net charge in one species, e.g. "Ca(OH)₂", "SO₄²⁻", "CuSO₄·5H₂O". */
export function countSpecies(species: string): { atoms: AtomCount; charge: number } {
  let s = species.replace(/\((aq|s|l|g)\)$/, "");
  let charge = 0;
  s = s.replace(SUPER_CHARGE, (m) => {
    const sign = m.endsWith("⁺") ? 1 : -1;
    const digits = [...m.slice(0, -1)].map((c) => SUPER[c]).join("");
    charge += sign * (digits ? Number(digits) : 1);
    return "";
  });
  s = [...s].map((c) => SUB[c] ?? c).join("");

  const atoms: AtomCount = {};
  for (const part of s.split("·")) {
    const lead = part.match(/^\d+/);
    const k = lead ? Number(lead[0]) : 1;
    add(atoms, parseGroup(part.slice(lead ? lead[0].length : 0), species), k);
  }
  return { atoms, charge };
}

function parseGroup(s: string, whole: string): AtomCount {
  const stack: AtomCount[] = [{}];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "(" || c === "[") {
      stack.push({});
      i++;
    } else if (c === ")" || c === "]") {
      i++;
      const n = s.slice(i).match(/^\d+/);
      if (n) i += n[0].length;
      const group = stack.pop();
      if (!group || stack.length === 0) throw new Error(`Unbalanced brackets in "${whole}"`);
      add(stack[stack.length - 1], group, n ? Number(n[0]) : 1);
    } else {
      const m = s.slice(i).match(/^([A-Z][a-z]?)(\d*)/);
      if (!m) throw new Error(`Cannot read "${s.slice(i)}" in "${whole}"`);
      i += m[0].length;
      const top = stack[stack.length - 1];
      top[m[1]] = (top[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1);
    }
  }
  if (stack.length !== 1) throw new Error(`Unbalanced brackets in "${whole}"`);
  return stack[0];
}

function countSide(side: string): { atoms: AtomCount; charge: number } {
  const atoms: AtomCount = {};
  let charge = 0;
  for (const raw of side.split(/\s\+\s/)) {
    const term = raw.trim();
    const m = term.match(/^(\d+(?:\/\d+)?)?\s*(.+)$/);
    if (!m) throw new Error(`Cannot read term "${term}"`);
    const coef = m[1] ? (m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1])) : 1;
    const sp = countSpecies(m[2]);
    add(atoms, sp.atoms, coef);
    charge += sp.charge * coef;
  }
  return { atoms, charge };
}

/**
 * Checks that a written equation such as "2H₂ + O₂ → 2H₂O" conserves every
 * element and the net charge. Returns problems; empty means balanced.
 */
export function checkChemicalEquation(equation: string): string[] {
  const parts = equation.split(/\s*(?:→|⇌|⟶|=)\s*/);
  if (parts.length !== 2) return [`"${equation}": expected exactly one arrow`];
  try {
    const left = countSide(parts[0]);
    const right = countSide(parts[1]);
    const problems: string[] = [];
    for (const el of new Set([...Object.keys(left.atoms), ...Object.keys(right.atoms)])) {
      const l = left.atoms[el] ?? 0;
      const r = right.atoms[el] ?? 0;
      if (Math.abs(l - r) > 1e-9) problems.push(`"${equation}": ${el} is ${l} on the left but ${r} on the right`);
    }
    if (Math.abs(left.charge - right.charge) > 1e-9) problems.push(`"${equation}": charge is ${left.charge} on the left but ${right.charge} on the right`);
    return problems;
  } catch (e) {
    return [(e as Error).message];
  }
}
