// handoff.js — take a topic to an external AI tool in a new tab (R-0056).
//
// The bring-your-own model API is fragile: a hosted key can answer 404 (retired
// id), 401 (rejected), or 503 (provider overloaded) at any moment, none of it the
// learner's fault. This path removes the API from the loop: the app builds a
// prompt, the UI copies it and opens the chosen tool in a new tab; the learner
// pastes, works there on the subscription they already have (NotebookLM, Gemini,
// AI Studio), and comes back. $0, no key, no adapter. NotebookLM and the Gemini
// web app take NO query-URL param, so "copy the prompt, then open the tab" is the
// honest, reliable pattern.
//
// The NotebookLM pack below is the OWNER'S study strategy (R-0056), generalized
// from its original personal-finance form to ANY topic: add your sources to a
// NotebookLM notebook, then run these prompts in order to go from sources to
// mental models → disagreements → self-test → gap map → deliverables. Kept in the
// owner's working language (Spanish); topic + domain are substituted per plateau.
//
// Pure: builds the destination list and prompt strings. The impure edges
// (clipboard write, window.open) live in main.js.

/** Where a topic can be handed off. No query-URL param exists for any of these,
 *  so the UI copies the prompt first. */
export const HANDOFF_TARGETS = [
  {
    id: "notebooklm",
    label: "NotebookLM",
    url: "https://notebooklm.google.com/",
    note: "add your sources, then paste the pack into its chat — one step at a time",
  },
  {
    id: "gemini",
    label: "Gemini",
    url: "https://gemini.google.com/app",
    note: "opens with your question already asked (Google AI Mode)",
    // R-0073: gemini.google.com has no prompt-URL param, so a blank tab was all
    // the owner ever saw ("it just opens the link, not the topic"). Google's AI
    // Mode DOES carry the query — same Gemini answer, context included.
    prefill: (p) => `https://www.google.com/search?udm=50&q=${encodeURIComponent(p)}`,
  },
  { id: "aistudio", label: "AI Studio", url: "https://aistudio.google.com/", note: "paste the prompt (Cmd/Ctrl+V)" },
];

// Prompts longer than this can't ride a URL safely (and truncating instructions
// mid-sentence is worse than pasting) — they fall back to clipboard + base URL.
export const PREFILL_MAX = 1800;

/**
 * The URL a hand-off click should open (R-0073): the target's `prefill(prompt)`
 * when it supports one AND the prompt fits in a URL — the tab then opens WITH the
 * question already asked — otherwise the target's base URL (the prompt rides the
 * clipboard, as before). Pure.
 */
export function handoffOpenUrl(target, prompt) {
  const p = String(prompt || "");
  if (target?.prefill && p && p.length <= PREFILL_MAX) return target.prefill(p);
  return target?.url ?? "";
}

const NOTES_CAP = 1200; // keep a pasted prompt comfortably within any chat box

/**
 * A self-contained, graph-grounded study prompt for ONE topic — the quick
 * hand-off for Gemini / AI Studio (a plain chat, no sources added). `name` is the
 * topic, `domainLabel` its lens, `notes` the plateau body (capped), `neighbors`
 * the bridged topics `{ name, concept }`. Pure + deterministic.
 */
export function handoffPrompt({ name = "this topic", domainLabel = "", notes = "", neighbors = [] } = {}) {
  const body = String(notes || "").trim().slice(0, NOTES_CAP);
  const where = domainLabel ? ` (in ${domainLabel})` : "";
  const links = (neighbors || [])
    .map((n) => (n && n.name ? `- ${n.name}${n.concept ? ` — connected by "${n.concept}"` : ""}` : ""))
    .filter(Boolean);

  const lines = [
    `I'm studying "${name}"${where}. Be my tutor for it.`,
    "",
    "Do four things: 1) explain the core idea in plain language, then precisely; 2) give the 5–8 things I must understand to call it learned; 3) work one instructive example; 4) ask me 5 questions to test myself (don't answer them).",
  ];
  if (body) {
    lines.push("", "My notes so far (ground your answer in these; say what's missing rather than inventing):", body);
  }
  if (links.length) {
    lines.push("", "This topic connects to:", ...links, "", "Weave those connections in where they matter.");
  }
  return lines.join("\n");
}

