/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v9.7.4 — NIVEL DIOS ITERATIVO

   Principio rector:
   - El modelo puede ser probabilístico.
   - El código NO.
   - Toda la arquitectura alrededor del modelo debe ser determinista, segura y total.

   CAMBIOS CLAVE:
   ✅ buildPrompt reescrito con switch (evaluación selectiva real)
   ✅ Bibliografía EN/ES en carril IA separado
   ✅ Auditoría bibliográfica IA para evitar cruces de libros del mismo autor
   ✅ Activadores EN en carril IA separado
   ✅ Tarjeta EN nativa con verificador propio
   ✅ Temperatura dinámica capada a 1.2
   ✅ Blindaje total contra undefined en prompts, validadores y pipeline
   ✅ Fallbacks marcados con _fallback para no contaminar batch

   AUTOR: Badir Nakid | VERSIÓN: 9.7.4
═══════════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs/promises";
import { randomInt } from "node:crypto";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

const KEY = process.env.OPENAI_KEY;
if (!KEY) {
  console.log("🔕 Sin OPENAI_KEY");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: KEY });

const CFG = {
  model: "gpt-4o-mini",
  temp: 1.2,
  top_p: 0.9,
  presence: 0.7,
  frequency: 0.4,

  files: {
    csv: "data/libros_master.csv",
    outBatch: "contenido.json",
    outSingle: "contenido_edicion.json",
    tmpBook: "/tmp/triggui-book.json"
  },

  prompts: {
    useExternalEditorial: process.env.USE_EXTERNAL_EDITORIAL_PROMPTS === "true",
    constitution: "prompts/constitution/triggui-core.md",
    editorial: "prompts/tasks/generate-editorial.md"
  },

  processing: {
    maxBatch: 20,
    delayBetweenBooksMs: 10000,
    maxRetries: 20,
    retrySleepMs: 2000,
    resetMemoryEvery: 5
  },

  hawkins: {
    base: [20, 100],
    madrugada: [20, 75],
    manana: [50, 150],
    tarde: [30, 120],
    noche: [20, 100]
  },

  frases: { cantidad: 4, longitudMin: 90, longitudMax: 110 },
  palabras: { cantidad: 4 },
  colores: { cantidad: 4 },

  tarjeta: {
    accionMin: 15,
    accionMax: 60,
    lineasMin: 4,
    longitudMinLinea: 10,
    tituloGuia: 50,
    parrafo1Guia: 60,
    subtituloGuia: 70,
    parrafo2Guia: 90,
    minHighlights: 2
  },

  darkMode: {
    paperMin: "#0a0a0a",
    paperMax: "#2a2a2a",
    inkMin: "#e0e0e0",
    inkMax: "#ffffff",
    lumThresholdPaper: 0.3,
    lumThresholdInk: 0.7
  },

  energia: {
    lunes: 0.8,
    martes: 0.4,
    miércoles: 0.6,
    jueves: 1.2,
    viernes: 0.9,
    sábado: 0.8,
    domingo: 0.8
  },

  dinamico: {
    tempMultiplicador: true,
    hawkinsShift: true,
    frasesExtension: true
  },

  verification: {
    enabled: true,
    logLowScore: true,
    retryIfLowScore: true,
    minScore: 0.8
  }
};

const state = { palabras: new Set(), colores: new Set() };
const promptState = { editorial: null, warnedFallback: false };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const utils = {
  lum(hex) {
    const safe = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? String(hex) : "#000000";
    const [r, g, b] = safe.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255);
    const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  },

  txt(hex) {
    return utils.lum(hex) > 0.35 ? "#000000" : "#FFFFFF";
  },

  shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  },

  cleanJSON(raw) {
    return String(raw || "").trim()
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{[]*/, "")
      .replace(/[^}\]]*$/, "");
  },

  uniqueKey(libro) {
    return `${String(libro?.titulo || "").trim().toLowerCase()}__${String(libro?.autor || "").trim().toLowerCase()}`;
  }
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanJoin(arr, sep = ", ") {
  return safeArray(arr).map((x) => String(x || "").trim()).filter(Boolean).join(sep);
}

function normalizeArrayStrings(arr, limit) {
  return safeArray(arr).map((x) => String(x || "").trim()).filter(Boolean).slice(0, limit);
}

