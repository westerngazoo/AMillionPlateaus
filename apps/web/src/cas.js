// cas.js — CAS-checked answers (R-0034 / SPEC-0034). A SELF-CONTAINED, pure,
// deterministic engine for the "Solve it" mastery path: a small safe expression
// parser/evaluator, a numeric equivalence checker, a seeded drill generator, and
// the author-challenge (```solve fenced block) parse. No dependency, no vendoring,
// no network, no DOM, no `eval`/`Function` — the learner's text is PARSED into a
// bounded AST and interpreted, never executed. It touches NO graph geometry
// (positions/rotors/reputation stay in garust). Unit-tested in cas.test.mjs.

// ── Expression parser/evaluator (bounded grammar; rejects everything else) ──────
// Grammar (precedence low→high): + - | * / (and implicit multiplication) | unary -
// | ^ (right-assoc) | atom. Atoms: number, the variable, pi/e, f(expr), (expr).
// Functions whitelist: sin cos tan sqrt exp ln log abs.

const FUNCS = new Set(["sin", "cos", "tan", "sqrt", "exp", "ln", "log", "abs"]);

function tokenize(src) {
  const s = String(src);
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if ("+-*/^()".includes(c)) {
      toks.push({ k: c });
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i + 1;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new Error("bad number");
      toks.push({ k: "num", v: num });
      i = j;
      continue;
    }
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) {
      // LONGEST-MATCH the whole identifier run, then classify — so "sin"/"pi" are
      // one token, never split into implicit-multiplied letters (SPEC §arch-note 4).
      let j = i + 1;
      while (j < s.length && ((s[j] >= "a" && s[j] <= "z") || (s[j] >= "A" && s[j] <= "Z"))) j++;
      toks.push({ k: "ident", v: s.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`unexpected '${c}'`);
  }
  return toks;
}

/** Parse `src` into an AST, or THROW on anything off-grammar (an unknown symbol, a
 *  wrong variable, trailing garbage). Pure. `variable` is the only free symbol. */
export function parseExpr(src, variable = "x") {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expect = (k) => {
    const t = next();
    if (!t || t.k !== k) throw new Error(`expected '${k}'`);
    return t;
  };

  // a factor can be directly juxtaposed (implicit multiplication) when the next
  // token begins a new atom: a number, an identifier, or an opening paren.
  const startsAtom = (t) => t && (t.k === "num" || t.k === "ident" || t.k === "(");

  function parseExpression() {
    let node = parseTerm();
    for (;;) {
      const t = peek();
      if (t && (t.k === "+" || t.k === "-")) {
        next();
        node = { t: t.k === "+" ? "add" : "sub", a: node, b: parseTerm() };
      } else break;
    }
    return node;
  }
  function parseTerm() {
    let node = parseUnary();
    for (;;) {
      const t = peek();
      if (t && (t.k === "*" || t.k === "/")) {
        next();
        node = { t: t.k === "*" ? "mul" : "div", a: node, b: parseUnary() };
      } else if (startsAtom(t)) {
        node = { t: "mul", a: node, b: parseUnary() }; // implicit multiplication
      } else break;
    }
    return node;
  }
  function parseUnary() {
    const t = peek();
    if (t && t.k === "-") {
      next();
      return { t: "neg", a: parseUnary() };
    }
    if (t && t.k === "+") {
      next();
      return parseUnary();
    }
    return parsePower();
  }
  function parsePower() {
    const base = parseAtom();
    const t = peek();
    if (t && t.k === "^") {
      next();
      return { t: "pow", a: base, b: parseUnary() };
    } // right-assoc
    return base;
  }
  function parseAtom() {
    const t = next();
    if (!t) throw new Error("unexpected end");
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "(") {
      const e = parseExpression();
      expect(")");
      return e;
    }
    if (t.k === "ident") {
      const name = t.v.toLowerCase();
      if (FUNCS.has(name)) {
        expect("(");
        const a = parseExpression();
        expect(")");
        return { t: "func", name, a };
      }
      if (name === "pi") return { t: "const", name: "pi" };
      if (name === "e") return { t: "const", name: "e" };
      if (t.v === variable) return { t: "var" };
      throw new Error(`unknown symbol '${t.v}'`);
    }
    throw new Error(`unexpected '${t.k}'`);
  }

  const ast = parseExpression();
  if (pos !== toks.length) throw new Error("trailing input"); // reject garbage tails
  return ast;
}

