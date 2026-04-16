/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v9.7.2 — NIVEL DIOS DEFINITIVO

   Arquitectura v9.5 (SINGLE/BATCH, highlights [H]...[/H], prompts externos)
   + Prompts neurobiológicos v9.0 (Hawkins, dopamina, cronobiología, línea sagrada)
   − Second pass (eliminado, no sólo desactivado — cero código muerto)
   − Fallbacks editoriales (cero texto genérico — si falla, marca _fallback)

   CAMBIOS v9.7.0 → v9.7.2:
   ✅ Bibliografía bilingüe separada en carril IA dedicado
   ✅ Auditoría IA para evitar cruces entre libros del mismo autor
   ✅ Activadores EN en carril IA separado
   ✅ Cap estricto de temperatura dinámica a 1.2
   ✅ Tarjeta EN nativa con verificador propio
   ✅ Verificadores endurecidos contra subtítulos truncados y cierres genéricos
   ✅ videoUrl_en generado desde título EN
   ✅ Random real: crypto.randomInt (Fisher-Yates criptográfico)
   ✅ Prompts: neurobiología completa restaurada (~110 líneas por tipo)
   ✅ Tarjeta: guías de longitud por campo (tituloGuia, parrafo1Guia, etc.)
   ✅ Highlights [H]...[/H] exigidos en el prompt de tarjeta
   ✅ Objeto NEUROBIOLOGIA restaurado
   ✅ Verificador alineado a prompts restaurados
   ✅ Fallback: arrays vacíos + _fallback:true (nunca texto genérico)
   ✅ writeBatchOutput filtra fallbacks (no se publica mediocridad)
   ✅ Second pass eliminado completo (no código muerto)
   ✅ GPT-4o-mini (NO CAMBIAR MODELO)
   ✅ Temperatura máxima 1.2 (nunca >1.5 — Archivo Maestro)

   AUTOR: Badir Nakid | VERSIÓN: 9.7.2
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

/* ═══════════════════════════════════════════════════════════════
   ⚙️  CONFIGURACIÓN MAESTRA
═══════════════════════════════════════════════════════════════ */

const CFG = {
  // ─── API ───
  model: "gpt-4o-mini",
  temp: 1.2,
  top_p: 0.9,
  presence: 0.7,
  frequency: 0.4,

  // ─── Archivos ───
  files: {
    csv: "data/libros_master.csv",
    outBatch: "contenido.json",
    outSingle: "contenido_edicion.json",
    tmpBook: "/tmp/triggui-book.json"
  },

  // ─── Prompts externos ───
  prompts: {
    useExternalEditorial: process.env.USE_EXTERNAL_EDITORIAL_PROMPTS === "true",
    constitution: "prompts/constitution/triggui-core.md",
    editorial: "prompts/tasks/generate-editorial.md"
  },

  // ─── Procesamiento ───
  processing: {
    maxBatch: 20,
    delayBetweenBooksMs: 10000,
    maxRetries: 20,
    retrySleepMs: 2000,
    resetMemoryEvery: 5
  },

  // ─── Hawkins por franja ───
  hawkins: {
    base: [20, 100],
    madrugada: [20, 75],
    manana: [50, 150],
    tarde: [30, 120],
    noche: [20, 100]
  },

  // ─── Contenido ───
  frases: { cantidad: 4, longitudMin: 90, longitudMax: 110 },
  palabras: { cantidad: 4 },
  colores: { cantidad: 4 },

  // ─── Tarjeta (guías de longitud restauradas de v9.0) ───
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

  // ─── Dark Mode ───
  darkMode: {
    paperMin: "#0a0a0a",
    paperMax: "#2a2a2a",
    inkMin: "#e0e0e0",
    inkMax: "#ffffff",
    lumThresholdPaper: 0.3,
    lumThresholdInk: 0.7
  },

  // ─── Cronobiología ───
  energia: {
    lunes: 0.8,
    martes: 0.4,
    miércoles: 0.6,
    jueves: 1.2,
    viernes: 0.9,
    sábado: 0.8,
    domingo: 0.8
  },

  // ─── Ajustes dinámicos ───
  dinamico: {
    tempMultiplicador: true,
    hawkinsShift: true,
    frasesExtension: true
  },

  // ─── Verificación ───
  verification: {
    enabled: true,
    logLowScore: true,
    retryIfLowScore: true,
    minScore: 0.8
  }
};

/* ═══════════════════════════════════════════════════════════════
   🧰 UTILIDADES
═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   🟨 HIGHLIGHTS CANÓNICOS [H]...[/H]
═══════════════════════════════════════════════════════════════ */

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
      .replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
      .replace(/[.!?…]+$/g, "").trim()
  );
}

function sanitizeSubtitleText(text) {
  let clean = normalizeSentence(
    stripHighlightTags(String(text || ""))
      .replace(/@@BODY|@@ENDBODY/gi, "")
      .replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
      .trim()
  );
  if (!clean) return "";

  const isQuestion = clean.startsWith("¿");

  // Preservar ? en preguntas — solo strip . y …
  clean = isQuestion
    ? clean.replace(/[.…]+$/g, "").trim()
    : clean.replace(/[.!?…]+$/g, "").trim();

  const words = clean.split(/\s+/).filter(Boolean);
  // Preguntas en español necesitan más espacio (12 palabras vs 8)
  const maxWords = isQuestion ? 12 : 8;
  const maxChars = isQuestion ? 90 : 72;

  if (words.length > maxWords || clean.length > maxChars) {
    let truncated = words.slice(0, maxWords).join(" ");
    // Si truncamos una pregunta, cerrarla con ?
    if (isQuestion && !truncated.endsWith("?")) truncated += "?";
    return truncated;
  }

  return clean;
}