// ── The owner's NotebookLM prompt strategy, topic-parameterized (R-0056) ──────
// Each step is { key, label, prompt(topic, domain) }. Faithful to the owner's
// pack (mental models → disagreements → deep comprehension → evaluate → hidden
// connections → gap map → executive report → slides → podcast → applied → Feynman),
// with the finance/Spain specifics removed so it fits any plateau.
const T = (topic) => `"${topic}"`;
const FIELD = (topic, domain) => (domain ? `${domain} (concretamente ${T(topic)})` : T(topic));

export const NOTEBOOKLM_PACK = [
  {
    key: "modelos",
    label: "1 · Modelos mentales",
    prompt: (topic, domain) =>
      [
        `Basándote en TODAS las fuentes de este notebook, identifica los 5 modelos mentales fundamentales que comparten todos los expertos en ${FIELD(topic, domain)}.`,
        "",
        "No quiero un resumen de cada fuente. Quiero los MARCOS DE PENSAMIENTO comunes que subyacen a todas ellas — los principios que un experto con 20 años de experiencia daría por sentados pero que un principiante nunca articularía.",
        "",
        "Para cada modelo mental: 1) nómbralo con una frase clara; 2) explica en qué consiste (2-3 frases); 3) cita al menos 2 fuentes de este notebook que lo respalden; 4) da un ejemplo práctico de cómo cambia una decisión o un razonamiento real.",
      ].join("\n"),
  },
  {
    key: "desacuerdos",
    label: "2 · Desacuerdos entre expertos",
    prompt: (topic, domain) =>
      [
        `Muéstrame los 3 puntos donde los expertos en ${FIELD(topic, domain)} representados en estas fuentes están en DESACUERDO FUNDAMENTAL.`,
        "",
        "Para cada desacuerdo: 1) define la pregunta en disputa; 2) presenta el argumento más fuerte de cada posición, citando fuentes específicas de este notebook; 3) explica por qué el debate importa para alguien que razona o decide de verdad sobre el tema; 4) indica si hay consenso emergente o sigue abierto.",
      ].join("\n"),
  },
  {
    key: "comprension",
    label: "3 · Comprensión profunda",
    prompt: (topic, domain) =>
      [
        `Genera 10 preguntas que expongan si alguien ENTIENDE PROFUNDAMENTE ${FIELD(topic, domain)} o simplemente ha memorizado reglas y datos.`,
        "",
        "Las preguntas deben: requerir razonamiento, no memoria; conectar conceptos de múltiples fuentes de este notebook; incluir situaciones donde la \"regla general\" falla; distinguir entre quien repite y quien comprende los principios de fondo.",
        "",
        "Ordénalas de menor a mayor dificultad.",
      ].join("\n"),
  },
  {
    key: "evaluacion",
    label: "4 · Evalúa mi respuesta",
    prompt: () =>
      [
        "Mi respuesta a la pregunta [N] es: [PEGA TU RESPUESTA AQUÍ]",
        "",
        "Evalúa mi respuesta y explícame: 1) ¿qué he acertado?; 2) ¿qué está mal o incompleto?; 3) ¿qué me falta por entender?; 4) ¿qué fuentes de este notebook debería releer para cubrir ese vacío?",
      ].join("\n"),
  },
  {
    key: "conexiones",
    label: "5 · Conexiones ocultas",
    prompt: () =>
      [
        "Analiza los 5 modelos mentales que has identificado antes. Identifica: 1) ¿dónde se SOLAPAN o se refuerzan?; 2) ¿dónde se CONTRADICEN o crean tensión?; 3) ¿hay un \"meta-modelo\" que los englobe?",
        "",
        "Usa ejemplos concretos de las fuentes de este notebook para ilustrar cada conexión.",
      ].join("\n"),
  },
  {
    key: "vacios",
    label: "6 · Mapa de vacíos",
    prompt: (topic, domain) =>
      [
        `Basándote en toda nuestra conversación y en mis respuestas a las preguntas de comprensión: 1) ¿cuáles son mis 3 mayores vacíos en ${FIELD(topic, domain)}?; 2) para cada vacío, ¿qué fuentes ESPECÍFICAS de este notebook debería estudiar con más detenimiento?; 3) ¿qué conceptos debería dominar ANTES de cubrir cada vacío?; 4) sugiere un orden de estudio óptimo para las próximas 4 horas.`,
      ].join("\n"),
  },
  {
    key: "informe",
    label: "7 · Informe ejecutivo",
    prompt: (topic, domain) =>
      [
        `Genera un informe ejecutivo sobre ${FIELD(topic, domain)} basado en TODAS las fuentes de este notebook.`,
        "",
        "Estructura: 1) RESUMEN EJECUTIVO (máx. 200 palabras); 2) LOS 5 MODELOS MENTALES CLAVE (1 párrafo cada uno, con citas); 3) LOS 3 DEBATES ABIERTOS (posiciones enfrentadas con argumentos); 4) HOJA DE RUTA PRÁCTICA: 10 pasos ordenados para alguien que empieza desde cero; 5) FUENTES RECOMENDADAS POR NIVEL: principiante / intermedio / avanzado.",
        "",
        "Tono: profesional pero accesible, como un documento interno de formación.",
      ].join("\n"),
  },
  {
    key: "slides",
    label: "8 · Presentación 10 slides",
    prompt: (topic, domain) =>
      [
        `Estructura una presentación de 10 diapositivas sobre "Fundamentos de ${FIELD(topic, domain)}" basada en las fuentes de este notebook.`,
        "",
        "Para cada diapositiva: título; 3-4 puntos clave (texto breve para la slide); notas del presentador (2-3 frases de lo que dirías en voz alta); fuente principal que respalda el contenido.",
        "",
        "Orden sugerido: Problema → Contexto → 5 Modelos Mentales (1 slide cada uno) → Debates Clave → Plan de Acción → Recursos.",
      ].join("\n"),
  },
  {
    key: "podcast",
    label: "9 · Podcast (Audio Overview)",
    prompt: (topic, domain) =>
      [
        `El oyente es alguien motivado que empieza desde cero en ${FIELD(topic, domain)} y quiere entenderlo de verdad, no memorizarlo.`,
        "",
        "Enfócate en: los modelos mentales más relevantes para empezar; los errores de razonamiento más comunes según las fuentes; y las aplicaciones prácticas concretas que aparecen en el notebook.",
        "",
        "Tono: como dos amigos que saben del tema tomando un café. Accesible pero con profundidad. Nada de paternalismos.",
      ].join("\n"),
  },
  {
    key: "aplicacion",
    label: "＋ Aplicación práctica",
    prompt: () =>
      [
        "Para cada uno de los 5 modelos mentales fundamentales, dame 3 situaciones reales y cotidianas donde aplicar ese modelo cambiaría el resultado de una decisión o un razonamiento.",
        "",
        "Las situaciones deben ser concretas (con contexto y, si aplica, números), no genéricas, e incluir el razonamiento paso a paso de cómo el modelo mental guía la decisión.",
      ].join("\n"),
  },
  {
    key: "feynman",
    label: "＋ Método Feynman",
    prompt: () =>
      [
        "Voy a explicarte el concepto de [MODELO MENTAL X] como si se lo contara a alguien que no sabe nada del tema.",
        "",
        "Mi explicación: [ESCRIBE TU EXPLICACIÓN AQUÍ]",
        "",
        "Evalúa mi explicación: 1) ¿dónde he simplificado de más y he perdido algo esencial?; 2) ¿dónde me he equivocado?; 3) ¿qué analogía o ejemplo la mejoraría?; 4) puntúa mi comprensión del 1 al 10 y justifica la nota.",
      ].join("\n"),
  },
];

/**
 * The full NotebookLM pack for one topic as a single pasteable document — the
 * steps concatenated with a short how-to header. `topic` is the plateau name,
 * `domain` its lens label (optional). Pure + deterministic.
 */
export function notebookLmPack(topic = "este tema", domain = "") {
  const header = [
    `# Pack de estudio NotebookLM — ${topic}${domain ? ` · ${domain}` : ""}`,
    "",
    "Cómo usarlo: añade tus fuentes al notebook (apuntes, libros, PDFs, enlaces), luego pega estos prompts EN ORDEN, uno a uno, esperando la respuesta de cada uno antes del siguiente.",
    "",
  ].join("\n");
  const body = NOTEBOOKLM_PACK.map((s) => `## ${s.label}\n${s.prompt(topic, domain)}`).join("\n\n");
  return `${header}\n${body}`;
}
