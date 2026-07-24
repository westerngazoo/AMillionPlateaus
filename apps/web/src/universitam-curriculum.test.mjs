import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UNIVERSITAM_DOMAIN,
  UNIVERSITAM_PLATEAUS,
  UNIVERSITAM_TWINS,
  UNIVERSITAM_BRIDGES,
  UNIVERSITAM_PATH,
  UNIVERSITAM_TWIN_PATH,
} from "./universitam-curriculum.js";
import { GA_DOMAIN, SIA_DOMAIN, DOMAINS } from "./persona.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const all = [...UNIVERSITAM_PLATEAUS, ...UNIVERSITAM_TWINS];
const ids = new Set(all.map((p) => p.id));

test("the degree has all 49 asignaturas from the curricular map", () => {
  assert.equal(UNIVERSITAM_PLATEAUS.length, 49);
  // spot-check the spine against the printed map
  const byName = (n) => UNIVERSITAM_PLATEAUS.find((p) => p.name === n);
  for (const n of ["Introducción al cálculo", "Cálculo I", "Cálculo II", "Cálculo III", "Cálculo IV",
                   "Álgebra Lineal I", "Álgebra Lineal II", "Electromagnetismo I", "Electromagnetismo II",
                   "Mecánica Cuántica I", "Mecánica Cuántica II", "Mecánica Cuántica III",
                   "Topología", "Mecánica Relativista", "Seminario de Investigación"])
    assert.ok(byName(n), `missing asignatura: ${n}`);
  // every course records its clave and cuatrimestre in the body
  for (const p of UNIVERSITAM_PLATEAUS) {
    assert.match(p.description, /Cuatrimestre \d+/, `${p.name} has no cuatrimestre`);
    assert.match(p.description, /créditos/, `${p.name} has no créditos`);
  }
});

test("every id is a distinct, valid UUID (the seed API parses ids as Uuid)", () => {
  for (const p of all) assert.match(p.id, UUID_RE, `${p.name}: bad id ${p.id}`);
  for (const b of UNIVERSITAM_BRIDGES) assert.match(b.id, UUID_RE, `bridge ${b.concept}: bad id`);
  assert.equal(ids.size, all.length, "duplicate plateau id");
  const bids = new Set(UNIVERSITAM_BRIDGES.map((b) => b.id));
  assert.equal(bids.size, UNIVERSITAM_BRIDGES.length, "duplicate bridge id");
  // and they must not collide with the plateau namespace
  for (const b of bids) assert.equal(ids.has(b), false);
});

test("courses sit in the degree lens; twins sit in THEIR OWN lens", () => {
  for (const p of UNIVERSITAM_PLATEAUS) assert.equal(p.domain, UNIVERSITAM_DOMAIN, p.name);
  for (const t of UNIVERSITAM_TWINS)
    assert.ok(t.domain === GA_DOMAIN || t.domain === SIA_DOMAIN, `${t.name} is not in a GA/SIA lens`);
  // the degree lens is registered so it is faceable and labelled (not "Uncharted")
  assert.ok(DOMAINS.some((d) => d.id === UNIVERSITAM_DOMAIN), "degree lens missing from DOMAINS");
});

test("every bridge connects plateaus that actually exist", () => {
  for (const b of UNIVERSITAM_BRIDGES) {
    assert.ok(ids.has(b.from), `bridge "${b.concept}": unknown from ${b.from}`);
    assert.ok(ids.has(b.to), `bridge "${b.concept}": unknown to ${b.to}`);
    assert.notEqual(b.from, b.to, `bridge "${b.concept}" is a self-loop`);
  }
});

// The parallel-view promise: each written twin is reachable from its course by a
// uniformly-labelled cross-lens edge, so course <-> twin is machine-findable.
test("every twin is joined to a course by an 'alternative formulation of' bridge", () => {
  const twinEdges = UNIVERSITAM_BRIDGES.filter((b) => b.concept === "alternative formulation of");
  assert.equal(twinEdges.length, UNIVERSITAM_TWINS.length, "a twin has no cross-lens edge");
  const courseIds = new Set(UNIVERSITAM_PLATEAUS.map((p) => p.id));
  const twinIds = new Set(UNIVERSITAM_TWINS.map((p) => p.id));
  for (const b of twinEdges) {
    assert.ok(twinIds.has(b.from), `twin edge must start at the twin: ${b.from}`);
    assert.ok(courseIds.has(b.to), `twin edge must end at a course: ${b.to}`);
  }
  // every twin is used exactly once
  assert.equal(new Set(twinEdges.map((b) => b.from)).size, UNIVERSITAM_TWINS.length);
});

test("the twins cover the cuatrimestre 1-3 spine the owner is studying now", () => {
  const courseOf = new Map(UNIVERSITAM_PLATEAUS.map((p) => [p.id, p.name]));
  const twinned = UNIVERSITAM_BRIDGES
    .filter((b) => b.concept === "alternative formulation of")
    .map((b) => courseOf.get(b.to));
  for (const n of ["Introducción al cálculo", "Cálculo I", "Cálculo II",
                   "Introducción al álgebra", "Álgebra Superior", "Geometría Analítica",
                   "Álgebra Lineal I", "Física I", "Óptica", "Introducción a la Física"])
    assert.ok(twinned.includes(n), `no alternative view for ${n}`);
  // the calculus spine is SIA; the geometry/algebra/mechanics spine is GA
  const twinById = new Map(UNIVERSITAM_TWINS.map((t) => [t.id, t]));
  for (const b of UNIVERSITAM_BRIDGES.filter((x) => x.concept === "alternative formulation of")) {
    const name = courseOf.get(b.to);
    const dom = twinById.get(b.from).domain;
    if (/Cálculo/.test(name)) assert.equal(dom, SIA_DOMAIN, `${name} twin should be SIA`);
  }
});