function normalizeAscii(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sharedTokenCount(a = "", b = "") {
  const aa = new Set(normalizeAscii(a).split(" ").filter(Boolean));
  const bb = new Set(normalizeAscii(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  return [...aa].filter((t) => bb.has(t)).length;
}

function countEqualNormalized(a = [], b = []) {
  const aa = safeArray(a);
  const bb = safeArray(b);
  let count = 0;
  for (let i = 0; i < Math.min(aa.length, bb.length); i += 1) {
    const av = normalizeAscii(aa[i]);
    const bv = normalizeAscii(bb[i]);
    if (av && av === bv) count += 1;
  }
  return count;
}

function hasLikelySpanishSignals(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  if (/[¿¡áéíóúñü]/i.test(value)) return true;
  return /\b(el|la|los|las|de|del|para|por|con|sin|que|como|cuando|donde|hoy|ahora|durante|segundos|minutos|dedica|toma|escribe|reflexiona|observa|conecta|haz|solo|una|un|tu|tus)\b/i.test(value);
}

function hasLikelyEnglishSignals(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  return /\b(the|a|an|and|or|with|without|through|within|after|before|take|spend|write|reflect|observe|connect|today|now|seconds|minutes|your|what|how|why|when|where|growth|focus|habit|change|performance)\b/i.test(value);
}

function endsWithDanglingConnector(text = "", lang = "es") {
  const value = String(text || "").trim();
  if (!value) return false;
  const es = /\b(de|del|la|las|los|el|un|una|unos|unas|y|o|u|en|por|para|con|sin|sobre|hacia|desde|hasta|como|que|cuando|donde|al|a)\??$/i;
  const en = /\b(of|the|a|an|and|or|to|with|without|for|from|in|on|at|by|into|about|through|toward|towards|that|which|who|how|when|where)\??$/i;
  return (lang === "en" ? en : es).test(value);
}

function hasGenericClosing(text = "", lang = "es") {
  const value = String(text || "").trim();
  if (!value) return false;
  if (lang === "en") {
    return /(reflective close|empowering conclusion|meaningful close|actionable insight|a deeper understanding awaits|dream big|embrace the journey ahead|maximize receptiveness|transformative possibilities|unlock potential)/i.test(value);
  }
  return /(cierre reflexivo|cierre inspirador|conclusión inspiradora|encuentra tu fuerza interior|encuentra tu centro)/i.test(value);
}

function normalizeHighlightSyntax(input) {
  let text = String(input || "");
  if (!text.trim()) return "";
  text = text.replace(/\{\{H\}\}/gi, "[H]").replace(/\{\{\/H\}\}/gi, "[/H]");
  text = text.replace(/\[h\]/g, "[H]").replace(/\[\/h\]/g, "[/H]");

  let toggleOpen = true;
  text = text.replace(/\[H\]/g, () => {
    const token = toggleOpen ? "[H]" : "[/H]";
    toggleOpen = !toggleOpen;
    return token;
  });

  const opens = (text.match(/\[H\]/g) || []).length;
  const closes = (text.match(/\[\/H\]/g) || []).length;
  if (opens > closes) text += "[/H]".repeat(opens - closes);

  let excess = (text.match(/\[\/H\]/g) || []).length - (text.match(/\[H\]/g) || []).length;
  if (excess > 0) {
    const parts = text.split("");
    for (let i = parts.length - 1; i >= 0 && excess > 0; i -= 1) {
      if (parts.slice(i - 3, i + 1).join("") === "[/H]") {
        parts.splice(i - 3, 4);
        excess -= 1;
        i -= 3;
      }
    }
    text = parts.join("");
  }

  text = text.replace(/\[H\]\s*\[\/H\]/g, "");
  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function countHighlights(text) {
  const matches = normalizeHighlightSyntax(text).match(/\[H\](.*?)\[\/H\]/gis) || [];
  return matches.map((m) => m.replace(/\[H\]|\[\/H\]/gi, "").trim()).filter(Boolean).length;
}

function stripHighlightTags(text) {
  return normalizeHighlightSyntax(String(text || "")).replace(/\[H\]|\[\/H\]/gi, "");
}

function normalizeSentence(text) {
  const v = String(text || "").replace(/\s+/g, " ").trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
}

function sanitizeTitleText(text) {
  return normalizeSentence(
    stripHighlightTags(String(text || ""))
      .replace(/@@BODY|@@ENDBODY/gi, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
      .replace(/[.!?…]+$/g, "")
      .trim()
  );
}

function sanitizeSubtitleText(text, lang = "es") {
  let clean = normalizeSentence(
    stripHighlightTags(String(text || ""))
      .replace(/@@BODY|@@ENDBODY/gi, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
      .trim()
  );
  if (!clean) return "";

  const isQuestion = lang === "es" ? clean.startsWith("¿") : clean.endsWith("?");
  clean = isQuestion ? clean.replace(/[.…]+$/g, "").trim() : clean.replace(/[.!?…]+$/g, "").trim();

  const words = clean.split(/\s+/).filter(Boolean);
  const maxWords = isQuestion ? 12 : 8;
  const maxChars = isQuestion ? 90 : 72;
  if (words.length > maxWords || clean.length > maxChars) {
    let truncated = words.slice(0, maxWords).join(" ");
    if (isQuestion && lang === "es" && !truncated.endsWith("?")) truncated += "?";
    if (isQuestion && lang === "en" && !truncated.endsWith("?")) truncated += "?";
    clean = truncated;
  }

  return clean;
}

function comparableText(text) {
  return stripHighlightTags(String(text || ""))
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function tooSimilarText(a, b) {
  const aa = comparableText(a), bb = comparableText(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  if ((aa.includes(bb) || bb.includes(aa)) && Math.min(aa.length, bb.length) > 42) return true;
  const tA = new Set(aa.split(" ").filter(Boolean));
  const tB = new Set(bb.split(" ").filter(Boolean));
  const inter = [...tA].filter((t) => tB.has(t)).length;
  const union = new Set([...tA, ...tB]).size || 1;
  return (inter / union) >= 0.78;
}

function removeRepeatedSentences(parrafoBot, parrafoTop, subtitulo = "") {
  const pool = [parrafoTop, subtitulo].filter(Boolean);
  const sentences = String(parrafoBot || "").match(/[^.!?…]+[.!?…]?/g)?.map((s) => s.trim()).filter(Boolean) || [];
  const filtered = sentences.filter((s) => !pool.some((base) => tooSimilarText(s, base)));
  return normalizeHighlightSyntax(filtered.join(" ").replace(/[ \t]{2,}/g, " ").trim());
}

function ensureMinimumHighlights(text, minimum = CFG.tarjeta.minHighlights) {
  let norm = normalizeHighlightSyntax(text);
  norm = norm.replace(/\[H\](.*?)\[\/H\]/gi, (match, content) => {
    const plain = content.trim();
    if (plain.length < 25) return plain;
    if (/\b(de|del|en|a|al|con|por|para|sin|sobre|entre|hacia|hasta|desde|tras|un|una|el|la|los|las|que|y|o|of|the|and|to|with|for|in|on|at|by)\s*$/i.test(plain)) {
      return plain;
    }
    return match;
  });
  norm = normalizeHighlightSyntax(norm);

  if (countHighlights(norm) >= minimum) return norm;

  const segments = stripHighlightTags(norm)
    .split(/(?<=[\.\!\?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28);

  for (const seg of segments.slice(0, minimum)) {
    if (countHighlights(norm) >= minimum) break;
    const escaped = seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    norm = norm.replace(new RegExp(escaped), `[H]${seg}[/H]`);
  }

  return normalizeHighlightSyntax(norm);
}

function normalizeTarjetaObject(tarjeta = {}, lang = "es") {
  const clean = {
    titulo: sanitizeTitleText(String(tarjeta.titulo || "").trim()),
    parrafoTop: ensureMinimumHighlights(normalizeHighlightSyntax(String(tarjeta.parrafoTop || "").trim()), 1),
    subtitulo: sanitizeSubtitleText(String(tarjeta.subtitulo || "").trim(), lang),
    parrafoBot: ensureMinimumHighlights(normalizeHighlightSyntax(String(tarjeta.parrafoBot || "").trim()), 1),
    style: tarjeta.style || {}
  };

  if (tooSimilarText(clean.parrafoTop, clean.parrafoBot)) {
    clean.parrafoBot = removeRepeatedSentences(clean.parrafoBot, clean.parrafoTop, clean.subtitulo);
  }

  return clean;
}

function detectOriginalLanguageFromTitles(tituloBase = "", tituloEs = "", tituloEn = "") {
  const base = String(tituloBase || "").trim();
  const es = String(tituloEs || "").trim();
  const en = String(tituloEn || "").trim();
  if (/[¿¡áéíóúñü]/i.test(base) || /[¿¡áéíóúñü]/i.test(es)) return "es";
  const englishSignals = /\b(the|and|of|for|to|with|without|war|art|mind|life|power|love|time|work|habit|habits|thinking|guide|how|why|when|where|who|fear|hooked|masters|scale|daily|journey|book|code|performance|justice|problem|solution|world|exist)\b/i;
  if (englishSignals.test(base) || englishSignals.test(en)) return "en";
  return "es";
}

function normalizeBibliografiaData(data = {}, libro = {}) {
  const tituloBase = String(libro?.titulo || "").trim();
  let titulo_es = String(data.titulo_es || "").trim();
  let titulo_en = String(data.titulo_en || "").trim();
  let idioma_original = String(data.idioma_original || "").trim().toLowerCase();

  if (!titulo_es && !titulo_en && tituloBase) titulo_es = tituloBase;
  if (!titulo_es && titulo_en) titulo_es = tituloBase || titulo_en;
  if (!titulo_en && titulo_es) titulo_en = tituloBase || titulo_es;
  if (!/^(es|en)$/.test(idioma_original)) {
    idioma_original = detectOriginalLanguageFromTitles(tituloBase, titulo_es, titulo_en);
  }
  if (!titulo_es && idioma_original === "es" && tituloBase) titulo_es = tituloBase;
  if (!titulo_en && idioma_original === "en" && tituloBase) titulo_en = tituloBase;
  if (!titulo_es) titulo_es = tituloBase || titulo_en;
  if (!titulo_en) titulo_en = tituloBase || titulo_es;

  return {
    titulo_es: titulo_es.trim(),
    titulo_en: titulo_en.trim(),
    idioma_original
  };
}

function getContexto() {
  const now = new Date();
  const dia = now.toLocaleDateString("es-MX", { weekday: "long" }).toLowerCase();
  const hora = now.getHours();

  let franja = "noche";
  if (hora >= 0 && hora < 6) franja = "madrugada";
  else if (hora >= 6 && hora < 12) franja = "manana";
  else if (hora >= 12 && hora < 18) franja = "tarde";

  const energia = CFG.energia[dia] || 0.8;
  const tempCalculada = CFG.dinamico.tempMultiplicador ? CFG.temp * energia : CFG.temp;

  return {
    dia,
    hora,
    franja,
    energia,
    tempDinamica: Math.max(0.2, Math.min(CFG.temp, Number(tempCalculada.toFixed(2)))),
    bibliografiaTemp: 0.3,
    hawkinsDinamico: CFG.dinamico.hawkinsShift ? CFG.hawkins[franja] : CFG.hawkins.base,
    frasesLongitud: CFG.dinamico.frasesExtension
      ? { min: Math.round(CFG.frases.longitudMin * energia), max: Math.round(CFG.frases.longitudMax * energia) }
      : { min: CFG.frases.longitudMin, max: CFG.frases.longitudMax }
  };
}

const NEUROBIOLOGIA = {
  estadoEntrada: {
    ondas: {
      actual: "beta",
      objetivo: "alfa",
      metodo: "Colores dopaminérgicos + palabras emocionales directas + frases rítmicas"
    },
    neurotransmisores: {
      dopamina: {
        fase: "entrada",
        metodo: "Colores vibrantes, emojis, promesa de acción rápida (<60seg)",
        verificacion: "Usuario siente impulso de actuar en <10seg"
      },
      serotonina: {
        fase: "desarrollo",
        metodo: "Colores cálidos suaves, palabras Hawkins 200-400, validación",
        verificacion: "Usuario siente bienestar y permanencia"
      },
      oxitocina: {
        fase: "cierre",
        metodo: "Preguntas reflexivas, acciones de auto-cuidado, validación",
        verificacion: "Usuario siente conexión y comprensión"
      }
    }
  }
};

async function readPromptFile(relativePath) {
  const candidates = [
    new URL(`../${relativePath}`, import.meta.url),
    new URL(`./${relativePath}`, import.meta.url)
  ];
  let lastError = null;
  for (const fileUrl of candidates) {
    try { return await fs.readFile(fileUrl, "utf8"); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error(`No se pudo leer: ${relativePath}`);
}

function extractMarkdownSection(markdown, heading) {
  const source = String(markdown || "");
  const re = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  const match = re.exec(source);
  if (!match) throw new Error(`Sección \"${heading}\" no encontrada`);
  const tail = source.slice(match.index + match[0].length).replace(/^\s+/, "");
  const next = /^##\s+/m.exec(tail);
  const content = (next ? tail.slice(0, next.index) : tail).trim();
  if (!content) throw new Error(`Sección \"${heading}\" vacía`);
  return content;
}

function renderPromptTemplate(template, variables) {
  let out = String(template || "");
  for (const [token, value] of Object.entries(variables)) {
    out = out.split(token).join(String(value ?? ""));
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

async function loadEditorialPromptArtifacts() {
  if (promptState.editorial) return promptState.editorial;
  try {
    const [constitution, task] = await Promise.all([
      readPromptFile(CFG.prompts.constitution),
      readPromptFile(CFG.prompts.editorial)
    ]);
    promptState.editorial = {
      available: true,
      constitution: constitution.trim(),
      systemSection: extractMarkdownSection(task, "SYSTEM MESSAGE").trim(),
      userSection: extractMarkdownSection(task, "USER PROMPT TEMPLATE").trim()
    };
  } catch (error) {
    promptState.editorial = {
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  return promptState.editorial;
}

function promptBase(libro, ctx) {
  const prohibidas = cleanJoin([...state.palabras]);
  const prohibidosC = cleanJoin([...state.colores]);
  return `
Eres Triggui. Neurobiólogo + Diseñador de experiencias emocionales.

═══════════════════════════════════════════════════════════════
📚 LIBRO QUE DEBES DOMINAR:
═══════════════════════════════════════════════════════════════
"${libro.titulo}" — ${libro.autor}
${libro.tagline ? `"${libro.tagline}"` : ""}

═══════════════════════════════════════════════════════════════
⏰ CONTEXTO CRONOBIOLÓGICO:
═══════════════════════════════════════════════════════════════
${ctx.dia} ${ctx.hora}h | Energía usuario: ${Math.round(ctx.energia * 100)}%
Rango Hawkins óptimo: ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}
Franja: ${ctx.franja}

${prohibidas ? `🚫 PALABRAS YA USADAS (PROHIBIDO repetir): ${prohibidas}` : ""}
${prohibidosC ? `🎨 COLORES YA USADOS (PROHIBIDO repetir): ${prohibidosC}` : ""}

═══════════════════════════════════════════════════════════════
🧠 OBLIGACIÓN CRÍTICA:
═══════════════════════════════════════════════════════════════

No finjas haber buscado afuera. GPT-4o-mini no navega.
Trabaja SOLO con rasgos específicos del libro que realmente conozcas:
- Temas centrales, conflictos, arco emocional
- Atmósfera, tono, sensación que el libro produce
- Contexto del autor, movimiento literario, época
- Lo que lectores reales sienten al leerlo

Si tu base sobre este libro es insuficiente, reduce la ambición.
Ve a una verdad más sobria, concreta y honesta.
No inventes citas, escenas ni conceptos que no puedas sostener.
Nunca suenes convencido de algo que no verificaste.
`;
}

function buildPrompt(libro, tipo, ctx, extra = null) {
  const base = promptBase(libro, ctx);
  const extraSafe = extra || {};
  const palabras = normalizeArrayStrings(extraSafe.palabras, CFG.palabras.cantidad);
  const frases = normalizeArrayStrings(extraSafe.frases, CFG.frases.cantidad);
  const palabrasEn = normalizeArrayStrings(extraSafe.palabras_en, CFG.palabras.cantidad);
  const frasesEn = normalizeArrayStrings(extraSafe.frases_en, CFG.frases.cantidad);

  switch (tipo) {
    case "main":
      return base + `
═══════════════════════════════════════════════════════════════
🎯 GENERAR: Activadores emocionales para "${libro.titulo}"
═══════════════════════════════════════════════════════════════

Genera SOLO JSON con:
- dimension
- punto
- palabras (4)
- frases (4)
- colores (4)
- fondo

REGLAS:
- Palabras específicas del libro
- Frases con emoji + microacción concreta
- Colores hex completos
- Fondo oscuro
- Nada genérico

JSON:
{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": ["string","string","string","string"],
  "frases": ["emoji string","emoji string","emoji string","emoji string"],
  "colores": ["#hex","#hex","#hex","#hex"],
  "fondo": "#hex"
}

SOLO JSON.`;

    case "bibliografia":
      return `
Eres un resolutor bibliográfico bilingüe de precisión extrema.

Debes devolver metadata canónica para ESTA MISMA obra.
NO confundas esta obra con otro libro del mismo autor.

Título visto: "${libro.titulo}"
Autor: "${libro.autor}"
Tagline/contexto: "${libro.tagline || ""}"

Reglas:
1. Devuelve titulo_es y titulo_en para la misma obra.
2. idioma_original solo puede ser "es" o "en".
3. Si conoces un título publicado real, úsalo.
4. Si no estás seguro del otro idioma, conserva el original y da la mejor equivalencia natural sin inventar subtítulos.
5. Si hay riesgo de confusión con otra obra del mismo autor, prioriza título visto + tagline.

JSON:
{
  "titulo_es": "string",
  "titulo_en": "string",
  "idioma_original": "es|en"
}

SOLO JSON.`;

    case "bibliografia_auditor":
      return `
Eres un auditor bibliográfico implacable.

Debes decidir si la propuesta corresponde EXACTAMENTE a la misma obra recibida.
Si hay duda real o parece otro libro del mismo autor, same_work=false.

Título visto: "${libro.titulo}"
Autor: "${libro.autor}"
Tagline/contexto: "${libro.tagline || ""}"

Propuesta:
- titulo_es: "${String(extraSafe.titulo_es || "").trim()}"
- titulo_en: "${String(extraSafe.titulo_en || "").trim()}"
- idioma_original: "${String(extraSafe.idioma_original || "").trim()}"

JSON:
{
  "same_work": true,
  "risk": "low|medium|high",
  "reason": "string"
}

SOLO JSON.`;

    case "activadores_en":
      return `
You are generating native English activators for Triggui.

Your task is NOT to translate literally.
Create natural English equivalents for the same emotional journey.

Book:
Spanish title: "${String(extraSafe.titulo_es || libro.titulo).trim()}"
English title: "${String(extraSafe.titulo_en || libro.titulo).trim()}"
Author: "${libro.autor}"
Original language: "${String(extraSafe.idioma_original || "").trim()}"

Source activators in Spanish:
Palabras ES: ${cleanJoin(palabras)}
Frases ES:
${frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Rules:
1. Return exactly 4 palabras_en and 4 frases_en.
2. palabras_en must be native English emotional words or compact expressions.
3. frases_en must sound like a native English speaker wrote them.
4. Keep the same emotional intent and action logic.
5. Keep emoji at the start.
6. Keep explicit time where relevant.
7. Do not copy the Spanish text.
8. If the output still looks Spanish when English exists = failure.

JSON:
{
  "palabras_en": ["string","string","string","string"],
  "frases_en": ["emoji string","emoji string","emoji string","emoji string"]
}

SOLO JSON.`;

    case "tarjeta":
      return base + `
═══════════════════════════════════════════════════════════════
🎯 GENERAR: Tarjeta profundización "${libro.titulo}"
═══════════════════════════════════════════════════════════════

Journey previo:
Emociones: ${cleanJoin(palabras)}
Acciones:
${frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Genera SOLO 4 líneas:
1. Título único del libro
2. Párrafo top con [H]...[/H]
3. Subtítulo sin [H]
4. Párrafo bot con [H]...[/H] y tiempo explícito

Prohibido:
- primera persona
- frases genéricas
- subtítulos truncados
- cierres genéricos

SOLO 4 LÍNEAS.`;

    case "tarjeta_en":
      return base + `
═══════════════════════════════════════════════════════════════
🎯 GENERATE: English editorial card for "${String(extraSafe.titulo_en || libro.titulo).trim()}"
═══════════════════════════════════════════════════════════════

English journey:
Emotions: ${cleanJoin(palabrasEn.length ? palabrasEn : palabras)}
Actions:
${(frasesEn.length ? frasesEn : frases).map((f, i) => `${i + 1}. ${f}`).join("\n")}

Generate ONLY 4 clean lines:
1. Unique title for this specific book
2. Top paragraph with [H]...[/H]
3. Subtitle without [H]
4. Bottom paragraph with [H]...[/H] and explicit time

Forbidden:
- first person
- generic summaries
- dangling subtitles
- generic endings
- translationese

ONLY 4 LINES.`;

    case "estilo":
      return base + `
═══════════════════════════════════════════════════════════════
🎯 GENERAR: Estilo visual para tarjeta "${libro.titulo}"
═══════════════════════════════════════════════════════════════

Devuelve SOLO JSON:
{
  "accent": "#hex",
  "ink": "#hex",
  "paper": "#hex",
  "border": "#hex"
}

paper debe ser oscuro. ink debe ser claro. SOLO JSON.`;

    default:
      throw new Error(`Tipo de prompt no soportado: ${tipo}`);
  }
}

async function buildTarjetaMessages(libro, ctx, extra = null) {
  const legacySystem = buildPrompt(libro, "tarjeta", ctx, extra);

  if (!CFG.prompts.useExternalEditorial) {
    return { system: legacySystem, user: "Genera la tarjeta editorial.", source: "legacy" };
  }

  const artifacts = await loadEditorialPromptArtifacts();
  if (!artifacts.available) {
    if (!promptState.warnedFallback) {
      console.log(`   ⚠️  Prompt externo no disponible. Fallback legacy: ${artifacts.error}`);
      promptState.warnedFallback = true;
    }
    return { system: legacySystem, user: "Genera la tarjeta editorial.", source: "legacy-fallback" };
  }

  const ideaSemilla = normalizeArrayStrings(extra?.frases, CFG.frases.cantidad).length
    ? normalizeArrayStrings(extra?.frases, CFG.frases.cantidad).join(" | ")
    : (libro.tagline || libro.titulo || "");

  const variables = {
    "${libro.titulo}": libro.titulo || "",
    "${libro.autor}": libro.autor || "",
    "${libro.tagline}": libro.tagline || "",
    "${ctx.dia}": ctx.dia || "",
    "${ctx.hora}": String(ctx.hora ?? ""),
    "${ctx.energia}": `${Math.round((ctx.energia || 0) * 100)}%`,
    "${ctx.hawkins}": `${ctx.hawkinsDinamico?.[0] ?? ""}-${ctx.hawkinsDinamico?.[1] ?? ""}`,
    "${idea_semilla}": ideaSemilla,
    "${palabras_prohibidas}": cleanJoin([...state.palabras]),
    "${libro.contexto_2026?.aplicacion_badir_hoy ?? ''}": libro?.contexto_2026?.aplicacion_badir_hoy || "",
    "${lente_activo ?? ''}": libro?.lente_activo || ""
  };

  return {
    system: [artifacts.systemSection, "CONSTITUCIÓN EDITORIAL DE TRIGGUI:", artifacts.constitution].join("\n\n").trim(),
    user: renderPromptTemplate(artifacts.userSection, variables),
    source: "external"
  };
}

const VERIFICADOR = {
  main(data) {
    const checks = {
      tienePalabras: Array.isArray(data.palabras) && data.palabras.length === CFG.palabras.cantidad,
      palabrasNoVacias: Array.isArray(data.palabras) && data.palabras.every((p) => String(p || "").trim().length > 2),
      tieneFrases: Array.isArray(data.frases) && data.frases.length === CFG.frases.cantidad,
      frasesConEmoji: Array.isArray(data.frases) && data.frases.every((f) => /[\p{Emoji}]/u.test(String(f || ""))),
      tieneColores: Array.isArray(data.colores) && data.colores.length === CFG.colores.cantidad,
      coloresHex: Array.isArray(data.colores) && data.colores.every((c) => /^#[0-9a-f]{6}$/i.test(String(c || ""))),
      tieneFondo: typeof data.fondo === "string" && /^#[0-9a-f]{6}$/i.test(data.fondo),
      fondoOscuro: typeof data.fondo === "string" && utils.lum(data.fondo) < CFG.darkMode.lumThresholdPaper
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { score: ok / total, checks, nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO", aprobado: ok / total >= CFG.verification.minScore };
  },

  bibliografia(data, libro, auditoria = null) {
    const safe = normalizeBibliografiaData(data, libro);
    const baseTitle = String(libro?.titulo || "").trim();
    const checks = {
      tieneTituloEn: safe.titulo_en.length > 2,
      tieneTituloEs: safe.titulo_es.length > 2,
      idiomaValido: /^(es|en)$/.test(safe.idioma_original),
      anclaConFuente: sharedTokenCount(baseTitle, safe.titulo_es) >= 1 || sharedTokenCount(baseTitle, safe.titulo_en) >= 1 || normalizeAscii(baseTitle) === normalizeAscii(safe.titulo_es) || normalizeAscii(baseTitle) === normalizeAscii(safe.titulo_en),
      auditoriaMismoLibro: auditoria ? auditoria.same_work === true : true,
      auditoriaNoRiesgoAlto: auditoria ? auditoria.risk !== "high" : true
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { score: ok / total, checks, safe, nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO", aprobado: ok / total >= CFG.verification.minScore };
  },

  activadores_en(data, extra) {
    const palabras_en = normalizeArrayStrings(data?.palabras_en, CFG.palabras.cantidad);
    const frases_en = normalizeArrayStrings(data?.frases_en, CFG.frases.cantidad);
    const palabras_es = normalizeArrayStrings(extra?.palabras, CFG.palabras.cantidad);
    const frases_es = normalizeArrayStrings(extra?.frases, CFG.frases.cantidad);
    const englishPhraseHits = frases_en.filter((f) => hasLikelyEnglishSignals(f) && !hasLikelySpanishSignals(f)).length;
    const englishWordHits = palabras_en.filter((w) => !hasLikelySpanishSignals(w) || hasLikelyEnglishSignals(w)).length;
    const checks = {
      tienePalabrasEn: palabras_en.length === CFG.palabras.cantidad,
      tieneFrasesEn: frases_en.length === CFG.frases.cantidad,
      frasesConEmoji: frases_en.every((f) => /[\p{Emoji}]/u.test(String(f || ""))),
      palabrasNoCopianES: countEqualNormalized(palabras_en, palabras_es) <= 1,
      frasesNoCopianES: countEqualNormalized(frases_en, frases_es) === 0,
      frasesParecenIngles: englishPhraseHits >= 3,
      palabrasParecenIngles: englishWordHits >= 3,
      sinPuntuacionInvertida: frases_en.every((f) => !/[¿¡]/.test(String(f || "")))
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { score: ok / total, checks, safe: { palabras_en, frases_en }, nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO", aprobado: ok / total >= CFG.verification.minScore };
  },

  tarjeta(tarjeta) {
    const safe = normalizeTarjetaObject(tarjeta, "es");
    const topPlain = stripHighlightTags(safe.parrafoTop).trim();
    const botPlain = stripHighlightTags(safe.parrafoBot).trim();
    const totalH = countHighlights(`${safe.parrafoTop}\n${safe.parrafoBot}`);
    const allText = [safe.titulo, safe.parrafoTop, safe.subtitulo, safe.parrafoBot].join("\n");
    const checks = {
      tituloOk: safe.titulo.length >= 8,
      subtituloOk: safe.subtitulo.length >= 6 && countHighlights(safe.subtitulo) === 0 && !endsWithDanglingConnector(safe.subtitulo, "es"),
      parrafoTopRico: topPlain.length >= 40,
      parrafoBotRico: botPlain.length >= 40,
      sinMetadata: !/(^|\n)\s*(título|parrafo|párrafo|subtítulo|accion|acción)\s*[:\-]/i.test(allText),
      sinPrimeraPersona: !/\b(yo|mi|me|conmigo|nosotros|nuestro|aprendí|descubrí|sentí|pienso|creo)\b/i.test(allText),
      highlightsMinimos: totalH >= CFG.tarjeta.minHighlights,
      highlightTop: countHighlights(safe.parrafoTop) >= 1,
      highlightBot: countHighlights(safe.parrafoBot) >= 1,
      accionReal: /\b(15|20|30|40|45|60)\b|\b(seg|segundos|min|minutos|instante|momento|ahora|hoy)\b/i.test(botPlain),
      sinCierreGenerico: !hasGenericClosing(botPlain, "es")
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { score: ok / total, checks, nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO", aprobado: ok / total >= CFG.verification.minScore };
  },

  tarjeta_en(tarjeta) {
    const safe = normalizeTarjetaObject(tarjeta, "en");
    const topPlain = stripHighlightTags(safe.parrafoTop).trim();
    const botPlain = stripHighlightTags(safe.parrafoBot).trim();
    const totalH = countHighlights(`${safe.parrafoTop}\n${safe.parrafoBot}`);
    const allText = [safe.titulo, safe.parrafoTop, safe.subtitulo, safe.parrafoBot].join("\n");
    const checks = {
      tituloOk: safe.titulo.length >= 8,
      subtituloOk: safe.subtitulo.length >= 6 && countHighlights(safe.subtitulo) === 0 && !endsWithDanglingConnector(safe.subtitulo, "en"),
      parrafoTopRico: topPlain.length >= 40,
      parrafoBotRico: botPlain.length >= 40,
      sinMetadata: !/(^|\n)\s*(title|paragraph|subtitle|action)\s*[:\-]/i.test(allText),
      sinPrimeraPersona: !/\b(I|my|me|myself|we|our|ours|ourselves|learned|discovered|felt|think|believe|I'm|I've|I'll|we're|we've)\b/i.test(allText),
      sinMetaReferencias: !/(according to the book|reminds us|invites us to|reflects on|deals with|talks about|proposes|shows us|allows us)/i.test(allText),
      highlightsMinimos: totalH >= CFG.tarjeta.minHighlights,
      highlightTop: countHighlights(safe.parrafoTop) >= 1,
      highlightBot: countHighlights(safe.parrafoBot) >= 1,
      accionReal: /\b(15|20|30|40|45|60)\b|\b(sec|seconds|min|minutes|moment|now|today)\b/i.test(botPlain),
      sinCierreGenerico: !hasGenericClosing(botPlain, "en")
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { score: ok / total, checks, nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO", aprobado: ok / total >= CFG.verification.minScore };
  },

  estilo(data) {
    const checks = {
      accent: typeof data.accent === "string" && /^#[0-9a-f]{6}$/i.test(data.accent),
      ink: typeof data.ink === "string" && /^#[0-9a-f]{6}$/i.test(data.ink),
      paper: typeof data.paper === "string" && /^#[0-9a-f]{6}$/i.test(data.paper),
      border: typeof data.border === "string" && /^#[0-9a-f]{6}$/i.test(data.border),
      paperOscuro: typeof data.paper === "string" && utils.lum(data.paper) < CFG.darkMode.lumThresholdPaper,
      inkClaro: typeof data.ink === "string" && utils.lum(data.ink) > CFG.darkMode.lumThresholdInk
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { score: ok / total, checks, nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO", aprobado: ok / total >= CFG.verification.minScore };
  }
};

async function call(sys, usr, temp, forceJSON = false) {
  const config = {
    model: CFG.model,
    temperature: temp,
    top_p: CFG.top_p,
    presence_penalty: CFG.presence,
    frequency_penalty: CFG.frequency,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ]
  };
  if (forceJSON) config.response_format = { type: "json_object" };
  const chat = await openai.chat.completions.create(config);
  return chat.choices[0].message.content;
}

function parseTarjetaLines(raw) {
  const lines = String(raw || "")
    .replace(/@@BODY|@@ENDBODY/g, "")
    .trim()
    .split(/\n+/)
    .map((l) => l
      .replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]|\[línea.*?\]/gi, "")
      .replace(/^(TÍTULO|PÁRRAFO\s*\d*|SUBTÍTULO|ACCIÓN)[:.\s-]*/gi, "")
      .replace(/^(Title|Paragraph\s*\d*|Subtitle|Action)[:.\s-]*/gi, "")
      .replace(/^\d+[\)\.]\s*/g, "")
      .replace(/^\*{1,3}|\*{1,3}$/g, "")
      .replace(/^_{1,3}|_{1,3}$/g, "")
      .trim())
    .filter((l) => l.length > CFG.tarjeta.longitudMinLinea);

  return {
    titulo: lines[0] || "",
    parrafoTop: lines[1] || "",
    subtitulo: lines[2] || "",
    parrafoBot: lines.slice(3).join(" ").trim()
  };
}

function defaultStyle() {
  return {
    accent: "#ff6b6b",
    ink: CFG.darkMode.inkMax,
    paper: CFG.darkMode.paperMin,
    border: "#333333"
  };
}

function listFailedChecks(validation) {
  return Object.entries(validation?.checks || {}).filter(([, ok]) => !ok).map(([key]) => key);
}

function stripMetadataNoise(text = "") {
  return String(text || "")
    .replace(/^(title|paragraph|subtitle|action|line\s*\d+|línea\s*\d+|título|párrafo|subtítulo|acción)\s*[:\-–—.]*/i, "")
    .replace(/^\s*[\[\(].*?[\]\)]\s*/g, "")
    .trim();
}

function stripFirstPerson(text = "", lang = "es") {
  const value = String(text || "");
  if (lang === "en") {
    return value
      .replace(/\b(I|my|me|myself|we|our|ours|ourselves)\b/gi, "")
      .replace(/\b(I'm|I've|I'll|we're|we've|we'll)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return value
    .replace(/\b(yo|mi|mí|me|conmigo|nosotros|nosotras|nuestro|nuestra|nuestros|nuestras)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function seedFromBook(libro, lang = "es") {
  const raw = sanitizeTitleText(String(libro?.titulo || "").trim()) || (lang === "en" ? "this book" : "este libro");
  const cleaned = raw.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return lang === "en" ? "this book" : "este libro";
  const words = cleaned.split(" ").slice(0, 5);
  return words.join(" ");
}

function strongTopParagraph(libro, extra, lang = "es") {
  const seed = seedFromBook(libro, lang);
  if (lang === "en") {
    return `[H]${seed} forces a more exact way of seeing what matters before reacting on impulse.[/H] That shift turns attention into a usable decision instead of noise.`;
  }
  return `[H]${seed} obliga a mirar con más precisión lo que importa antes de reaccionar por impulso.[/H] Ese giro convierte la atención en una decisión utilizable y no en ruido.`;
}

function strongBottomParagraph(libro, extra, lang = "es") {
  const actionSource = normalizeArrayStrings(lang === "en" ? extra?.frases_en : extra?.frases, CFG.frases.cantidad)[0] || "";
  if (lang === "en") {
    const base = actionSource && hasLikelyEnglishSignals(actionSource) ? stripHighlightTags(actionSource) : "spend 30 seconds writing one concrete line about what you will do next";
    return `After the first signal from this book, [H]${base.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\.$/, "")} in 30 seconds.[/H] Do it now with calm focus.`;
  }
  const base = actionSource ? stripHighlightTags(actionSource) : "dedica 30 segundos a escribir una línea concreta sobre lo que harás después";
  return `Después de la primera señal de este libro, [H]${base.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\.$/, "")} en 30 segundos.[/H] Hazlo ahora con calma y precisión.`;
}

function strongSubtitle(libro, lang = "es") {
  const seed = seedFromBook(libro, lang);
  if (lang === "en") return `What changes when ${seed.toLowerCase()} is practiced today?`;
  return `¿Qué cambia cuando ${seed.toLowerCase()} se practica hoy?`;
}

function strongTitle(libro, lang = "es") {
  const seed = seedFromBook(libro, lang);
  if (lang === "en") return sanitizeTitleText(`Precise use of ${seed}`);
  return sanitizeTitleText(`Uso preciso de ${seed}`);
}

function ensureSingleHighlight(text = "", lang = "es") {
  let plain = stripHighlightTags(text).trim();
  if (!plain) plain = lang === "en" ? "Take one exact action now." : "Toma una acción exacta ahora.";
  if (countHighlights(text) >= 1) return normalizeHighlightSyntax(text);
  return normalizeHighlightSyntax(`[H]${plain}[/H]`);
}

function coerceTarjetaDeterministic(tarjeta, libro, extra, lang = "es", failedChecks = []) {
  let out = normalizeTarjetaObject(tarjeta || {}, lang);

  out.titulo = sanitizeTitleText(stripMetadataNoise(out.titulo));
  out.subtitulo = sanitizeSubtitleText(stripMetadataNoise(out.subtitulo), lang);
  out.parrafoTop = normalizeHighlightSyntax(stripMetadataNoise(out.parrafoTop));
  out.parrafoBot = normalizeHighlightSyntax(stripMetadataNoise(out.parrafoBot));

  if (failedChecks.includes("sinPrimeraPersona")) {
    out.titulo = stripFirstPerson(out.titulo, lang);
    out.subtitulo = stripFirstPerson(out.subtitulo, lang);
    out.parrafoTop = stripFirstPerson(out.parrafoTop, lang);
    out.parrafoBot = stripFirstPerson(out.parrafoBot, lang);
  }

  if (!out.titulo || out.titulo.length < 8) {
    out.titulo = strongTitle(libro, lang);
  }

  if (!out.parrafoTop || stripHighlightTags(out.parrafoTop).trim().length < 40) {
    out.parrafoTop = strongTopParagraph(libro, extra, lang);
  }

  if (!out.subtitulo || out.subtitulo.length < 6 || endsWithDanglingConnector(out.subtitulo, lang)) {
    out.subtitulo = strongSubtitle(libro, lang);
  }

  if (!out.parrafoBot || stripHighlightTags(out.parrafoBot).trim().length < 40 || hasGenericClosing(out.parrafoBot, lang)) {
    out.parrafoBot = strongBottomParagraph(libro, extra, lang);
  }

  out.parrafoTop = ensureSingleHighlight(out.parrafoTop, lang);
  out.parrafoBot = ensureSingleHighlight(out.parrafoBot, lang);

  if (countHighlights(`${out.parrafoTop}\n${out.parrafoBot}`) < CFG.tarjeta.minHighlights) {
    out.parrafoTop = ensureMinimumHighlights(out.parrafoTop, 1);
    out.parrafoBot = ensureMinimumHighlights(out.parrafoBot, 1);
  }

  if (lang === "en" && !/\b(15|20|30|40|45|60)\b|\b(sec|seconds|min|minutes|moment|now|today)\b/i.test(stripHighlightTags(out.parrafoBot))) {
    out.parrafoBot = normalizeHighlightSyntax(`${stripHighlightTags(out.parrafoBot).replace(/\.$/, "")} [H]Take 30 seconds to write one concrete next step now.[/H]`);
  }

  if (lang === "es" && !/\b(15|20|30|40|45|60)\b|\b(seg|segundos|min|minutos|instante|momento|ahora|hoy)\b/i.test(stripHighlightTags(out.parrafoBot))) {
    out.parrafoBot = normalizeHighlightSyntax(`${stripHighlightTags(out.parrafoBot).replace(/\.$/, "")} [H]Dedica 30 segundos a escribir un siguiente paso concreto ahora.[/H]`);
  }

  out = normalizeTarjetaObject(out, lang);

  if (tooSimilarText(out.parrafoTop, out.parrafoBot)) {
    out.parrafoBot = strongBottomParagraph(libro, extra, lang);
    out.parrafoBot = ensureMinimumHighlights(out.parrafoBot, 1);
    out = normalizeTarjetaObject(out, lang);
  }

  return out;
}

function buildRepairPromptTarjeta(libro, extra, candidate, failedChecks, lang = "es") {
  const checksText = failedChecks.join(", ");
  const journeyWords = cleanJoin(lang === "en" ? (extra?.palabras_en || extra?.palabras || []) : (extra?.palabras || []));
  const journeyPhrases = normalizeArrayStrings(lang === "en" ? (extra?.frases_en || extra?.frases || []) : (extra?.frases || []), CFG.frases.cantidad)
    .map((f, i) => `${i + 1}. ${f}`)
    .join("\n");
  if (lang === "en") {
    return `Repair this English editorial card for "${extra?.titulo_en || libro.titulo}" by "${libro.autor}".

Failed checks: ${checksText}

Current card:
1. ${candidate.titulo}
2. ${candidate.parrafoTop}
3. ${candidate.subtitulo}
4. ${candidate.parrafoBot}

English journey:
Emotions: ${journeyWords}
Actions:
${journeyPhrases}

You must fix ONLY what failed:
- subtitle must not be truncated or end in a dangling connector
- bottom paragraph must be rich, specific, highlighted, and include an explicit time
- keep exactly 4 clean lines
- no metadata labels
- no first person
- no generic closing
- at least one [H]...[/H] in top and bottom

Return ONLY 4 lines.`;
  }
  return `Repara esta tarjeta editorial en español para "${libro.titulo}" de "${libro.autor}".

Checks fallidos: ${checksText}

Tarjeta actual:
1. ${candidate.titulo}
2. ${candidate.parrafoTop}
3. ${candidate.subtitulo}
4. ${candidate.parrafoBot}

Journey:
Emociones: ${journeyWords}
Acciones:
${journeyPhrases}

Debes corregir SOLO lo que falló:
- el subtítulo no debe quedar truncado ni colgar de una preposición
- el párrafo inferior debe ser rico, específico, con highlight y tiempo explícito
- conserva exactamente 4 líneas limpias
- sin labels ni metadata
- sin primera persona
- sin cierre genérico
- al menos un [H]...[/H] en top y en bot

Devuelve SOLO 4 líneas.`;
}

async function generateTarjetaWithRepair({ libro, ctx, extra, lang = "es", external = true }) {
  const verify = lang === "en" ? VERIFICADOR.tarjeta_en : VERIFICADOR.tarjeta;
  let candidate = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt === 0) {
      if (lang === "es") {
        const tarjetaMsg = await buildTarjetaMessages(libro, ctx, extra);
        let raw = await call(tarjetaMsg.system, tarjetaMsg.user, ctx.tempDinamica, false);
        raw = String(raw || "").replace(/@@BODY|@@ENDBODY/g, "").trim();
        candidate = normalizeTarjetaObject(parseTarjetaLines(raw), "es");
      } else {
        let raw = await call(buildPrompt(libro, "tarjeta_en", ctx, extra), "Generate the English editorial card.", ctx.tempDinamica, false);
        raw = String(raw || "").replace(/@@BODY|@@ENDBODY/g, "").trim();
        candidate = normalizeTarjetaObject(parseTarjetaLines(raw), "en");
      }
    } else {
      const currentValidation = verify(candidate);
      const failedChecks = listFailedChecks(currentValidation);
      candidate = coerceTarjetaDeterministic(candidate, libro, extra, lang, failedChecks);
      const afterCoerce = verify(candidate);
      if (afterCoerce.aprobado) return candidate;

      const repairPrompt = buildRepairPromptTarjeta(libro, extra, candidate, failedChecks, lang);
      let raw = await call(
        lang === "en" ? buildPrompt(libro, "tarjeta_en", ctx, extra) : buildPrompt(libro, "tarjeta", ctx, extra),
        repairPrompt,
        0.55,
        false
      );
      raw = String(raw || "").replace(/@@BODY|@@ENDBODY/g, "").trim();
      candidate = normalizeTarjetaObject(parseTarjetaLines(raw), lang);
    }

    const validation = verify(candidate);
    if (validation.aprobado) return candidate;
    if (CFG.verification.logLowScore) {
      console.log(`   ⚠️  Verificación tarjeta${lang === "en" ? " EN" : ""}: ${validation.nivel} (${(validation.score * 100).toFixed(0)}%)`);
      console.log("      Checks fallidos:", listFailedChecks(validation));
    }
  }

  candidate = coerceTarjetaDeterministic(candidate, libro, extra, lang, [
    "tituloOk","subtituloOk","parrafoTopRico","parrafoBotRico","highlightsMinimos","highlightTop","highlightBot","accionReal","sinCierreGenerico"
  ]);
  return candidate;
}

async function enrich(libro, ctx) {
  let intento = 0;

  while (intento <= CFG.processing.maxRetries) {
    try {
      console.log("   [1/6] JSON principal...");
      const rawMain = await call(buildPrompt(libro, "main", ctx), "Genera JSON", ctx.tempDinamica, true);
      let extra = JSON.parse(rawMain);

      if (CFG.verification.enabled) {
        const v = VERIFICADOR.main(extra);
        if (CFG.verification.logLowScore && v.score < 0.8) {
          console.log(`   ⚠️  Verificación main: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(v.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
        if (CFG.verification.retryIfLowScore && !v.aprobado) throw new Error(`Verificación main falló: score ${v.score.toFixed(2)}`);
      }

      if (!Array.isArray(extra?.frases) || !Array.isArray(extra?.palabras) || !Array.isArray(extra?.colores)) {
        throw new Error("Respuesta main incompleta");
      }

      const repetidas = extra.palabras.filter((p) => state.palabras.has(String(p).toLowerCase()));
      if (repetidas.length > 0) {
        console.log(`   ⚠️  Repetidas: ${repetidas.join(", ")}, regenerando...`);
        const rawRetry = await call(buildPrompt(libro, "main", ctx), "Palabras únicas", ctx.tempDinamica, true);
        extra = JSON.parse(rawRetry);
      }

      while (safeArray(extra.palabras).length < CFG.palabras.cantidad) extra.palabras.push(extra.palabras[extra.palabras.length - 1]);
      while (safeArray(extra.frases).length < CFG.frases.cantidad) extra.frases.push(extra.frases[extra.frases.length - 1]);
      while (safeArray(extra.colores).length < CFG.colores.cantidad) extra.colores.push(extra.colores[extra.colores.length - 1]);
      extra.textColors = extra.colores.map(utils.txt);

      extra.palabras.forEach((p) => state.palabras.add(String(p).toLowerCase()));
      extra.colores.forEach((c) => state.colores.add(String(c).toLowerCase()));

      console.log("   [1.5/6] Bibliografía bilingüe...");
      const rawBiblio = await call(buildPrompt(libro, "bibliografia", ctx), "Resuelve metadata bibliográfica bilingüe.", ctx.bibliografiaTemp, true);
      const bibliografia = normalizeBibliografiaData(JSON.parse(rawBiblio), libro);

      console.log("   [1.6/6] Auditoría bibliográfica...");
      const rawAudit = await call(buildPrompt(libro, "bibliografia_auditor", ctx, bibliografia), "Audita si la propuesta corresponde exactamente al mismo libro.", 0.2, true);
      const auditoria = JSON.parse(rawAudit);

      if (CFG.verification.enabled) {
        const vB = VERIFICADOR.bibliografia(bibliografia, libro, auditoria);
        if (CFG.verification.logLowScore && vB.score < 0.8) {
          console.log(`   ⚠️  Verificación bibliografía: ${vB.nivel} (${(vB.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(vB.checks).filter(([, ok]) => !ok).map(([k]) => k));
          if (auditoria?.reason) console.log(`      Auditoría: ${auditoria.reason}`);
        }
        if (CFG.verification.retryIfLowScore && !vB.aprobado) throw new Error(`Verificación bibliografía falló: score ${vB.score.toFixed(2)}`);
      }

      extra = { ...extra, ...bibliografia };

      console.log("   [1.7/6] Activadores EN...");
      const rawEN = await call(buildPrompt(libro, "activadores_en", ctx, extra), "Generate native English activators.", 0.45, true);
      const activadoresEN = JSON.parse(rawEN);

      if (CFG.verification.enabled) {
        const vAEN = VERIFICADOR.activadores_en(activadoresEN, extra);
        if (CFG.verification.logLowScore && vAEN.score < 0.8) {
          console.log(`   ⚠️  Verificación activadores EN: ${vAEN.nivel} (${(vAEN.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(vAEN.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
        if (CFG.verification.retryIfLowScore && !vAEN.aprobado) throw new Error(`Verificación activadores EN falló: score ${vAEN.score.toFixed(2)}`);
        extra = { ...extra, ...vAEN.safe };
      } else {
        extra = {
          ...extra,
          palabras_en: normalizeArrayStrings(activadoresEN.palabras_en, CFG.palabras.cantidad),
          frases_en: normalizeArrayStrings(activadoresEN.frases_en, CFG.frases.cantidad)
        };
      }

      console.log("   [2/6] Tarjeta...");
      let tarjeta = await generateTarjetaWithRepair({ libro, ctx, extra, lang: "es" });
      const vTFinal = VERIFICADOR.tarjeta(tarjeta);
      if (!vTFinal.aprobado) {
        throw new Error(`Tarjeta ES no alcanzó verificación después de reparación: score ${vTFinal.score.toFixed(2)}`);
      }

      console.log("   [2.5/6] Tarjeta EN...");
      let tarjeta_en = await generateTarjetaWithRepair({ libro, ctx, extra, lang: "en" });
      const vTENFinal = VERIFICADOR.tarjeta_en(tarjeta_en);
      if (!vTENFinal.aprobado) {
        throw new Error(`Tarjeta EN no alcanzó verificación después de reparación: score ${vTENFinal.score.toFixed(2)}`);
      }

      console.log("   [3/6] Style...");
      let rawE = await call(buildPrompt(libro, "estilo", ctx), "Genera estilo", ctx.tempDinamica, false);
      rawE = String(rawE || "").replace(/@@STYLE|@@ENDSTYLE/g, "").trim();
      let style;
      try {
        style = JSON.parse(utils.cleanJSON(rawE));
        if (style.paper && utils.lum(style.paper) > CFG.darkMode.lumThresholdPaper) style.paper = CFG.darkMode.paperMin;
        if (style.ink && utils.lum(style.ink) < CFG.darkMode.lumThresholdInk) style.ink = CFG.darkMode.inkMax;
      } catch {
        style = defaultStyle();
      }

      tarjeta.style = style;
      if (tarjeta_en) tarjeta_en.style = style;

      console.log("   ✅ Completado");
      return {
        ...libro,
        ...extra,
        portada: String(libro.portada || libro.portada_url || "").trim() || `📚 ${libro.titulo}\n${libro.autor}`,
        tarjeta,
        tarjeta_base: tarjeta,
        tarjeta_presentacion: tarjeta,
        ...(tarjeta_en ? {
          tarjeta_en: { ...tarjeta_en, style },
          tarjeta_base_en: { ...tarjeta_en, style },
          tarjeta_presentacion_en: { ...tarjeta_en, style }
        } : {}),
        videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${libro.titulo} ${libro.autor} entrevista español`)}`,
        videoUrl_en: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${extra.titulo_en || libro.titulo} ${libro.autor} interview`)}`
      };
    } catch (error) {
      intento += 1;
      console.log(`   ❌ Error (${intento}/${CFG.processing.maxRetries + 1}): ${error.message}`);
      if (intento <= CFG.processing.maxRetries) {
        await sleep(CFG.processing.retrySleepMs);
        continue;
      }
      console.log("   🛡️  Fallback mínimo (sin editorial — marcado para exclusión)");
      break;
    }
  }

  return {
    ...libro,
    dimension: "",
    punto: "",
    palabras: [],
    frases: [],
    colores: ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"],
    textColors: ["#FFFFFF", "#000000", "#000000", "#FFFFFF"],
    fondo: "#0a0a0a",
    portada: libro.portada || `📚 ${libro.titulo}`,
    tarjeta: { titulo: "", parrafoTop: "", subtitulo: "", parrafoBot: "", style: defaultStyle() },
    tarjeta_base: { titulo: "", parrafoTop: "", subtitulo: "", parrafoBot: "", style: defaultStyle() },
    tarjeta_presentacion: { titulo: "", parrafoTop: "", subtitulo: "", parrafoBot: "", style: defaultStyle() },
    _fallback: true,
    _error: `Falló después de ${CFG.processing.maxRetries + 1} intentos`,
    videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(libro.titulo || "")}`
  };
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; }
  catch { return false; }
}

async function loadCSVBooks() {
  const raw = await fs.readFile(CFG.files.csv, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  return rows.map((row) => ({
    titulo: String(row.titulo || row.Titulo || row.title || "").trim(),
    autor: String(row.autor || row.Autor || row.author || "").trim(),
    tagline: String(row.tagline || row.Tagline || "").trim(),
    portada: String(row.portada || row.portada_url || "").trim(),
    portada_url: String(row.portada_url || row.portada || "").trim(),
    isbn: String(row.isbn || row.ISBN || "").trim(),
    contexto_2026: {},
    lente_activo: ""
  })).filter((row) => row.titulo && row.autor);
}

async function loadSingleBookSource() {
  if (await fileExists(CFG.files.tmpBook)) return JSON.parse(await fs.readFile(CFG.files.tmpBook, "utf8"));
  if (process.env.SINGLE_BOOK) return JSON.parse(process.env.SINGLE_BOOK);
  return null;
}

function mapSingleBookMeta(bookMeta) {
  return {
    titulo: String(bookMeta.titulo || "").trim(),
    autor: String(bookMeta.autor || "").trim(),
    tagline: String(bookMeta.tagline || "").trim(),
    portada: String(bookMeta.portada_url || bookMeta.portada || "").trim(),
    portada_url: String(bookMeta.portada_url || bookMeta.portada || "").trim(),
    portada_source: String(bookMeta.portada_source || bookMeta.source || "").trim(),
    isbn: String(bookMeta.isbn || "").trim(),
    slug: String(bookMeta.slug || "").trim(),
    contexto_2026: bookMeta.contexto_2026 || {},
    lente_activo: bookMeta.lente_activo || ""
  };
}

async function writeJSON(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function writeSingleOutputs(bookMeta, enriched) {
  await writeJSON(CFG.files.outSingle, { libros: [enriched] });

  let batchPayload = { libros: [] };
  if (await fileExists(CFG.files.outBatch)) {
    try {
      batchPayload = JSON.parse(await fs.readFile(CFG.files.outBatch, "utf8"));
      if (!Array.isArray(batchPayload.libros)) batchPayload.libros = [];
    } catch {
      batchPayload = { libros: [] };
    }
  }

  const key = utils.uniqueKey(enriched);
  const rest = batchPayload.libros.filter((l) => utils.uniqueKey(l) !== key);
  const merged = enriched._fallback ? rest.slice(0, CFG.processing.maxBatch) : [enriched, ...rest].slice(0, CFG.processing.maxBatch);

  await writeJSON(CFG.files.outBatch, { libros: merged });

  console.log(`\n✅ Modo SINGLE completado`);
  if (enriched._fallback) console.log(`🛡️  ${CFG.files.outBatch} preservado — fallback de "${bookMeta.titulo}" NO insertado`);
  else console.log(`📚 ${CFG.files.outBatch} actualizado — "${bookMeta.titulo}" en posición [0]`);
  console.log(`🧾 ${CFG.files.outSingle} actualizado — carril canónico single-book`);
}

async function writeBatchOutput(libros) {
  const exitosos = libros.filter((l) => !l._fallback);
  const fallidos = libros.filter((l) => l._fallback);

  if (fallidos.length > 0) {
    console.log(`\n⚠️  ${fallidos.length} libro(s) excluidos por fallback:`);
    fallidos.forEach((l) => console.log(`   → ${l.titulo} — ${l._error}`));
  }

  await writeJSON(CFG.files.outBatch, { libros: exitosos });

  console.log(`\n✅ Modo BATCH completado`);
  console.log(`📚 ${CFG.files.outBatch} — ${exitosos.length} libros nivel dios`);
  if (fallidos.length > 0) console.log(`🛡️  ${fallidos.length} excluidos (no se publica mediocridad)`);
}

async function runSingle(ctx) {
  const singleSource = await loadSingleBookSource();
  if (!singleSource) throw new Error("SINGLE_MODE activo pero no existe /tmp/triggui-book.json ni SINGLE_BOOK");
  const bookMeta = mapSingleBookMeta(singleSource);
  if (!bookMeta.titulo || !bookMeta.autor) throw new Error("Libro single inválido: faltan título o autor");

  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  TRIGGUI v9.7.4 — MODO SINGLE NIVEL DIOS     ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log(`📖 ${bookMeta.titulo} — ${bookMeta.autor}`);
  console.log(`🤖 ${CFG.model} | 🌡️  ${ctx.tempDinamica.toFixed(2)}`);
  console.log(`📊 Energía: ${Math.round(ctx.energia * 100)}% | Hawkins: ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}`);
  console.log(`🧾 Prompt: ${CFG.prompts.useExternalEditorial ? "EXTERNAL" : "LEGACY NIVEL DIOS"}`);
  console.log(`✅ Verificación: ON | Umbral: ${(CFG.verification.minScore * 100).toFixed(0)}%`);
  console.log(`🎲 Random: crypto.randomInt\n`);

  const enriched = await enrich(bookMeta, ctx);
  if (enriched._fallback) {
    console.log(`\n⚠️  SINGLE falló — "${bookMeta.titulo}" no pasó verificación después de ${CFG.processing.maxRetries + 1} intentos`);
    await writeSingleOutputs(bookMeta, enriched);
    console.log(`🛑 Pipeline detenido — no se genera edición viva con contenido fallback`);
    process.exit(1);
  }
  await writeSingleOutputs(bookMeta, enriched);
}

async function runBatch(ctx) {
  const books = await loadCSVBooks();
  const selected = utils.shuffle(books).slice(0, Math.min(CFG.processing.maxBatch, books.length));

  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   TRIGGUI v9.7.4 — MODO BATCH NIVEL DIOS     ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log(`📅 ${new Date().toLocaleDateString("es-MX", { dateStyle: "full" })}`);
  console.log(`⏰ ${new Date().toLocaleTimeString("es-MX")}`);
  console.log(`📚 Fuente: ${CFG.files.csv} (${books.length} libros)`);
  console.log(`📦 Selección random: ${selected.length} de ${books.length}`);
  console.log(`🤖 ${CFG.model} | 🌡️  ${ctx.tempDinamica.toFixed(2)} (${ctx.dia})`);
  console.log(`📊 Energía: ${Math.round(ctx.energia * 100)}% | Hawkins: ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}`);
  console.log(`✅ Verificación: ON | Umbral: ${(CFG.verification.minScore * 100).toFixed(0)}%`);
  console.log(`🎲 Random: crypto.randomInt (Fisher-Yates)\n`);

  const out = [];
  for (let i = 0; i < selected.length; i += 1) {
    const libro = selected[i];
    console.log(`\n📖 [${i + 1}/${selected.length}] ${libro.titulo} — ${libro.autor}`);
    const enriched = await enrich(libro, ctx);
    out.push(enriched);
    if ((i + 1) % CFG.processing.resetMemoryEvery === 0 && i < selected.length - 1) {
      console.log(`   🔄 Reset memoria (${state.palabras.size}p, ${state.colores.size}c)`);
      state.palabras.clear();
      state.colores.clear();
    }
    if (i < selected.length - 1) await sleep(CFG.processing.delayBetweenBooksMs);
  }
  await writeBatchOutput(out);
}

async function main() {
  const ctx = getContexto();
  const singleMode = process.env.SINGLE_MODE === "true" || await fileExists(CFG.files.tmpBook);
  if (singleMode) await runSingle(ctx);
  else await runBatch(ctx);
}

main().catch((error) => {
  console.error("❌ build-contenido.js falló:", error);
  process.exit(1);
});