/** Evaluate an AST at `x` → a JS number (NaN/±Infinity at undefined points). Real-only. */
export function evalAt(ast, x) {
  switch (ast.t) {
    case "num":
      return ast.v;
    case "const":
      return ast.name === "pi" ? Math.PI : Math.E;
    case "var":
      return x;
    case "neg":
      return -evalAt(ast.a, x);
    case "add":
      return evalAt(ast.a, x) + evalAt(ast.b, x);
    case "sub":
      return evalAt(ast.a, x) - evalAt(ast.b, x);
    case "mul":
      return evalAt(ast.a, x) * evalAt(ast.b, x);
    case "div":
      return evalAt(ast.a, x) / evalAt(ast.b, x);
    case "pow":
      return Math.pow(evalAt(ast.a, x), evalAt(ast.b, x));
    case "func": {
      const v = evalAt(ast.a, x);
      switch (ast.name) {
        case "sin":
          return Math.sin(v);
        case "cos":
          return Math.cos(v);
        case "tan":
          return Math.tan(v);
        case "sqrt":
          return Math.sqrt(v);
        case "exp":
          return Math.exp(v);
        case "ln":
          return Math.log(v);
        case "log":
          return Math.log10(v);
        case "abs":
          return Math.abs(v);
        default:
          return NaN;
      }
    }
    default:
      return NaN;
  }
}

/** Central-difference first derivative at `x`. The forgery defense: a value-only
 *  forgery (a bump vanishing at the sample points) has O(1) slope error there. */
export function numericDerivAt(ast, x, h = 1e-4) {
  return (evalAt(ast, x + h) - evalAt(ast, x - h)) / (2 * h);
}

/** AST → LaTeX, for the live preview ONLY (display, not security). Pure. */
export function toTeX(ast) {
  const PREC = {
    add: 1,
    sub: 1,
    mul: 2,
    div: 2,
    neg: 2,
    pow: 3,
    func: 4,
    num: 5,
    const: 5,
    var: 5,
  };
  const wrap = (node, min) => {
    const tex = toTeX(node);
    return PREC[node.t] < min ? `\\left(${tex}\\right)` : tex;
  };
  switch (ast.t) {
    case "num":
      return String(ast.v);
    case "const":
      return ast.name === "pi" ? "\\pi" : "e";
    case "var":
      return "x";
    case "neg":
      return `-${wrap(ast.a, 2)}`;
    case "add":
      return `${toTeX(ast.a)} + ${wrap(ast.b, 1)}`;
    case "sub":
      return `${toTeX(ast.a)} - ${wrap(ast.b, 2)}`;
    case "mul": {
      const L = wrap(ast.a, 2),
        R = wrap(ast.b, 2);
      const juxt =
        ast.a.t === "num" && (ast.b.t === "var" || ast.b.t === "pow" || ast.b.t === "func");
      return juxt ? `${L}${R}` : `${L} \\cdot ${R}`;
    }
    case "div":
      return `\\frac{${toTeX(ast.a)}}{${toTeX(ast.b)}}`;
    case "pow":
      return `${wrap(ast.a, 4)}^{${toTeX(ast.b)}}`;
    case "func":
      return ast.name === "sqrt"
        ? `\\sqrt{${toTeX(ast.a)}}`
        : `\\${ast.name}\\left(${toTeX(ast.a)}\\right)`;
    default:
      return "";
  }
}

// ── Integrity predicates (the security surface — each separately tested) ────────

const SAMPLE_COUNT = 16; // many points → an interpolation/bump forgery is impractical
const RANGE = [-3.3, 3.3];
const MIN_VALID = 6; // floor on JOINTLY-valid points; below ⇒ conservative-false
const TOL = 1e-7; // value tolerance (mixed abs+rel)
const DERIV_TOL = 1e-4; // central-difference is approximate; a forgery's slope error is O(1) ≫ this

/** A point counts ONLY if both sides are finite real numbers (real-only evaluator
 *  ⇒ no Complex; poles / sqrt<0 / ln≤0 / overflow ⇒ NaN/±Infinity, EXCLUDED). */
export function isValidSample(a, b) {
  return Number.isFinite(a) && Number.isFinite(b);
}

/** Mixed absolute+relative tolerance — robust near zero and at large magnitude. */
export function agree(a, b, tol = TOL) {
  return Math.abs(a - b) <= tol * (1 + Math.max(Math.abs(a), Math.abs(b)));
}