function isLikelyEditorialTitle(text) {
  const v = sanitizeTitleText(text);
  if (!v || v.length < 6 || v.length > 72) return false;
  if ((v.match(/[.!?]/g) || []).length > 0) return false;
  return v.split(/\s+/).filter(Boolean).length <= 8;
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

  // Primero: eliminar highlights débiles que GPT puso mal
  // (fragmentos cortos, frases que terminan en preposición/artículo)
  norm = norm.replace(/\[H\](.*?)\[\/H\]/gi, (match, content) => {
    const plain = content.trim();
    if (plain.length < 25) return plain; // Demasiado corto para ser significativo
    if (/\b(de|del|en|a|al|con|por|para|sin|sobre|entre|hacia|hasta|desde|tras|un|una|el|la|los|las|que|y|o)\s*$/i.test(plain)) {
      return plain; // Termina en preposición/artículo = fragmento incompleto
    }
    return match; // Highlight válido, mantener
  });
  norm = normalizeHighlightSyntax(norm);

  if (countHighlights(norm) >= minimum) return norm;

  const segments = stripHighlightTags(norm)
    .split(/(?<=[\.\!\?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 28);
  if (!segments.length) return norm;

  for (const seg of segments.slice(0, minimum)) {
    if (countHighlights(norm) >= minimum) break;
    const escaped = seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    norm = norm.replace(new RegExp(escaped), `[H]${seg}[/H]`);
  }
  return normalizeHighlightSyntax(norm);
}

function normalizeTarjetaObject(tarjeta = {}) {
  const clean = {
    titulo: sanitizeTitleText(String(tarjeta.titulo || "").trim()),
    parrafoTop: ensureMinimumHighlights(
      normalizeHighlightSyntax(String(tarjeta.parrafoTop || "").trim()), 1
    ),
    subtitulo: sanitizeSubtitleText(String(tarjeta.subtitulo || "").trim()),
    parrafoBot: ensureMinimumHighlights(
      normalizeHighlightSyntax(String(tarjeta.parrafoBot || "").trim()), 1
    ),
    style: tarjeta.style || {}
  };

  if (tooSimilarText(clean.parrafoTop, clean.parrafoBot)) {
    clean.parrafoBot = removeRepeatedSentences(clean.parrafoBot, clean.parrafoTop, clean.subtitulo);
  }

  return clean;
}

function sanitizeSubtitleText_EN(text) {
  let clean = normalizeSentence(
    stripHighlightTags(String(text || ""))
      .replace(/@@BODY|@@ENDBODY/gi, "")
      .replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
      .trim()
  );
  if (!clean) return "";

  const isQuestion = clean.endsWith("?");

  clean = isQuestion
    ? clean.replace(/[.…]+$/g, "").trim()
    : clean.replace(/[.!?…]+$/g, "").trim();

  const words = clean.split(/\s+/).filter(Boolean);
  const maxWords = isQuestion ? 12 : 8;
  const maxChars = isQuestion ? 90 : 72;

  if (words.length > maxWords || clean.length > maxChars) {
    let truncated = words.slice(0, maxWords).join(" ");
    if (isQuestion && !truncated.endsWith("?")) truncated += "?";
    return truncated;
  }

  return clean;
}

function normalizeTarjetaObject_EN(tarjeta = {}) {
  const clean = {
    titulo: sanitizeTitleText(String(tarjeta.titulo || "").trim()),
    parrafoTop: ensureMinimumHighlights(
      normalizeHighlightSyntax(String(tarjeta.parrafoTop || "").trim()), 1
    ),
    subtitulo: sanitizeSubtitleText_EN(String(tarjeta.subtitulo || "").trim()),
    parrafoBot: ensureMinimumHighlights(
      normalizeHighlightSyntax(String(tarjeta.parrafoBot || "").trim()), 1
    ),
    style: tarjeta.style || {}
  };

  if (tooSimilarText(clean.parrafoTop, clean.parrafoBot)) {
    clean.parrafoBot = removeRepeatedSentences(clean.parrafoBot, clean.parrafoTop, clean.subtitulo);
  }

  return clean;
}

function normalizeArrayStrings(arr, limit) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
}

function normalizeAscii(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countSharedTokens(a = "", b = "") {
  const aa = new Set(normalizeAscii(a).split(" ").filter(Boolean));
  const bb = new Set(normalizeAscii(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  return [...aa].filter((t) => bb.has(t)).length;
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

function hasLikelySpanishSignals(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  if (/[¿¡áéíóúñü]/i.test(value)) return true;
  return /\b(el|la|los|las|de|del|para|por|con|sin|que|como|cuando|donde|hoy|ahora|durante|segundos|minutos|dedica|toma|escribe|reflexiona|observa|conecta|haz|solo|tu|tus|una|un)\b/i.test(value);
}

function hasLikelyEnglishSignals(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  return /\b(the|a|an|and|or|with|without|through|within|after|before|take|spend|write|reflect|observe|connect|today|now|seconds|minutes|your|what|how|why|when|where|into|toward|towards|growth|focus|habit|change|performance)\b/i.test(value);
}

function countIdenticalNormalizedItems(a = [], b = []) {
  const limit = Math.min(Array.isArray(a) ? a.length : 0, Array.isArray(b) ? b.length : 0);
  let count = 0;
  for (let i = 0; i < limit; i += 1) {
    if (normalizeAscii(a[i]) && normalizeAscii(a[i]) === normalizeAscii(b[i])) count += 1;
  }
  return count;
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
  return /(cierre reflexivo|cierre inspirador|reflexiona sobre ello|permite que|encuentra tu fuerza interior|encuentra tu centro|cierre potente|conclusión inspiradora)/i.test(value);
}

function normalizeBibliografiaData(data = {}, libro = {}) {
  const tituloBase = String(libro?.titulo || "").trim();

  let titulo_es = String(data.titulo_es || "").trim();
  let titulo_en = String(data.titulo_en || "").trim();
  let idioma_original = String(data.idioma_original || "").trim().toLowerCase();

  if (!titulo_es && !titulo_en && tituloBase) {
    titulo_es = tituloBase;
  }

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

/* ═══════════════════════════════════════════════════════════════
   🕐 CONTEXTO DINÁMICO
═══════════════════════════════════════════════════════════════ */

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
    dia, hora, franja, energia,
    tempDinamica: Math.max(0.2, Math.min(CFG.temp, Number(tempCalculada.toFixed(2)))),
    bibliografiaTemp: 0.3,
    hawkinsDinamico: CFG.dinamico.hawkinsShift ? CFG.hawkins[franja] : CFG.hawkins.base,
    frasesLongitud: CFG.dinamico.frasesExtension
      ? { min: Math.round(CFG.frases.longitudMin * energia), max: Math.round(CFG.frases.longitudMax * energia) }
      : { min: CFG.frases.longitudMin, max: CFG.frases.longitudMax }
  };
}

/* ═══════════════════════════════════════════════════════════════
   🧠 NEUROBIOLOGÍA — SISTEMA DE VARIABLES
═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   📂 PROMPTS EXTERNOS
═══════════════════════════════════════════════════════════════ */

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
  if (!match) throw new Error(`Sección "${heading}" no encontrada`);
  const tail = source.slice(match.index + match[0].length).replace(/^\s+/, "");
  const next = /^##\s+/m.exec(tail);
  const content = (next ? tail.slice(0, next.index) : tail).trim();
  if (!content) throw new Error(`Sección "${heading}" vacía`);
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

/* ═══════════════════════════════════════════════════════════════
   🧙‍♂️ SISTEMA DE PROMPTS NIVEL DIOS
═══════════════════════════════════════════════════════════════ */

function buildPrompt(libro, tipo, ctx, extra = null) {
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");

  const base = `
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

TEST DE CALIDAD BRUTAL (LÍNEA SAGRADA):
→ Si puedo copiar tu output y usarlo para OTRO libro = FALLASTE COMPLETAMENTE
→ Si no refleja CONTENIDO ESPECÍFICO de este libro = FALLASTE
→ Si es genérico = FALLASTE

PROCESO OBLIGATORIO:
1. Recuerda lo que SABES del libro (no lo que imaginas)
2. Identifica temas, emociones, conflictos REALES
3. Extrae atmósfera, tono, sensación ESPECÍFICA
4. SOLO ENTONCES genera
`;

  const prompts = {
    main: base + `
═══════════════════════════════════════════════════════════════
🎯 GENERAR: Activadores emocionales para "${libro.titulo}"
═══════════════════════════════════════════════════════════════

ANTES DE GENERAR, RESPONDE INTERNAMENTE:
→ ¿Cuáles son los 3 temas centrales INTRÍNSECOS de este libro específico?
→ ¿Qué emociones/conflictos dominan en esta obra?
→ ¿Cuál es el arco emocional de este libro?
→ ¿Qué sé sobre cómo los lectores reales reciben este libro?

COMPONENTE 1 - PALABRAS (${CFG.palabras.cantidad}):
Rango: Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}

PROCESO:
→ Identifica emociones que APARECEN en el contenido del libro
→ Mapea esas emociones a escala Hawkins en el rango dado
→ Prioriza emociones DENSAS, viscerales, específicas al libro
→ Emociones deben ser IMPOSIBLES de usar en otro libro sin que se note

PROHIBIDO ABSOLUTO:
❌ Emociones genéricas aplicables a cualquier libro
❌ Palabras que no reflejen contenido real del libro
❌ Cualquier emoción que no investigaste en el libro

COMPONENTE 2 - FRASES (${CFG.frases.cantidad}):
Longitud: ${ctx.frasesLongitud.min}-${ctx.frasesLongitud.max} caracteres
Estructura: emoji + acción ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax} segundos

PROCESO:
→ Identifica metáforas, situaciones, momentos ESPECÍFICOS del libro, relacionados a su respectiva palabra de COMPONENTE 1
→ Traduce esas situaciones a acciones o micro-acciones ejecutables ahora. Relacionados a su respectiva palabra de COMPONENTE 1
→ Emoji debe reflejar tono emocional de esa parte del libro. Relacionados a su respectiva palabra de COMPONENTE 1
→ Cada acción debe ser ÚNICAMENTE aplicable a este libro. Relacionados a su respectiva palabra de COMPONENTE 1

NEUROBIOLOGÍA:
→ Emoji = spike dopamina (recompensa visual)
→ Acción <60seg = dopamina anticipatoria (alcanzable)
→ Conexión al libro = oxitocina (pertenencia)

PROHIBIDO ABSOLUTO:
❌ Acciones genéricas aplicables a cualquier libro
❌ Acciones sin tiempo específico
❌ Acciones desconectadas del contenido del libro

COMPONENTE 3 - COLORES (${CFG.colores.cantidad}):
Formato: hex completo

PROCESO NEUROBIOLÓGICO RIGUROSO:
→ Identifica la atmósfera emocional ESPECÍFICA del libro
→ Determina si es oscuro, luminoso, esperanzador, sombrío, transformacional, introspectivo
→ Mapea esa atmósfera a activación dopaminérgica requerida

PRINCIPIOS NEUROBIOLÓGICOS:
→ Temperatura color (cálido/frío) determina tipo activación
→ Saturación determina intensidad dopaminérgica
→ Luminosidad ajusta según hora del día y energía usuario

MAPEO RIGUROSO ATMÓSFERA → NEUROBIOLOGÍA:
→ Atmósfera oscura existencial: fríos saturados para elevar manteniendo tono
→ Atmósfera cálida esperanzadora: cálidos saturados para amplificar
→ Atmósfera transformacional: contraste cálido-frío para impulso
→ Atmósfera introspectiva: fríos medios para profundizar sin agitar

AJUSTE CRONOBIOLÓGICO OBLIGATORIO:
→ Energía usuario: ${Math.round(ctx.energia * 100)}%
→ Si <60%: incrementa saturación para compensar
→ Si >100%: puedes reducir saturación
→ Hora ${ctx.franja}: ajusta luminosidad según momento del día

PROHIBIDO ABSOLUTO:
❌ Colores aleatorios sin investigación del libro
❌ Ignorar energía del usuario
❌ Ignorar hora del día
❌ Grises, pasteles débiles, neones estridentes
❌ Colores que no reflejen atmósfera del libro

CRITERIO FINAL:
→ ¿Refleja atmósfera del libro? NO = descarta
→ ¿Activa dopamina según energía/hora? NO = descarta
→ ¿Es único a este libro? NO = descarta

COMPONENTE 4 - FONDO (1):
Rango: ${CFG.darkMode.paperMin} a ${CFG.darkMode.paperMax}
Elige tono dentro del rango que complemente tu paleta.
Neurobiología: reduce fatiga visual, prolonga estado alfa.

═══════════════════════════════════════════════════════════════
📤 OUTPUT:
═══════════════════════════════════════════════════════════════

{
  "dimension": "Bienestar|Prosperidad|Conexión",
  "punto": "Cero|Creativo|Activo|Máximo",
  "palabras": ["palabra_hawkins_del_libro", "palabra_hawkins_del_libro", "palabra_hawkins_del_libro", "palabra_hawkins_del_libro"],
  "frases": [
    "emoji Acción relacionada al libro ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax}seg",
    "emoji Acción relacionada al libro ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax}seg",
    "emoji Acción relacionada al libro ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax}seg",
    "emoji Acción relacionada al libro ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax}seg"
  ],
  "colores": ["#hex", "#hex", "#hex", "#hex"],
  "fondo": "#hex"
}

VERIFICACIÓN ANTES DE RESPONDER:
✓ ¿Trabajé con rasgos reales del libro?
✓ ¿Palabras aparecen en contenido del libro?
✓ ¿Frases conectan con libro específico?
✓ ¿Colores reflejan atmósfera + cronobiología?
✓ ¿Puedo usar esto para otro libro? SI = REGENERA TODO

SOLO JSON.`,

    bibliografia: `
Eres un resolutor bibliográfico bilingüe de precisión extrema.

Tu única tarea es devolver metadata canónica para UN MISMO libro.
NO escribes marketing. NO interpretas el libro. NO adornas.
NO inventes traducciones literales si existe un título publicado conocido.
NO confundas esta obra con otro libro del mismo autor.

═══════════════════════════════════════════════════════════════
📚 INPUT
═══════════════════════════════════════════════════════════════
Título visto: "${libro.titulo}"
Autor: "${libro.autor}"
Tagline / contexto: "${libro.tagline || ""}"

REGLAS ABSOLUTAS:
1. Devuelve el título canónico en español y en inglés para ESTA MISMA obra.
2. idioma_original debe ser SOLO "es" o "en".
3. Si el libro fue publicado originalmente en inglés, idioma_original = "en" aunque el título que te den esté en español.
4. Si el libro fue publicado originalmente en español, idioma_original = "es" aunque exista edición en inglés.
5. Si conoces un título publicado real, úsalo.
6. Si NO estás seguro del título publicado en el otro idioma:
   → conserva el título original en su idioma
   → genera la mejor versión natural posible en el otro idioma
   → pero NUNCA inventes un subtítulo ni exageres.
7. Si existe riesgo de confundirlo con OTRA obra del mismo autor, prioriza el título visto y el tagline por encima de cualquier asociación mental.
8. NO pongas comillas.
9. NO expliques nada.
10. NO devuelvas variantes múltiples.
11. Prioridad absoluta: exactitud bibliográfica y correspondencia exacta con la obra recibida.

SEÑAL DE FRACASO:
❌ traducción literal robótica
❌ idioma_original igual al idioma del input por inercia
❌ subtítulos inventados
❌ títulos demasiado largos que no parecen editoriales reales
❌ devolver el título de OTRO libro del mismo autor

OUTPUT JSON:
{
  "titulo_es": "string",
  "titulo_en": "string",
  "idioma_original": "es|en"
}

SOLO JSON.`,

    bibliografia_auditor: `
Eres un auditor bibliográfico implacable.

Debes decidir si una propuesta bibliográfica corresponde EXACTAMENTE al mismo libro recibido.
Tu tarea no es traducir. Tu tarea es detectar confusiones.

═══════════════════════════════════════════════════════════════
📚 LIBRO RECIBIDO
═══════════════════════════════════════════════════════════════
Título visto: "${libro.titulo}"
Autor: "${libro.autor}"
Tagline / contexto: "${libro.tagline || ""}"

═══════════════════════════════════════════════════════════════
🧾 PROPUESTA A AUDITAR
═══════════════════════════════════════════════════════════════
Título ES: "${extra?.titulo_es || ""}"
Título EN: "${extra?.titulo_en || ""}"
Idioma original: "${extra?.idioma_original || ""}"

REGLAS:
1. Si la propuesta parece corresponder a OTRO libro del mismo autor, responde same_work=false.
2. Si el título en inglés o en español parece desalineado con el título recibido y el tagline, responde same_work=false.
3. Si hay duda real, responde same_work=false.
4. Sé estricto.

OUTPUT JSON:
{
  "same_work": true,
  "risk": "low|medium|high",
  "reason": "string"
}

SOLO JSON.`,

    activadores_en: `
You are generating native English activators for Triggui.

Your task is NOT to translate literally.
Your task is to create natural English equivalents for the same emotional journey.

═══════════════════════════════════════════════════════════════
📚 BOOK
═══════════════════════════════════════════════════════════════
Spanish title: "${extra?.titulo_es || libro.titulo}"
English title: "${extra?.titulo_en || libro.titulo}"
Author: "${libro.autor}"
Original language: "${extra?.idioma_original || ""}"

═══════════════════════════════════════════════════════════════
🧠 SOURCE ACTIVATORS IN SPANISH
═══════════════════════════════════════════════════════════════
Palabras ES: ${extra?.palabras?.join(", ") || ""}
Frases ES:
${extra?.frases?.map((f, i) => `${i + 1}. ${f}`).join("\n") || ""}

RULES:
1. Return exactly 4 palabras_en and 4 frases_en.
2. palabras_en must be native English emotional words or compact expressions.
3. frases_en must sound like a native English speaker wrote them.
4. Keep the same emotional intent and same action logic.
5. Keep emoji at the start of each phrase.
6. Keep explicit time where relevant.
7. DO NOT copy the Spanish phrases.
8. DO NOT leave Spanish words unless they are unavoidable proper nouns.
9. If a Spanish word appears in your English output when an English equivalent exists = FAILURE.
10. If the English sounds like Google Translate = FAILURE.

OUTPUT JSON:
{
  "palabras_en": ["string", "string", "string", "string"],
  "frases_en": [
    "emoji string",
    "emoji string",
    "emoji string",
    "emoji string"
  ]
}

SOLO JSON.`,

    tarjeta: base + `
${extra ? `
═══════════════════════════════════════════════════════════════
🔗 JOURNEY PREVIO:
═══════════════════════════════════════════════════════════════
Emociones: ${extra.palabras.join(", ")}
Acciones:
${extra.frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

CONTINÚA este journey emocional.
═══════════════════════════════════════════════════════════════
` : ""}

═══════════════════════════════════════════════════════════════
🎯 GENERAR: Tarjeta profundización "${libro.titulo}"
═══════════════════════════════════════════════════════════════

ANTES DE GENERAR, RESPONDE INTERNAMENTE:
→ ¿Cuál es LA enseñanza central del libro?
→ ¿Qué transformación ofrece?
→ ¿Qué conflicto interno resuelve?
→ ¿Cuál es el momento más citado/recordado?

4 COMPONENTES:

LÍNEA 1 — TÍTULO (~${CFG.tarjeta.tituloGuia} chars):
→ Concepto ÚNICO que solo aparece en este libro
→ Concreto, sin adornos
→ IMPOSIBLE de usar en otro libro
→ Sin primera persona
→ JAMÁS lleva [H] ni [/H]

LÍNEA 2 — PÁRRAFO TOP (~${CFG.tarjeta.parrafo1Guia} chars):
→ Observacional, tercera persona
→ Insight que refleje enseñanza REAL del libro
→ Conecta con emociones Hawkins ya activadas EN LOS COMPONENTES
→ Valida sin juzgar
→ OBLIGATORIO: usa highlights con formato EXACTO [H]...[/H] — mínimo 1 highlight aquí
→ Nunca marques una palabra aislada; marca una frase útil completa

Neurobiología: validación = serotonina, precisión = confianza

LÍNEA 3 — SUBTÍTULO (~${CFG.tarjeta.subtituloGuia} chars):
→ Pregunta provocadora O declaración elevadora INTELIGENTE
→ Basada en tema CENTRAL O INTRÍNSECO del libro
→ Mueve de emociones bajas a altas
→ JAMÁS lleva [H] ni [/H]

Neurobiología: pregunta = curiosidad + shift alfa, elevación = transformación

LÍNEA 4 — PÁRRAFO BOT (~${CFG.tarjeta.parrafo2Guia} chars):
→ Referencia SUTIL INTELIGENTE a micro-acciones previas del journey
→ Nueva acción ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax} segundos
→ Acción inspirada en metáfora/situación/dato ESPECÍFICA del libro
→ Tiempo explícito
→ OBLIGATORIO: usa highlights con formato EXACTO [H]...[/H] — mínimo 1 highlight aquí

Neurobiología: referencia = validación (oxitocina), acción nueva = dopamina, tiempo = alcanzable

PROHIBIDO ABSOLUTO:
❌ Títulos genéricos aplicables a otros libros
❌ Primera persona (yo, mi, aprendí, descubrí, siento, creo, pienso)
❌ "según el libro", "nos recuerda", "invita a", "reflexiona", "trata de", "habla de"
❌ Insights no relacionados al libro
❌ Preguntas obvias
❌ Acciones vagas sin tiempo
❌ Metadata, corchetes de label, markdown, emojis, comillas

═══════════════════════════════════════════════════════════════
📤 OUTPUT (4 líneas limpias, SIN labels, SIN rótulos):
═══════════════════════════════════════════════════════════════

Concepto único del libro
[H]Insight específico observacional del libro conecta con journey.[/H] Extensión del insight.
¿Pregunta provocadora del tema del libro?
Después de referencia sutil acciones previas, [H]nueva acción tiempo segundos inspirada en libro.[/H] Cierre reflexivo.

SOLO 4 LÍNEAS. SIN rótulos. SIN markdown. SIN emojis. SIN comillas.`,

    tarjeta_en: base + `
${extra ? `
═══════════════════════════════════════════════════════════════
🔗 EMOTIONAL JOURNEY (English):
═══════════════════════════════════════════════════════════════
Emotions: ${extra.palabras.join(", ")}
Actions:
${extra.frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}

CONTINUE this emotional journey IN ENGLISH.
═══════════════════════════════════════════════════════════════
` : ""}

═══════════════════════════════════════════════════════════════
🎯 GENERATE: English editorial card for "${extra?.titulo_en || libro.titulo}"
═══════════════════════════════════════════════════════════════

BEFORE GENERATING, ANSWER INTERNALLY:
→ What is THE central teaching of this book?
→ What transformation does it offer?
→ What inner conflict does it resolve?
→ What is the most quoted/remembered moment?

4 COMPONENTS:

LINE 1 — TITLE (~${CFG.tarjeta.tituloGuia} chars):
→ A UNIQUE concept that only appears in this book
→ Concrete, no embellishments
→ IMPOSSIBLE to use for another book
→ No first person
→ NEVER use [H] or [/H]

LINE 2 — TOP PARAGRAPH (~${CFG.tarjeta.parrafo1Guia} chars):
→ Observational, third person
→ Insight reflecting a REAL teaching of the book
→ Connects with Hawkins emotions already activated
→ Validates without judging
→ REQUIRED: use highlights with EXACT format [H]...[/H] — minimum 1 highlight here
→ Never highlight a single word; highlight a complete useful phrase

LINE 3 — SUBTITLE (~${CFG.tarjeta.subtituloGuia} chars):
→ Provocative question OR intelligent elevating statement
→ Based on a CENTRAL or INTRINSIC theme of the book
→ NEVER use [H] or [/H]

LINE 4 — BOTTOM PARAGRAPH (~${CFG.tarjeta.parrafo2Guia} chars):
→ SUBTLE INTELLIGENT reference to previous micro-actions
→ New action ${CFG.tarjeta.accionMin}-${CFG.tarjeta.accionMax} seconds
→ Action inspired by a SPECIFIC metaphor/situation/fact from the book
→ Explicit time
→ REQUIRED: use highlights with EXACT format [H]...[/H] — minimum 1 highlight here

ABSOLUTELY FORBIDDEN:
❌ Generic titles applicable to other books
❌ First person (I, my, me, we, our, learned, discovered, felt, think, believe)
❌ "according to the book", "reminds us", "invites us to", "reflects on", "deals with", "talks about"
❌ Insights unrelated to the book
❌ Obvious questions
❌ Vague actions without time
❌ Metadata, label brackets, markdown, emojis, quotes

CRITICAL: This must sound like a native English speaker wrote it. If it sounds like a translation = COMPLETE FAILURE.

═══════════════════════════════════════════════════════════════
📤 OUTPUT (4 clean lines, NO labels, NO headers):
═══════════════════════════════════════════════════════════════

Unique concept from the book
[H]Specific observational insight connecting with journey.[/H] Extension of insight.
Provocative question about the book's theme?
After subtle reference to previous actions, [H]new action time seconds inspired by book.[/H] Reflective close.

ONLY 4 LINES. NO labels. NO markdown. NO emojis. NO quotes.`,

    estilo: base + `
═══════════════════════════════════════════════════════════════
🎯 GENERAR: Estilo visual para tarjeta "${libro.titulo}"
═══════════════════════════════════════════════════════════════

ANTES DE GENERAR:
→ ¿Cuál es la atmósfera emocional dominante del libro?
→ ¿Es oscuro, luminoso, denso, ligero, sombrío, esperanzador?
→ ¿Qué sensación queda tras leerlo?

COMPONENTES:

ACCENT:
→ Color que REPRESENTE atmósfera específica del libro
→ Ajustado a energía usuario (${Math.round(ctx.energia * 100)}%) y hora (${ctx.franja})
→ Debe activar dopamina apropiada sin romper inmersión

Proceso:
1. Determina atmósfera del libro
2. Mapea a temperatura de color (cálido/frío)
3. Ajusta saturación según energía usuario
4. Ajusta luminosidad según hora

INK:
→ Rango: ${CFG.darkMode.inkMin} a ${CFG.darkMode.inkMax}
→ Claro, legible, sin esfuerzo cognitivo

PAPER:
→ Rango: ${CFG.darkMode.paperMin} a ${CFG.darkMode.paperMax}
→ Oscuro profundo
→ Complementa accent

BORDER:
→ Oscuro sutil, apenas perceptible
→ No rompe inmersión

Neurobiología: alto contraste = menos esfuerzo, fondo oscuro = alfa prolongado, accent = dopamina visual

═══════════════════════════════════════════════════════════════
📤 OUTPUT:
═══════════════════════════════════════════════════════════════

{
  "accent": "#hex",
  "ink": "#hex",
  "paper": "#hex",
  "border": "#hex"
}

VERIFICACIÓN:
✓ ¿Trabajé con la atmósfera real del libro?
✓ ¿Accent refleja libro?
✓ ¿Ajustado a energía/hora?
✓ ¿Paper oscuro rango correcto?
✓ ¿Ink claro rango correcto?

SOLO JSON.`
  };

  return prompts[tipo];
}

/* ═══════════════════════════════════════════════════════════════
   📂 TARJETA: PROMPT EXTERNO (cuando USE_EXTERNAL_EDITORIAL_PROMPTS=true)
═══════════════════════════════════════════════════════════════ */

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

  const ideaSemilla = extra?.frases?.length
    ? extra.frases.join(" | ")
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
    "${palabras_prohibidas}": [...state.palabras].join(", "),
    "${libro.contexto_2026?.aplicacion_badir_hoy ?? ''}": libro?.contexto_2026?.aplicacion_badir_hoy || "",
    "${lente_activo ?? ''}": libro?.lente_activo || ""
  };

  return {
    system: [artifacts.systemSection, "CONSTITUCIÓN EDITORIAL DE TRIGGUI:", artifacts.constitution].join("\n\n").trim(),
    user: renderPromptTemplate(artifacts.userSection, variables),
    source: "external"
  };
}

/* ═══════════════════════════════════════════════════════════════
   ✅ VERIFICADORES ALINEADOS AL PROMPT
═══════════════════════════════════════════════════════════════ */

const VERIFICADOR = {
     main(data) {
    const checks = {
      tienePalabras: Array.isArray(data.palabras) && data.palabras.length === CFG.palabras.cantidad,
      palabrasNoVacias: Array.isArray(data.palabras) && data.palabras.every((p) => String(p || "").trim().length > 3),
      tieneFrases: Array.isArray(data.frases) && data.frases.length === CFG.frases.cantidad,
      frasesConEmoji: Array.isArray(data.frases) && data.frases.every((f) => /[\p{Emoji}]/u.test(String(f || ""))),
      frasesLongitudOk: Array.isArray(data.frases) && data.frases.every((f) => {
        const len = String(f || "").trim().length;
        return len >= 30 && len <= 150;
      }),
      tieneColores: Array.isArray(data.colores) && data.colores.length === CFG.colores.cantidad,
      coloresHex: Array.isArray(data.colores) && data.colores.every((c) => /^#[0-9a-f]{6}$/i.test(String(c || ""))),
      tieneFondo: typeof data.fondo === "string" && /^#[0-9a-f]{6}$/i.test(data.fondo),
      fondoOscuro: typeof data.fondo === "string" && utils.lum(data.fondo) < CFG.darkMode.lumThresholdPaper
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      score: ok / total, checks,
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
  },

  bibliografia(data, libro, auditoria = null) {
    const safe = normalizeBibliografiaData(data, libro);
    const baseTitle = String(libro?.titulo || "").trim();
    const sharedEs = countSharedTokens(baseTitle, safe.titulo_es);
    const sharedEn = countSharedTokens(baseTitle, safe.titulo_en);

    const checks = {
      tieneTituloEn: typeof safe.titulo_en === "string" && safe.titulo_en.trim().length > 2,
      tieneTituloEs: typeof safe.titulo_es === "string" && safe.titulo_es.trim().length > 2,
      idiomaOriginalValido: /^(es|en)$/i.test(String(safe.idioma_original || "").trim()),
      noVaciosPorInercia: !(!safe.titulo_en.trim() || !safe.titulo_es.trim()),
      idiomaConsistenteConBase: ["es", "en"].includes(safe.idioma_original),
      anclaConTituloFuente: sharedEs >= 1 || sharedEn >= 1 || safe.titulo_es === baseTitle || safe.titulo_en === baseTitle,
      sinCruceObvioDeObra: !(sharedEs === 0 && sharedEn === 0 && normalizeAscii(baseTitle) !== normalizeAscii(safe.titulo_es) && normalizeAscii(baseTitle) !== normalizeAscii(safe.titulo_en)),
      auditoriaMismoLibro: auditoria ? auditoria.same_work === true : true,
      auditoriaNoRiesgoAlto: auditoria ? auditoria.risk !== "high" : true
    };

    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      score: ok / total, checks, safe,
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
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
      palabrasEnNoVacias: palabras_en.every((p) => String(p || "").trim().length >= 2),
      tieneFrasesEn: frases_en.length === CFG.frases.cantidad,
      frasesEnConEmoji: frases_en.every((f) => /[\p{Emoji}]/u.test(String(f || ""))),
      frasesEnLongitudOk: frases_en.every((f) => {
        const len = String(f || "").trim().length;
        return len >= 20 && len <= 180;
      }),
      palabrasEnNoCopianES: countIdenticalNormalizedItems(palabras_en, palabras_es) <= 1,
      frasesEnNoCopianES: countIdenticalNormalizedItems(frases_en, frases_es) === 0,
      frasesEnParecenIngles: englishPhraseHits >= 3,
      palabrasEnParecenIngles: englishWordHits >= 3,
      sinPuntuacionInvertida: frases_en.every((f) => !/[¿¡]/.test(String(f || "")))
    };

    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      score: ok / total, checks,
      safe: { palabras_en, frases_en },
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
  },

  tarjeta(tarjeta) {
    const safe = normalizeTarjetaObject(tarjeta);
    const topPlain = stripHighlightTags(safe.parrafoTop).trim();
    const botPlain = stripHighlightTags(safe.parrafoBot).trim();
    const totalH = countHighlights(`${safe.parrafoTop}\n${safe.parrafoBot}`);
    const allText = [safe.titulo, safe.parrafoTop, safe.subtitulo, safe.parrafoBot].join("\n");

    const checks = {
      tituloOk: isLikelyEditorialTitle(safe.titulo) && safe.titulo.length >= 8,
      subtituloOk: safe.subtitulo.length >= 6 && countHighlights(safe.subtitulo) === 0 && !endsWithDanglingConnector(safe.subtitulo, "es"),
      parrafoTopRico: topPlain.length >= 40,
      parrafoBotRico: botPlain.length >= 40,
      sinMetadata: !/(^|\n)\s*(título|parrafo|párrafo|subtítulo|accion|acción)\s*[:\-]/i.test(allText),
      sinMarkdown: !/```|\*\*|__/g.test(allText),
      sinPrimeraPersona: !/\b(yo|mi|me|conmigo|nosotros|nuestro|aprendí|descubrí|sentí|pienso|creo)\b/i.test(allText),
      highlightsMinimos: totalH >= CFG.tarjeta.minHighlights,
      highlightTop: countHighlights(safe.parrafoTop) >= 1,
      highlightBot: countHighlights(safe.parrafoBot) >= 1,
      subtituloSinHighlights: countHighlights(safe.subtitulo) === 0,
      botDistintoTop: !tooSimilarText(safe.parrafoTop, safe.parrafoBot),
      accionReal: /\b(15|20|30|40|45|60)\b|\b(seg|segundos|min|minutos|instante|momento|ahora|hoy)\b/i.test(botPlain),
      sinCierreGenerico: !hasGenericClosing(botPlain, "es")
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      score: ok / total, checks,
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
  },

  tarjeta_en(tarjeta) {
    const safe = normalizeTarjetaObject_EN(tarjeta);
    const topPlain = stripHighlightTags(safe.parrafoTop).trim();
    const botPlain = stripHighlightTags(safe.parrafoBot).trim();
    const totalH = countHighlights(`${safe.parrafoTop}\n${safe.parrafoBot}`);
    const allText = [safe.titulo, safe.parrafoTop, safe.subtitulo, safe.parrafoBot].join("\n");

    const checks = {
      tituloOk: isLikelyEditorialTitle(safe.titulo) && safe.titulo.length >= 8,
      subtituloOk: safe.subtitulo.length >= 6 && countHighlights(safe.subtitulo) === 0 && !endsWithDanglingConnector(safe.subtitulo, "en"),
      parrafoTopRico: topPlain.length >= 40,
      parrafoBotRico: botPlain.length >= 40,
      sinMetadata: !/(^|\n)\s*(title|paragraph|subtitle|action)\s*[:\-]/i.test(allText),
      sinMarkdown: !/```|\*\*|__/g.test(allText),
      sinPrimeraPersona: !/\b(I|my|me|myself|we|our|ours|ourselves|learned|discovered|felt|think|believe|I'm|I've|I'll|we're|we've)\b/i.test(allText),
      sinMetaReferencias: !/(according to the book|reminds us|invites us to|reflects on|deals with|talks about|proposes|shows us|allows us)/i.test(allText),
      highlightsMinimos: totalH >= CFG.tarjeta.minHighlights,
      highlightTop: countHighlights(safe.parrafoTop) >= 1,
      highlightBot: countHighlights(safe.parrafoBot) >= 1,
      subtituloSinHighlights: countHighlights(safe.subtitulo) === 0,
      botDistintoTop: !tooSimilarText(safe.parrafoTop, safe.parrafoBot),
      accionReal: /\b(15|20|30|40|45|60)\b|\b(sec|seconds|min|minutes|moment|now|today)\b/i.test(botPlain),
      sinCierreGenerico: !hasGenericClosing(botPlain, "en")
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      score: ok / total, checks,
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
  },

  estilo(data) {
    const checks = {
      tieneAccent: typeof data.accent === "string" && /^#[0-9a-f]{6}$/i.test(data.accent),
      tieneInk: typeof data.ink === "string" && /^#[0-9a-f]{6}$/i.test(data.ink),
      tienePaper: typeof data.paper === "string" && /^#[0-9a-f]{6}$/i.test(data.paper),
      tieneBorder: typeof data.border === "string" && /^#[0-9a-f]{6}$/i.test(data.border),
      paperOscuro: typeof data.paper === "string" && utils.lum(data.paper) < CFG.darkMode.lumThresholdPaper,
      inkClaro: typeof data.ink === "string" && utils.lum(data.ink) > CFG.darkMode.lumThresholdInk
    };
    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      score: ok / total, checks,
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
  }
};
/* ═══════════════════════════════════════════════════════════════
   📞 API CALL
═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   🪄 TARJETA PARSER
═══════════════════════════════════════════════════════════════ */

function parseTarjetaLines(raw) {
  const lines = String(raw || "")
    .replace(/@@BODY|@@ENDBODY/g, "").trim()
    .split(/\n+/)
    .map((l) =>
      l.replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]|\[línea.*?\]/gi, "")
                .replace(/^(TÍTULO|PÁRRAFO\s*\d*|SUBTÍTULO|ACCIÓN)[:.\s-]*/gi, "")
       .replace(/^(Concepto único|Insight específico|Bisagra provocadora|Reflexión activa|Pregunta provocadora)[:.\s]*/gi, "")
       .replace(/^\d+[\)\.]\s*/g, "")
       .replace(/^\*{1,3}|\*{1,3}$/g, "")
       .replace(/^_{1,3}|_{1,3}$/g, "")
       .trim()
    )
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

/* ═══════════════════════════════════════════════════════════════
   ⚡ ENRIQUECIMIENTO — Pipeline limpio, CERO fallbacks editoriales
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, ctx) {
  let intento = 0;

  while (intento <= CFG.processing.maxRetries) {
    try {
      // ─── PASO 1: JSON principal ───
      console.log("   [1/6] JSON principal...");
      const rawMain = await call(buildPrompt(libro, "main", ctx), "Genera JSON", ctx.tempDinamica, true);
      let extra = JSON.parse(rawMain);

      if (CFG.verification.enabled) {
        const v = VERIFICADOR.main(extra);
        if (CFG.verification.logLowScore && v.score < 0.8) {
          console.log(`   ⚠️  Verificación main: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(v.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
        if (CFG.verification.retryIfLowScore && !v.aprobado) {
          throw new Error(`Verificación main falló: score ${v.score.toFixed(2)}`);
        }
      }

      if (!extra?.frases?.length || !extra?.palabras?.length || !extra?.colores?.length) {
        throw new Error("Respuesta main incompleta");
      }

      const repetidas = extra.palabras.filter((p) => state.palabras.has(String(p).toLowerCase()));
      if (repetidas.length > 0) {
        console.log(`   ⚠️  Repetidas: ${repetidas.join(", ")}, regenerando...`);
        const rawRetry = await call(buildPrompt(libro, "main", ctx), "Palabras únicas", ctx.tempDinamica, true);
        extra = JSON.parse(rawRetry);
      }

      while (extra.palabras.length < CFG.palabras.cantidad) extra.palabras.push(extra.palabras[extra.palabras.length - 1]);
      while (extra.frases.length < CFG.frases.cantidad) extra.frases.push(extra.frases[extra.frases.length - 1]);
      while (extra.colores.length < CFG.colores.cantidad) extra.colores.push(extra.colores[extra.colores.length - 1]);

      extra.textColors = extra.colores.map(utils.txt);

      extra.palabras.forEach((p) => state.palabras.add(String(p).toLowerCase()));
      extra.colores.forEach((c) => state.colores.add(String(c).toLowerCase()));

      // ─── PASO 1.5: Bibliografía bilingüe IA ───
      console.log("   [1.5/6] Bibliografía bilingüe...");
      const rawBiblio = await call(buildPrompt(libro, "bibliografia", ctx), "Resuelve metadata bibliográfica bilingüe.", ctx.bibliografiaTemp, true);
      const bibliografia = normalizeBibliografiaData(JSON.parse(rawBiblio), libro);

      // ─── PASO 1.6: Auditoría bibliográfica IA ───
      console.log("   [1.6/6] Auditoría bibliográfica...");
      const rawBiblioAudit = await call(
        buildPrompt(libro, "bibliografia_auditor", ctx, bibliografia),
        "Audita si la propuesta corresponde exactamente al mismo libro.",
        0.2,
        true
      );
      const auditoriaBibliografia = JSON.parse(rawBiblioAudit);

      if (CFG.verification.enabled) {
        const vB = VERIFICADOR.bibliografia(bibliografia, libro, auditoriaBibliografia);
        if (CFG.verification.logLowScore && vB.score < 0.8) {
          console.log(`   ⚠️  Verificación bibliografía: ${vB.nivel} (${(vB.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(vB.checks).filter(([, ok]) => !ok).map(([k]) => k));
          if (auditoriaBibliografia?.reason) console.log(`      Auditoría: ${auditoriaBibliografia.reason}`);
        }
        if (CFG.verification.retryIfLowScore && !vB.aprobado) {
          throw new Error(`Verificación bibliografía falló: score ${vB.score.toFixed(2)}`);
        }
      }

      extra = {
        ...extra,
                 ...bibliografia
      };

      // ─── PASO 1.7: Activadores EN IA ───
      console.log("   [1.7/6] Activadores EN...");
      const rawActivadoresEN = await call(
        buildPrompt(libro, "activadores_en", ctx, extra),
        "Generate native English activators.",
        0.45,
        true
      );
      const activadoresEN = JSON.parse(rawActivadoresEN);

      if (CFG.verification.enabled) {
        const vAEN = VERIFICADOR.activadores_en(activadoresEN, extra);
        if (CFG.verification.logLowScore && vAEN.score < 0.8) {
          console.log(`   ⚠️  Verificación activadores EN: ${vAEN.nivel} (${(vAEN.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(vAEN.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
        if (CFG.verification.retryIfLowScore && !vAEN.aprobado) {
          throw new Error(`Verificación activadores EN falló: score ${vAEN.score.toFixed(2)}`);
        }
        extra = { ...extra, ...vAEN.safe };
      } else {
        extra = {
          ...extra,
          palabras_en: normalizeArrayStrings(activadoresEN.palabras_en, CFG.palabras.cantidad),
          frases_en: normalizeArrayStrings(activadoresEN.frases_en, CFG.frases.cantidad)
        };
      }

      // ─── PASO 2: Tarjeta contenido ───
      console.log("   [2/6] Tarjeta...");
      const tarjetaMsg = await buildTarjetaMessages(libro, ctx, extra);
      let rawT = await call(tarjetaMsg.system, tarjetaMsg.user, ctx.tempDinamica, false);
      rawT = rawT.replace(/@@BODY|@@ENDBODY/g, "").trim();

      let tarjeta = parseTarjetaLines(rawT);
      tarjeta = normalizeTarjetaObject(tarjeta);

      if (CFG.verification.enabled) {
        const v = VERIFICADOR.tarjeta(tarjeta);
        if (CFG.verification.logLowScore && v.score < 0.8) {
          console.log(`   ⚠️  Verificación tarjeta: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(v.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
        if (CFG.verification.retryIfLowScore && !v.aprobado) {
          throw new Error(`Verificación tarjeta falló: score ${v.score.toFixed(2)}`);
        }
      }

      // ─── PASO 2.5: Tarjeta EN ───
      console.log("   [2.5/6] Tarjeta EN...");
      const tarjetaEnPrompt = buildPrompt(libro, "tarjeta_en", ctx, {
        ...extra,
        palabras: extra.palabras_en || extra.palabras,
        frases: extra.frases_en || extra.frases
      });

      let rawTEN = await call(tarjetaEnPrompt, "Generate the English editorial card.", ctx.tempDinamica, false);
      rawTEN = rawTEN.replace(/@@BODY|@@ENDBODY/g, "").trim();

      let tarjeta_en = parseTarjetaLines(rawTEN);
      tarjeta_en = normalizeTarjetaObject_EN(tarjeta_en);

      if (CFG.verification.enabled) {
        const vEN = VERIFICADOR.tarjeta_en(tarjeta_en);
        if (CFG.verification.logLowScore && vEN.score < 0.8) {
          console.log(`   ⚠️  Verificación tarjeta EN: ${vEN.nivel} (${(vEN.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(vEN.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
        if (!vEN.aprobado) {
          console.log("   ⚠️  Tarjeta EN no pasó verificación — se omitirá (fallback español en frontend)");
          tarjeta_en = null;
        }
      }

      // ─── PASO 3: Estilo ───
      console.log("   [3/6] Style...");
      const pE = buildPrompt(libro, "estilo", ctx);
      let rawE = await call(pE, "Genera estilo", ctx.tempDinamica, false);
      rawE = rawE.replace(/@@STYLE|@@ENDSTYLE/g, "").trim();

      let style;
      try {
        style = JSON.parse(utils.cleanJSON(rawE));

        if (CFG.verification.enabled) {
          const v = VERIFICADOR.estilo(style);
          if (CFG.verification.logLowScore && v.score < 0.8) {
            console.log(`   ⚠️  Verificación estilo: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          }
        }

        if (style.paper && utils.lum(style.paper) > CFG.darkMode.lumThresholdPaper) {
          style.paper = CFG.darkMode.paperMin;
        }
        if (style.ink && utils.lum(style.ink) < CFG.darkMode.lumThresholdInk) {
          style.ink = CFG.darkMode.inkMax;
        }
      } catch (e) {
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
/* ═══════════════════════════════════════════════════════════════
   📚 CARGA DE FUENTES
═══════════════════════════════════════════════════════════════ */

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
  if (await fileExists(CFG.files.tmpBook)) {
    return JSON.parse(await fs.readFile(CFG.files.tmpBook, "utf8"));
  }
  if (process.env.SINGLE_BOOK) {
    return JSON.parse(process.env.SINGLE_BOOK);
  }
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

/* ═══════════════════════════════════════════════════════════════
   💾 ESCRITURA DE SALIDAS
═══════════════════════════════════════════════════════════════ */

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
    } catch { batchPayload = { libros: [] }; }
  }

  const key = utils.uniqueKey(enriched);
  const rest = batchPayload.libros.filter((l) => utils.uniqueKey(l) !== key);

  // Si el libro cayó en fallback, NO contaminar contenido.json
  // (idea adoptada de ChatGPT v9.7.1 — genuinamente buena)
  const merged = enriched._fallback
    ? rest.slice(0, CFG.processing.maxBatch)
    : [enriched, ...rest].slice(0, CFG.processing.maxBatch);

  await writeJSON(CFG.files.outBatch, { libros: merged });

  console.log(`\n✅ Modo SINGLE completado`);
  if (enriched._fallback) {
    console.log(`🛡️  ${CFG.files.outBatch} preservado — fallback de "${bookMeta.titulo}" NO insertado`);
  } else {
    console.log(`📚 ${CFG.files.outBatch} actualizado — "${bookMeta.titulo}" en posición [0]`);
  }
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
  if (fallidos.length > 0) {
    console.log(`🛡️  ${fallidos.length} excluidos (no se publica mediocridad)`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   🚀 MAIN
═══════════════════════════════════════════════════════════════ */

async function runSingle(ctx) {
  const singleSource = await loadSingleBookSource();
  if (!singleSource) throw new Error("SINGLE_MODE activo pero no existe /tmp/triggui-book.json ni SINGLE_BOOK");

  const bookMeta = mapSingleBookMeta(singleSource);
  if (!bookMeta.titulo || !bookMeta.autor) throw new Error("Libro single inválido: faltan título o autor");

  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  TRIGGUI v9.7.2 — MODO SINGLE NIVEL DIOS     ║");
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
    // Escribir contenido_edicion.json para debugging, pero NO contenido.json
    await writeSingleOutputs(bookMeta, enriched);
    // Abortar pipeline para que GitHub Actions NO ejecute build-editions.py,
    // build-tarjeta-png.js ni build-og-image.js con datos vacíos
    console.log(`🛑 Pipeline detenido — no se genera edición viva con contenido fallback`);
    process.exit(1);
  }

  await writeSingleOutputs(bookMeta, enriched);
}

async function runBatch(ctx) {
  const books = await loadCSVBooks();
  const selected = utils.shuffle(books).slice(0, Math.min(CFG.processing.maxBatch, books.length));

  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   TRIGGUI v9.7.2 — MODO BATCH NIVEL DIOS     ║");
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