test("both paths reference only real plateaus, in order, without repeats", () => {
  assert.deepEqual(UNIVERSITAM_PATH.steps, UNIVERSITAM_PLATEAUS.map((p) => p.id));
  assert.equal(new Set(UNIVERSITAM_PATH.steps).size, 49);
  for (const s of UNIVERSITAM_TWIN_PATH.steps) assert.ok(ids.has(s), `twin path step ${s} not found`);
  assert.equal(new Set(UNIVERSITAM_TWIN_PATH.steps).size, UNIVERSITAM_TWIN_PATH.steps.length);
  assert.equal(UNIVERSITAM_TWIN_PATH.steps.length, UNIVERSITAM_TWINS.length);
  assert.notEqual(UNIVERSITAM_PATH.id, UNIVERSITAM_TWIN_PATH.id);
});

test("seriación bridges match the prerequisites printed on the map", () => {
  const name = new Map(all.map((p) => [p.id, p.name]));
  const ser = UNIVERSITAM_BRIDGES
    .filter((b) => b.concept.startsWith("seriación"))
    .map((b) => `${name.get(b.from)} -> ${name.get(b.to)}`);
  for (const pair of [
    "Cálculo I -> Cálculo II",
    "Álgebra Superior -> Álgebra Lineal I",
    "Introducción a la Física -> Física I",
    "Cálculo II -> Cálculo III",
    "Física I -> Física II",
    "Electromagnetismo I -> Electromagnetismo II",
    "Mecánica Cuántica I -> Mecánica Cuántica II",
    "Mecánica Cuántica II -> Mecánica Cuántica III",
    "Física Estadística I -> Física Estadística II",
    "Física Computacional I -> Física Computacional II",
  ])
    assert.ok(ser.includes(pair), `missing seriación: ${pair}`);
});

// FIS-1924 is PDEs (the map's title was a typo), and PDEs are the prerequisite
// the material demands before Electromagnetismo II and Mecánica Cuántica.
test("PDEs (FIS-1924) precede Electromagnetismo II and Mecánica Cuántica", () => {
  const byName = (n) => UNIVERSITAM_PLATEAUS.find((p) => p.name === n);
  const pde = byName("Ecuaciones Diferenciales Parciales");
  const electroII = byName("Electromagnetismo II");
  const cuanticaI = byName("Mecánica Cuántica I");
  assert.ok(pde && electroII && cuanticaI);
  assert.match(pde.description, /Schrödinger|Electromagnetismo/); // body explains why it is load-bearing
  const edge = (from, to) =>
    UNIVERSITAM_BRIDGES.some((b) => b.from === from && b.to === to);
  assert.ok(edge(pde.id, electroII.id), "PDEs must bridge to Electromagnetismo II");
  assert.ok(edge(pde.id, cuanticaI.id), "PDEs must bridge to Mecánica Cuántica I");
  // and PDEs follow from ODEs, not the other way round
  assert.ok(edge(byName("Ecuaciones Diferenciales Ordinarias").id, pde.id), "ODEs → PDEs");
});

test("positions are finite and in range (Grade-1 vector components)", () => {
  for (const p of all)
    for (const k of ["e1", "e2", "e3"]) {
      assert.ok(Number.isFinite(p[k]), `${p.name}.${k} not finite`);
      assert.ok(p[k] >= 0 && p[k] <= 1, `${p.name}.${k} out of [0,1]: ${p[k]}`);
    }
});

// Content must render in THIS app's markdown subset (markdown.js supports
// h1-h6, p, br, strong, em, code, pre, ul/ol/li, a, span, img — no blockquote),
// and its block rules are strict: a heading is only a heading when it is its own
// block, and lines inside one block join with <br> and NO space. Both bit this
// content once; these assertions are why they cannot come back silently.
test("every body renders correctly in the app's markdown subset", async () => {
  const md = await import("./markdown.js");
  const render = md.renderMarkdown ?? md.default ?? Object.values(md).find((v) => typeof v === "function");
  for (const p of all) {
    const html = render(p.description);
    assert.match(html, /^<h1>/, `${p.name}: title is not rendering as a heading`);
    assert.equal(/>#{1,6}\s/.test(html), false, `${p.name}: a literal # leaked into the output`);
    assert.equal(/>&gt;\s|<p>&gt;/.test(html), false, `${p.name}: blockquote markers leak (unsupported)`);
    // a <br> join inside a paragraph glues words together — the "allits" bug
    assert.equal(/[a-záéíóúñ]<br>[a-záéíóúñ]/i.test(html), false, `${p.name}: <br> glues two words`);
    // a list that lost its blank line collapses into the lead-in paragraph and
    // renders its "- " markers as body text (R-0097 found two of these)
    assert.equal(/<p>[^<]*[:.]\s-\s/.test(html), false, `${p.name}: a bullet list collapsed into a paragraph`);
  }
});