function hashString(s) {
  let h = 0x811c9dc5;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, PER-PROBLEM sample points: seed = hash(reference source), so the
 *  points depend on the problem and are NOT a globally known fixed set a learner
 *  reading cas.js can target. Skips any point within 1e-3 of an integer (dodges
 *  common poles). Pure: same reference → same points. */
export function seededPoints(referenceSrc, count = SAMPLE_COUNT) {
  const rng = mulberry32(hashString(referenceSrc));
  const [lo, hi] = RANGE;
  const pts = [];
  let guard = 0;
  while (pts.length < count && guard++ < count * 20) {
    const p = lo + rng() * (hi - lo);
    if (Math.abs(p - Math.round(p)) < 1e-3) continue; // dodge integer poles
    pts.push(p);
  }
  return pts;
}

/** All-must-agree over the points: every JOINTLY-valid point must agree within
 *  `tol`, and there must be ≥ MIN_VALID of them. One disagreement ⇒ ok:false; too
 *  few valid points ⇒ ok:false (conservative — never a pass). `leftOf`/`rightOf`
 *  read each side (evalAt for values; numericDerivAt for the derivative pass). */
export function agreesOnSamples(leftOf, rightOf, aAst, bAst, points, tol) {
  let valid = 0;
  for (const p of points) {
    const a = leftOf(aAst, p);
    const b = rightOf(bAst, p);
    if (!isValidSample(a, b)) continue; // excluded — NEVER counted as agreement
    valid++;
    if (!agree(a, b, tol)) return { ok: false, valid, disagreed: true }; // a real mismatch
  }
  return { ok: valid >= MIN_VALID, valid, disagreed: false }; // ok:false here ⇒ too few valid points
}

/**
 * Is the learner's answer mathematically equivalent to the reference? CONSERVATIVE:
 * a parse failure, any disagreement at a jointly-valid point, or too few valid
 * points ⇒ `{ equivalent:false }` (never a false "correct"). For non-`evaluate`
 * operations the FIRST DERIVATIVES must also agree (defeats value-only forgeries).
 * For `antiderivative` (integration), the check is `d/dx(answer) ≡ reference`
 * (the integrand) by value — so any constant of integration passes. Pure + sync.
 */
export function checkEquivalence(answer, reference, opts = {}) {
  const { variable = "x", checkDerivative = true, antiderivative = false } = opts;
  let aAst, bAst;
  try {
    aAst = parseExpr(answer, variable);
    bAst = parseExpr(reference, variable);
  } catch {
    return {
      equivalent: false,
      reason: "I couldn't read that — check the syntax (use *, ^, and the symbols).",
    };
  }
  const points = seededPoints(reference); // seeded from the REFERENCE, not the answer
  const fail = (v) => ({
    equivalent: false,
    reason: v.disagreed
      ? "Not quite — that isn't equivalent."
      : "I couldn't verify this — try a more explicit form.",
  });

  if (antiderivative) {
    // d/dx(answer) must equal the integrand (reference) at the seeded points.
    const v = agreesOnSamples(numericDerivAt, evalAt, aAst, bAst, points, DERIV_TOL);
    return v.ok ? { equivalent: true } : fail(v);
  }
  const v = agreesOnSamples(evalAt, evalAt, aAst, bAst, points, TOL);
  if (!v.ok) return fail(v);
  if (checkDerivative) {
    const d = agreesOnSamples(numericDerivAt, numericDerivAt, aAst, bAst, points, DERIV_TOL);
    if (!d.ok) return { equivalent: false, reason: "Not quite — that isn't equivalent." };
  }
  return { equivalent: true };
}

// ── Drill generator (references built BY CONSTRUCTION — never from input) ───────

// A polynomial is a coefficient array `c` where c[i] multiplies x^i.
function polyToSrc(c) {
  const terms = [];
  for (let i = 0; i < c.length; i++) {
    if (c[i] === 0) continue;
    if (i === 0) terms.push(`${c[i]}`);
    else if (i === 1) terms.push(`${c[i]}*x`);
    else terms.push(`${c[i]}*x^${i}`);
  }
  return terms.length ? terms.join(" + ") : "0";
}
function derivativeCoeffs(c) {
  const d = [];
  for (let i = 1; i < c.length; i++) d.push(c[i] * i);
  return d.length ? d : [0];
}
function evalPoly(c, x) {
  let s = 0;
  for (let i = c.length - 1; i >= 0; i--) s = s * x + c[i];
  return s;
}

/**
 * A deterministic drill, seeded by integer `seed` (pure: same seed → same problem).
 * Returns `{ operation, prompt, reference, variable, check }` where `prompt` is a
 * Markdown string (math in `$…$`), `reference` is a parseable expression/number,
 * and `check` is the option bag for `checkEquivalence`. The reference is built BY
 * CONSTRUCTION from seeded integer coefficients — never from learner input (AC2).
 * INVARIANT: for non-`evaluate` operations the reference depends on `x`.
 */
export function generateDrill({ operation, seed }) {
  const rng = mulberry32((seed >>> 0) ^ hashString(operation));
  const pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const nonzero = (lo, hi) => {
    let v = 0;
    while (v === 0) v = pick(lo, hi);
    return v;
  };

  if (operation === "differentiate") {
    const deg = pick(2, 3);
    const c = Array.from({ length: deg + 1 }, () => pick(-5, 5));
    c[deg] = nonzero(1, 5); // genuine degree → derivative depends on x
    const expr = polyToSrc(c);
    const reference = polyToSrc(derivativeCoeffs(c));
    return {
      operation,
      reference,
      solution: reference,
      variable: "x",
      check: { variable: "x", checkDerivative: true },
      prompt: `Differentiate with respect to $x$:\n\n$$${toTeX(parseExpr(expr))}$$`,
    };
  }
  if (operation === "integrate") {
    // Build the antiderivative P (so an elementary one exists); the integrand is P'.
    const deg = pick(2, 3);
    const P = Array.from({ length: deg + 1 }, () => pick(-4, 4));
    P[deg] = nonzero(1, 4);
    P[0] = 0; // a canonical antiderivative (any +C is accepted by the derivative check)
    const integrand = derivativeCoeffs(P);
    const reference = polyToSrc(integrand); // the check compares d/dx(answer) ≡ integrand
    return {
      operation,
      reference,
      solution: polyToSrc(P),
      variable: "x",
      check: { variable: "x", antiderivative: true },
      prompt: `Find an antiderivative (any constant of integration is fine):\n\n$$\\int ${toTeX(parseExpr(polyToSrc(integrand)))}\\,dx$$`,
    };
  }
  if (operation === "simplify") {
    const a = nonzero(-6, 6),
      b = nonzero(-6, 6);
    let s = a + b;
    if (s === 0) s = 1; // keep the reference x-dependent
    const k = pick(-5, 5);
    const expr = `${a}*x + ${b}*x${k ? ` + ${k}` : ""}`;
    const reference = `${s}*x${k ? ` + ${k}` : ""}`;
    return {
      operation,
      reference,
      solution: reference,
      variable: "x",
      check: { variable: "x", checkDerivative: true },
      prompt: `Simplify:\n\n$$${toTeX(parseExpr(expr))}$$`,
    };
  }
  // evaluate (default): plug a point into a polynomial; reference is a NUMBER.
  const deg = pick(2, 3);
  const c = Array.from({ length: deg + 1 }, () => pick(-4, 4));
  c[deg] = nonzero(1, 4);
  const at = nonzero(-3, 3);
  const value = evalPoly(c, at);
  return {
    operation: "evaluate",
    reference: `${value}`,
    solution: `${value}`,
    variable: "x",
    check: { variable: "x", checkDerivative: false },
    prompt: `Evaluate at $x = ${at}$:\n\n$$${toTeX(parseExpr(polyToSrc(c)))}$$`,
  };
}

// Quantitative operations a plateau offers, by NAME keyword (pure; [] ⇒ not
// quantitative). Author `solve` blocks make ANY topic solvable regardless.
const DRILL_BY_KEYWORD = [
  [/calculus/i, ["differentiate", "integrate"]],
  [/algebra/i, ["simplify", "evaluate"]],
  [/arithmetic/i, ["evaluate"]],
  [/(motion|rate|kinematic|velocit|deriv)/i, ["differentiate", "evaluate"]],
  [/(geometr|trig|polynomial|function)/i, ["simplify", "evaluate"]],
];
export function drillsFor(plateau) {
  const name = plateau?.name ?? "";
  for (const [re, ops] of DRILL_BY_KEYWORD) if (re.test(name)) return ops;
  return [];
}

// ── Author challenges: ```solve fenced blocks in the plateau body ───────────────
// One shared grammar with stripChallenges (round-trip). A block:
//   ```solve
//   prompt: Differentiate x^2
//   answer: 2x
//   op: differentiate      (optional; default a plain value-equivalence check)
//   var: x                 (optional; default x)
//   ```

const SOLVE_FENCE = /```solve[ \t]*\r?\n([\s\S]*?)\r?\n?```/gi;

function parseBlockBody(body) {
  const out = {};
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*(prompt|answer|op|var)\s*:\s*(.*)$/i.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  if (!out.answer) return null; // a challenge needs a reference answer
  const operation = (out.op || "").toLowerCase();
  return {
    prompt: out.prompt || "Solve:",
    answer: out.answer,
    operation: operation || undefined,
    variable: out.var || "x",
    check: {
      variable: out.var || "x",
      antiderivative: operation === "integrate",
      checkDerivative: operation !== "evaluate",
    },
  };
}

/** Extract author `solve` fenced blocks → checkable challenges (sync, no engine). */
export function parseChallenges(body = "") {
  const out = [];
  const re = new RegExp(SOLVE_FENCE.source, "gi");
  let m;
  while ((m = re.exec(String(body))) !== null) {
    const c = parseBlockBody(m[1]);
    if (c) out.push(c);
  }
  return out;
}

/** The body with EXACTLY the `solve` blocks removed — MUST run before renderMarkdown
 *  (markdown.js greedily turns any fence into <pre><code>) and before model grounding,
 *  so the author's answer never shows in the read view or rides to the model. */
export function stripChallenges(body = "") {
  const re = new RegExp(SOLVE_FENCE.source, "gi");
  return String(body)
    .replace(re, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
