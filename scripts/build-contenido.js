/* ═══════════════════════════════════════════════════════════════════════════════
   TRIGGUI v9.6.0 — FUSIÓN EDITORIAL CANÓNICA + RANDOM REAL

   CAMBIOS v9.6.0:
   ✅ Highlight canónico único: [H]...[/H]
   ✅ Compatibilidad legacy: [H]...[H] y {{H}}...{{/H}}
   ✅ Verificador alineado: mínimo 2 highlights reales
   ✅ Normalización upstream: el JSON sale limpio antes de que lo consuman
   ✅ Mantiene SINGLE + BATCH
   ✅ Mantiene prompts externos con fallback automático
   ✅ Mantiene GPT-4o-mini
   ✅ Second pass conservado pero apagado por default
   ✅ contenido_edicion.json sale ya con tarjeta final canónica + variante presentación
   ✅ Sin tocar arquitectura downstream ni romper SINGLE/BATCH
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
   ⚙️ CONFIGURACIÓN MAESTRA
═══════════════════════════════════════════════════════════════ */

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

  frases: {
    cantidad: 4,
    longitudMin: 90,
    longitudMax: 110
  },

  palabras: {
    cantidad: 4
  },

  colores: {
    cantidad: 4
  },

  tarjeta: {
    accionMinSeg: 15,
    accionMaxSeg: 60,
    lineasMin: 4,
    longitudMinLinea: 10,
    minHighlights: 2
  },

  secondPass: {
    enabled: false,
    temperature: 1.5,
    topP: 0.9,
    maxWords: 60
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

/* ═══════════════════════════════════════════════════════════════
   🧰 UTILIDADES BASE
═══════════════════════════════════════════════════════════════ */

const state = {
  palabras: new Set(),
  colores: new Set()
};

const promptState = {
  editorial: null,
  warnedFallback: false
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    return String(raw || "")
      .trim()
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
   🟨 HIGHLIGHTS CANÓNICOS
═══════════════════════════════════════════════════════════════ */

function normalizeHighlightSyntax(input) {
  let text = String(input || "");

  if (!text.trim()) return "";

  text = text
    .replace(/\{\{H\}\}/gi, "[H]")
    .replace(/\{\{\/H\}\}/gi, "[/H]");

  text = text
    .replace(/\[h\]/g, "[H]")
    .replace(/\[\/h\]/g, "[/H]");

  let toggleOpen = true;
  text = text.replace(/\[H\]/g, () => {
    const token = toggleOpen ? "[H]" : "[/H]";
    toggleOpen = !toggleOpen;
    return token;
  });

  const opens = (text.match(/\[H\]/g) || []).length;
  const closes = (text.match(/\[\/H\]/g) || []).length;
  if (opens > closes) {
    text += "[/H]".repeat(opens - closes);
  }

  let excessClose = (text.match(/\[\/H\]/g) || []).length - (text.match(/\[H\]/g) || []).length;
  if (excessClose > 0) {
    const parts = text.split("");
    for (let i = parts.length - 1; i >= 0 && excessClose > 0; i -= 1) {
      const slice = parts.slice(i - 3, i + 1).join("");
      if (slice === "[/H]") {
        parts.splice(i - 3, 4);
        excessClose -= 1;
        i -= 3;
      }
    }
    text = parts.join("");
  }

  text = text.replace(/\[H\]\s*\[\/H\]/g, "");
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

function countHighlights(text) {
  const normalized = normalizeHighlightSyntax(text);
  const matches = normalized.match(/\[H\](.*?)\[\/H\]/gis) || [];
  return matches
    .map((m) => m.replace(/\[H\]|\[\/H\]/gi, "").trim())
    .filter(Boolean).length;
}

function stripHighlightTags(text) {
  return normalizeHighlightSyntax(String(text || "")).replace(/\[H\]|\[\/H\]/gi, "");
}

function normalizeSentence(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function sanitizeTitleText(text) {
  const clean = stripHighlightTags(String(text || ""))
    .replace(/@@BODY|@@ENDBODY/gi, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
    .replace(/[.!?…]+$/g, "")
    .trim();

  return normalizeSentence(clean);
}

function sanitizeSubtitleText(text) {
  const clean = stripHighlightTags(String(text || ""))
    .replace(/@@BODY|@@ENDBODY/gi, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\-\–—:;,. ]+|[\-\–—:;,. ]+$/g, "")
    .replace(/[.!?…]+$/g, "")
    .trim();

  const normalized = normalizeSentence(clean);
  if (!normalized) return "";

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 8 || normalized.length > 72) {
    return words.slice(0, 8).join(" ");
  }

  return normalized;
}

function isLikelyEditorialTitle(text) {
  const value = sanitizeTitleText(text);
  if (!value) return false;
  if (value.length < 6 || value.length > 72) return false;
  if ((value.match(/[.!?]/g) || []).length > 0) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  return true;
}

function comparableText(text) {
  return stripHighlightTags(String(text || ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tooSimilarText(a, b) {
  const aa = comparableText(a);
  const bb = comparableText(b);

  if (!aa || !bb) return false;
  if (aa === bb) return true;

  if ((aa.includes(bb) || bb.includes(aa)) && Math.min(aa.length, bb.length) > 42) {
    return true;
  }

  const tokensA = new Set(aa.split(" ").filter(Boolean));
  const tokensB = new Set(bb.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size || 1;
  const jaccard = intersection / union;

  return jaccard >= 0.78;
}

function splitIntoSentences(text) {
  const raw = normalizeHighlightSyntax(String(text || ""))
    .replace(/\n+/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!raw) return [];
  return raw.match(/[^.!?…]+[.!?…]?/g)?.map((s) => s.trim()).filter(Boolean) || [raw];
}

function removeRepeatedSentences(parrafoBot, parrafoTop, subtitulo = "") {
  const comparePool = [
    parrafoTop,
    subtitulo,
    ...splitIntoSentences(parrafoTop)
  ].filter(Boolean);

  const bottomSentences = splitIntoSentences(parrafoBot);
  const filtered = bottomSentences.filter(
    (sentence) => !comparePool.some((base) => tooSimilarText(sentence, base))
  );

  return normalizeHighlightSyntax(filtered.join(" ").replace(/[ \t]{2,}/g, " ").trim());
}

function pickFirstDistinct(base, candidates) {
  for (const candidate of candidates) {
    const clean = String(candidate || "").trim();
    if (!clean) continue;
    if (!tooSimilarText(base, clean)) return clean;
  }
  return "";
}

function stripEmojiPrefix(text) {
  return String(text || "")
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function cleanGuidance(text) {
  let value = normalizeSentence(stripEmojiPrefix(text));
  if (!value) return "";
  value = value
    .replace(/^\s*(?:[\(\[]?\d+[\)\]]?[\.\-:]?\s*)+/, "")
    .replace(/^\s*\[?\s*(t[ií]tulo|subt[ií]tulo|p[aá]rrafo(?:\s+breve)?|acci[oó]n)\s*\]?\s*[:\-–]?\s*/i, "")
    .replace(/^\s*(?:una\s+l[ií]nea\s+de\s+)?(?:t[ií]tulo|subt[ií]tulo|p[aá]rrafo(?:\s+breve)?|acci[oó]n)\s*[:\-–]\s*/i, "")
    .trim();

  return value;
}

function buildActionFallbackFromFrases(frases = []) {
  const cleaned = uniqueStrings(
    frases
      .map((frase) => stripEmojiPrefix(frase))
      .map((frase) => cleanGuidance(frase))
      .map((frase) => ensurePeriod(frase))
      .filter(Boolean)
  );

  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];

  return ensurePeriod(`${cleaned[0]} ${cleaned[1]}`);
}

function ensureMinimumHighlights(text, minimum = CFG.tarjeta.minHighlights) {
  let normalized = normalizeHighlightSyntax(text);
  if (countHighlights(normalized) >= minimum) return normalized;

  const plain = stripHighlightTags(normalized);
  const segments = plain
    .split(/(?<=[\.\!\?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28);

  if (segments.length === 0) return normalized;

  const chosen = segments.slice(0, minimum);
  for (const seg of chosen) {
    if (countHighlights(normalized) >= minimum) break;
    const escaped = seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped);
    normalized = normalized.replace(re, `[H]${seg}[/H]`);
  }

  return normalizeHighlightSyntax(normalized);
}

function normalizeTarjetaObject(tarjeta = {}) {
  const clean = {
    titulo: sanitizeTitleText(String(tarjeta.titulo || "").trim()),
    parrafoTop: normalizeHighlightSyntax(String(tarjeta.parrafoTop || "").trim()),
    subtitulo: sanitizeSubtitleText(String(tarjeta.subtitulo || "").trim()),
    parrafoBot: normalizeHighlightSyntax(String(tarjeta.parrafoBot || "").trim()),
    style: tarjeta.style || {}
  };

  clean.parrafoTop = ensureMinimumHighlights(clean.parrafoTop, 1);
  clean.parrafoBot = ensureMinimumHighlights(clean.parrafoBot, 1);

  if (tooSimilarText(clean.parrafoTop, clean.parrafoBot)) {
    clean.parrafoBot = removeRepeatedSentences(clean.parrafoBot, clean.parrafoTop, clean.subtitulo);
  }

  clean.titulo = sanitizeTitleText(clean.titulo);
  clean.subtitulo = sanitizeSubtitleText(clean.subtitulo);
  clean.parrafoTop = normalizeHighlightSyntax(clean.parrafoTop);
  clean.parrafoBot = normalizeHighlightSyntax(clean.parrafoBot);

  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   🕐 CONTEXTO DINÁMICO═══════════════════════════════════════════════════════════════ */

function getContexto() {
  const now = new Date();
  const dia = now.toLocaleDateString("es-MX", { weekday: "long" }).toLowerCase();
  const hora = now.getHours();

  let franja = "noche";
  if (hora >= 0 && hora < 6) franja = "madrugada";
  else if (hora >= 6 && hora < 12) franja = "manana";
  else if (hora >= 12 && hora < 18) franja = "tarde";

  const energia = CFG.energia[dia] || 0.8;

  const tempDinamica = CFG.dinamico.tempMultiplicador
    ? CFG.temp * energia
    : CFG.temp;

  const hawkinsDinamico = CFG.dinamico.hawkinsShift
    ? CFG.hawkins[franja]
    : CFG.hawkins.base;

  const frasesLongitud = CFG.dinamico.frasesExtension
    ? {
        min: Math.round(CFG.frases.longitudMin * energia),
        max: Math.round(CFG.frases.longitudMax * energia)
      }
    : {
        min: CFG.frases.longitudMin,
        max: CFG.frases.longitudMax
      };

  return {
    dia,
    hora,
    franja,
    energia,
    tempDinamica,
    hawkinsDinamico,
    frasesLongitud
  };
}

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
    try {
      return await fs.readFile(fileUrl, "utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`No se pudo leer el prompt: ${relativePath}`);
}

function extractMarkdownSection(markdown, heading) {
  const source = String(markdown || "");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRegex = new RegExp(`^##\\s+${escapedHeading}\\s*$`, "m");
  const startMatch = startRegex.exec(source);

  if (!startMatch) {
    throw new Error(`No se encontró la sección "${heading}"`);
  }

  const start = startMatch.index + startMatch[0].length;
  const tail = source.slice(start).replace(/^\s+/, "");
  const nextHeading = /^##\s+/m.exec(tail);
  const content = nextHeading ? tail.slice(0, nextHeading.index).trim() : tail.trim();

  if (!content) {
    throw new Error(`La sección "${heading}" está vacía`);
  }

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

    return promptState.editorial;
  } catch (error) {
    promptState.editorial = {
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
    return promptState.editorial;
  }
}

/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPTS BASE DEL PIPELINE
═══════════════════════════════════════════════════════════════ */

function buildBasePrompt(libro, ctx) {
  const prohibidas = [...state.palabras].join(", ");
  const prohibidosC = [...state.colores].join(", ");

  return `
Eres Triggui. Editor editorial de activación real.
No escribes para entretener. No escribes reseñas. No haces marketing.
Escribes para provocar un gesto físico: abrir un libro.

LIBRO:
"${libro.titulo}" — ${libro.autor}
${libro.tagline ? `"${libro.tagline}"` : ""}

CONTEXTO:
${ctx.dia} ${ctx.hora}h
Energía usuario: ${Math.round(ctx.energia * 100)}%
Rango Hawkins objetivo: ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}
Franja: ${ctx.franja}

${prohibidas ? `PALABRAS YA USADAS (PROHIBIDO repetir): ${prohibidas}` : ""}
${prohibidosC ? `COLORES YA USADOS (PROHIBIDO repetir): ${prohibidosC}` : ""}

VERDADES FIJAS:
- Si esto sirve para otro libro, fracasaste.
- No inventes citas, escenas, conceptos ni promesas que no puedas sostener.
- GPT-4o-mini no navega. Trabaja con rasgos específicos que conozcas del libro.
- Si tu base es insuficiente, reduce la ambición y ve a una verdad más sobria, concreta y honesta.
- No uses primera persona.
- No suenes a IA, a resumen escolar ni a plantilla motivacional.
- Debes sonar humano, sobrio, preciso, observacional y útil.
`.trim();
}

function buildPrompt(libro, tipo, ctx) {
  const base = buildBasePrompt(libro, ctx);

  const prompts = {
    main: `${base}

GENERAR JSON con:
- dimension
- punto
- palabras (4)
- frases (4)
- colores (4)
- fondo

OBJETIVO:
Crear activadores emocionales y visuales imposibles de reciclar para otro libro sin que se note.

COMPONENTE 1 — PALABRAS (${CFG.palabras.cantidad})
- Deben sentirse nacidas del contenido del libro, no del género general.
- Prioriza tensiones, emociones, conflictos, impulsos o estados que sí pertenezcan a esta obra.
- Muévelas dentro del rango Hawkins ${ctx.hawkinsDinamico[0]}-${ctx.hawkinsDinamico[1]}.
- Prohibido usar palabras vagas o demasiado amplias.

COMPONENTE 2 — FRASES (${CFG.frases.cantidad})
- Longitud ideal: ${ctx.frasesLongitud.min}-${ctx.frasesLongitud.max} caracteres.
- Formato: emoji + microacción real de ${CFG.tarjeta.accionMinSeg}-${CFG.tarjeta.accionMaxSeg} segundos.
- Cada frase debe aterrizar una verdad, metáfora, tensión o gesto específico del libro.
- Deben sentirse ejecutables hoy.
- Cada frase debe conectar con una de las palabras elegidas.
- Prohibido: frases que sirvan para cualquier libro, acciones vacías, promesas abstractas.

COMPONENTE 3 — COLORES (${CFG.colores.cantidad})
- Formato: hex completo.
- Los colores deben traducir la atmósfera del libro a una activación visual útil.
- Ajusta saturación y luminosidad a la energía (${Math.round(ctx.energia * 100)}%) y a la franja ${ctx.franja}.
- Evita paletas tristes, grises muertos, neones gritones o colores desconectados del tono del libro.

COMPONENTE 4 — FONDO
- Un solo hex dark mode entre ${CFG.darkMode.paperMin} y ${CFG.darkMode.paperMax}.
- Debe sostener contraste real y armonizar con la paleta.

REGLAS DURAS:
- No repitas palabras ni colores prohibidos.
- No metas explicaciones en el JSON.
- No uses comodines tipo "presencia", "claridad", "transformación" a menos que sean inevitables y realmente propias del libro.
- Antes de responder, pregúntate: ¿esto le quedaría igual de bien a otro libro? Si sí, regenera.

SOLO JSON.`,

    estilo: `${base}

GENERAR JSON de style dark mode:
- accent
- ink
- paper
- border

OBJETIVO:
Traducir la atmósfera real del libro a una interfaz oscura elegante, legible y específica.

REGLAS:
- accent debe capturar la atmósfera del libro y seguir siendo vibrante en móvil.
- paper debe permanecer dentro del rango oscuro y jamás volverse gris sin intención.
- ink debe ser claro, limpio y descansado para lectura.
- border debe ser sutil; acompaña, no compite.
- Piensa en contraste, tono y temperatura visual, no en decoración.
- Si el estilo también serviría para cualquier otro libro, regenera.

SOLO JSON.`
  };

  return prompts[tipo];
}

function buildLegacyTarjetaPrompt(libro, ctx, extra = null) {
  const base = buildBasePrompt(libro, ctx);
  const ideaSemilla = extra?.frases?.length
    ? extra.frases.join(" | ")
    : (libro.tagline || libro.titulo || "");

  const palabras = extra?.palabras?.length ? extra.palabras.join(", ") : "";
  const frases = extra?.frases?.length ? extra.frases.join(" | ") : "";

  return `${base}

Eres Badir escribiendo una tarjeta editorial mínima, sobria, quirúrgica y viva.

OBJETIVO:
- Un título editorial breve
- Un primer párrafo con verdad útil
- Un subtítulo que abra el siguiente paso
- Un segundo párrafo accionable

JOURNEY PREVIO:
${palabras ? `Palabras activadas: ${palabras}` : "Palabras activadas: n/a"}
${frases ? `Frases activadas: ${frases}` : "Frases activadas: n/a"}
Idea semilla: ${ideaSemilla}

FORMATO OBLIGATORIO:
- Exactamente 4 líneas útiles
- SIN rótulos
- SIN HTML
- SIN markdown
- SIN emojis
- SIN comillas
- SOLO texto plano
- Debes usar highlights con el formato EXACTO [H]...[/H]
- Debe haber mínimo 2 highlights en total: uno en parrafoTop y uno en parrafoBot
- Nunca marques una palabra aislada si puedes marcar una frase útil completa
- El subtítulo jamás lleva [H] ni [/H]

REGLAS:
- Sin primera persona
- Sin “según el libro”, “dice”, “nos recuerda”, “invita a”, “reflexiona”, “trata de”
- El título debe sentirse único para este libro
- El primer párrafo debe nombrar una verdad concreta, no un resumen
- El segundo párrafo debe dejar un siguiente paso real y ejecutable hoy
- Integra el libro o al autor sólo si suma precisión
- Si te falta base, baja la ambición pero no rellenes
- Si suena genérico, reescribe
- Si sirve para otro libro, fracasaste

DEVUELVE SOLO 4 LÍNEAS:
[Línea 1: título]
[Línea 2: primer párrafo]
[Línea 3: subtítulo limpio, sin highlights]
[Línea 4: segundo párrafo]
`;
}

async function buildTarjetaMessages(libro, ctx, extra = null) {
  const legacySystem = buildLegacyTarjetaPrompt(libro, ctx, extra);

  if (!CFG.prompts.useExternalEditorial) {
    return {
      system: legacySystem,
      user: "Genera la tarjeta editorial.",
      source: "legacy"
    };
  }

  const artifacts = await loadEditorialPromptArtifacts();

  if (!artifacts.available) {
    if (!promptState.warnedFallback) {
      console.log(`   ⚠️  Prompt editorial externo no disponible. Fallback legacy: ${artifacts.error}`);
      promptState.warnedFallback = true;
    }
    return {
      system: legacySystem,
      user: "Genera la tarjeta editorial.",
      source: "legacy-fallback"
    };
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
    system: [
      artifacts.systemSection,
      "CONSTITUCIÓN EDITORIAL DE TRIGGUI:",
      artifacts.constitution
    ].join("\n\n").trim(),
    user: renderPromptTemplate(artifacts.userSection, variables),
    source: "external"
  };
}

/* ═══════════════════════════════════════════════════════════════
   🧠 SEGUNDA DESTILACIÓN ESTILO APPS SCRIPT
═══════════════════════════════════════════════════════════════ */

function cleanSecondPassRaw(raw) {
  return String(raw || "")
    .replace(/```[a-z]*\s*/gi, "")
    .replace(/```/g, "")
    .replace(/@@BODY|@@ENDBODY/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSemanticLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s*[-•*]\s*/, "")
        .replace(/^\s*\d+[\)\.]\s*/, "")
        .replace(/^(TÍTULO|PÁRRAFO\s*1|PÁRRAFO\s*2|SUBTÍTULO|ACCIÓN|TEXTO)[:\-\s]*/i, "")
        .trim()
    )
    .filter((line) => line.length >= CFG.tarjeta.longitudMinLinea);
}

function coerceSecondPassStructure(raw, libro) {
  const lines = splitSemanticLines(raw);

  const compact = cleanSecondPassRaw(raw)
    .split(/(?<=[\.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const line0 = lines[0] || "";
  const line0LooksLikeTitle = isLikelyEditorialTitle(line0);

  return {
    titulo: line0LooksLikeTitle ? sanitizeTitleText(line0) : sanitizeTitleText(line0 || ""),
    parrafoTop: line0LooksLikeTitle
      ? (lines[1] || compact[0] || "")
      : (compact[0] || line0 || ""),
    subtitulo: sanitizeSubtitleText(
      line0LooksLikeTitle
        ? (lines[2] || "")
        : (lines[1] || "")
    ),
    parrafoBot: line0LooksLikeTitle
      ? (lines.slice(3).join(" ").trim() || compact.slice(1).join(" ").trim() || "")
      : (lines.slice(2).join(" ").trim() || compact.slice(1).join(" ").trim() || "")
  };
}

function ensurePeriod(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return /[.!?…]$/.test(value) ? value : `${value}.`;
}

function pickSeedForSecondPass(libro, extra, tarjetaBase) {
  const candidates = [
    tarjetaBase?.parrafoBot,
    tarjetaBase?.parrafoTop,
    ...(extra?.frases || []),
    libro?.tagline,
    libro?.titulo
  ]
    .map((s) => stripHighlightTags(String(s || "")).trim())
    .filter(Boolean);

  return candidates[0] || libro?.titulo || "";
}

function buildAppsScriptSecondPassPrompt(libro, ctx, extra, tarjetaBase) {
  const seed = pickSeedForSecondPass(libro, extra, tarjetaBase);
  const frases = (extra?.frases || []).join(" | ");
  const palabras = (extra?.palabras || []).join(", ");

  return `
Eres un editor brutalmente preciso. Vas a hacer una segunda destilación.
No escribes reseña. No escribes resumen. No escribes copy publicitario.
Escribes una tarjeta editorial que haga que alguien quiera abrir el libro y además se lleve una acción real.

LIBRO:
${libro.titulo} — ${libro.autor}
${libro.tagline ? `Tagline: ${libro.tagline}` : ""}

CONTEXTO:
${ctx.dia} ${ctx.hora}h
Palabras activadas: ${palabras}
Frases activadas: ${frases}
Semilla central: ${seed}

OBJETIVO:
Regresa EXACTAMENTE 4 líneas y nada más:
1. Un título editorial breve, humano, memorable, no genérico.
2. Un párrafo informativo que diga algo importante, específico y útil.
3. Un subtítulo breve que abra el siguiente paso.
4. Un párrafo accionable que se pueda ejecutar hoy.

REGLAS OBLIGATORIAS:
- Nada de “invita a”, “explora”, “reflexiona”, “nos recuerda”, “habla de”, “trata de”.
- Nada de tono académico.
- Nada de primera persona.
- No pongas comillas.
- No pongas rótulos.
- No pongas emojis.
- No describas el libro; destílalo.
- Debes usar highlights con este formato exacto: [H]...[/H]
- Debe haber al menos 2 highlights reales en total.
- Nunca resaltes una sola palabra suelta si puedes resaltar una frase útil completa.
- El primer párrafo debe sentirse como claridad.
- El segundo párrafo debe sentirse como movimiento.
- El subtítulo jamás lleva [H] ni [/H].
- Máximo total aproximado: ${CFG.secondPass.maxWords} palabras.

DEVUELVE SOLO 4 LÍNEAS.
`.trim();
}

function coerceStructureLikeAppsScript(candidate, libro, tarjetaBase) {
  const titulo = sanitizeTitleText(
    candidate.titulo || tarjetaBase?.titulo || libro?.tagline || ""
  );

  const parrafoTop = ensureMinimumHighlights(
    ensurePeriod(normalizeSentence(candidate.parrafoTop || tarjetaBase?.parrafoTop || "")),
    1
  );

  const subtitulo = sanitizeSubtitleText(candidate.subtitulo || tarjetaBase?.subtitulo || "");

  const parrafoBot = ensureMinimumHighlights(
    ensurePeriod(normalizeSentence(candidate.parrafoBot || tarjetaBase?.parrafoBot || "")),
    1
  );

  return {
    titulo,
    parrafoTop,
    subtitulo,
    parrafoBot
  };
}

function repairSecondPassTarjeta(candidate, libro, tarjetaBase, extra) {
  const parrafoTop = ensureMinimumHighlights(
    normalizeHighlightSyntax(String(candidate.parrafoTop || tarjetaBase?.parrafoTop || "").trim()),
    1
  );

  let parrafoBot = ensureMinimumHighlights(
    normalizeHighlightSyntax(String(candidate.parrafoBot || tarjetaBase?.parrafoBot || "").trim()),
    1
  );

  const subtitulo = sanitizeSubtitleText(String(candidate.subtitulo || tarjetaBase?.subtitulo || "").trim());

  let titulo = sanitizeTitleText(candidate.titulo);

  const fallbackTitles = [
    sanitizeTitleText(tarjetaBase?.titulo),
    sanitizeTitleText(libro?.tagline)
  ].filter(Boolean);

  const tituloInvalido =
    !isLikelyEditorialTitle(titulo) ||
    countHighlights(titulo) > 0 ||
    tooSimilarText(titulo, parrafoTop) ||
    tooSimilarText(titulo, parrafoBot);

  if (tituloInvalido) {
    titulo =
      pickFirstDistinct(parrafoTop, fallbackTitles.filter(isLikelyEditorialTitle)) ||
      sanitizeTitleText(candidate.titulo || tarjetaBase?.titulo || libro?.tagline || "");
  }

  parrafoBot = removeRepeatedSentences(parrafoBot, parrafoTop, subtitulo) || parrafoBot;

  if (!parrafoBot || tooSimilarText(parrafoTop, parrafoBot)) {
    const fallbackBotCandidates = [
      tarjetaBase?.parrafoBot,
      buildActionFallbackFromFrases(extra?.frases || []),
      tarjetaBase?.parrafoTop
    ]
      .filter(Boolean)
      .map((text) => ensureMinimumHighlights(normalizeHighlightSyntax(ensurePeriod(String(text).trim())), 1));

    const replacement = pickFirstDistinct(parrafoTop, fallbackBotCandidates);
    if (replacement) parrafoBot = replacement;
  }

  return {
    titulo,
    parrafoTop,
    subtitulo,
    parrafoBot
  };
}

function ensureOneToken(text, tokenOpen = "[H]", tokenClose = "[/H]") {
  let value = String(text || "");
  const openCount = (value.match(new RegExp(tokenOpen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  const closeCount = (value.match(new RegExp(tokenClose.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;

  if (openCount === 0 && closeCount === 0) {
    const plain = stripHighlightTags(value).trim();
    if (!plain) return value;
    const firstSentence = plain.split(/(?<=[\.!?])\s+/)[0] || plain;
    return value.replace(firstSentence, `${tokenOpen}${firstSentence}${tokenClose}`);
  }

  return normalizeHighlightSyntax(value);
}

async function callSecondPass(prompt, temp) {
  const chat = await openai.chat.completions.create({
    model: CFG.model,
    temperature: temp,
    top_p: CFG.secondPass.topP,
    presence_penalty: CFG.presence,
    frequency_penalty: CFG.frequency,
    messages: [{ role: "user", content: prompt }]
  });
  return chat.choices[0].message.content;
}

async function runAppsScriptSecondPass(libro, ctx, extra, tarjetaBase) {
  const prompt = buildAppsScriptSecondPassPrompt(libro, ctx, extra, tarjetaBase);
  const raw = await callSecondPass(prompt, CFG.secondPass.temperature);
  const shaped = coerceSecondPassStructure(cleanSecondPassRaw(raw), libro);
  const coerced = coerceStructureLikeAppsScript(shaped, libro, tarjetaBase);
  const repaired = repairSecondPassTarjeta(coerced, libro, tarjetaBase, extra);

  repaired.parrafoTop = ensureOneToken(repaired.parrafoTop);
  repaired.parrafoBot = ensureOneToken(repaired.parrafoBot);

  const tarjetaFinal = normalizeTarjetaObject({
    ...repaired,
    style: tarjetaBase?.style || {}
  });

  tarjetaFinal.promptFlavor = "appscript-second-pass";
  tarjetaFinal.seed = pickSeedForSecondPass(libro, extra, tarjetaBase);

  const tarjetaPresentacion = {
    ...tarjetaFinal,
    titulo: tarjetaFinal.titulo,
    parrafoTop: tarjetaFinal.parrafoTop,
    subtitulo: tarjetaFinal.subtitulo,
    parrafoBot: tarjetaFinal.parrafoBot
  };

  return {
    raw,
    tarjetaFinal,
    tarjetaPresentacion
  };
}

/* ═══════════════════════════════════════════════════════════════
   ✅ VERIFICADORES ALINEADOS
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
        return len >= 30 && len <= 160;
      }),
      tieneColores: Array.isArray(data.colores) && data.colores.length === CFG.colores.cantidad,
      coloresHex: Array.isArray(data.colores) && data.colores.every((c) => /^#[0-9a-f]{6}$/i.test(String(c || ""))),
      tieneFondo: typeof data.fondo === "string" && /^#[0-9a-f]{6}$/i.test(data.fondo),
      fondoOscuro: typeof data.fondo === "string" && utils.lum(data.fondo) < CFG.darkMode.lumThresholdPaper
    };

    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;

    return {
      score: ok / total,
      checks,
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
  },

  tarjeta(tarjeta) {
    const safe = normalizeTarjetaObject(tarjeta);
    const topPlain = stripHighlightTags(safe.parrafoTop).trim();
    const botPlain = stripHighlightTags(safe.parrafoBot).trim();
    const totalHighlights = countHighlights(`${safe.parrafoTop}\n${safe.parrafoBot}`);

    const checks = {
      tituloOk: safe.titulo.length >= 8 && isLikelyEditorialTitle(safe.titulo),
      subtituloOk: safe.subtitulo.length >= 6 && countHighlights(safe.subtitulo) === 0,
      parrafoTopRico: topPlain.length >= 80,
      parrafoBotRico: botPlain.length >= 80,
      sinMetadata: !/(^|\n)\s*(título|parrafo|párrafo|subtítulo|accion|acción)\s*[:\-]/i.test(
        [safe.titulo, safe.parrafoTop, safe.subtitulo, safe.parrafoBot].join("\n")
      ),
      sinMarkdown: !/```|\*\*|__/g.test([safe.titulo, safe.parrafoTop, safe.subtitulo, safe.parrafoBot].join("\n")),
      sinPrimeraPersona: !/\b(yo|mi|me|conmigo|nosotros|nuestro|aprendí|descubrí|sentí|pienso|creo)\b/i.test(
        [safe.titulo, safe.parrafoTop, safe.subtitulo, safe.parrafoBot].join("\n")
      ),
      highlightsMinimos: totalHighlights >= CFG.tarjeta.minHighlights,
      highlightTop: countHighlights(safe.parrafoTop) >= 1,
      highlightBot: countHighlights(safe.parrafoBot) >= 1,
      subtituloSinHighlights: countHighlights(safe.subtitulo) === 0,
      botDistintoTop: !tooSimilarText(safe.parrafoTop, safe.parrafoBot),
      accionReal: /\b(15|20|30|40|45|60)\b|\b(seg|segundos|min|minutos|instante|momento|ahora|hoy)\b/i.test(botPlain)
    };

    const ok = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;

    return {
      score: ok / total,
      checks,
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
      score: ok / total,
      checks,
      nivel: ok === total ? "PERFECTO" : ok >= total * 0.8 ? "BUENO" : "BAJO",
      aprobado: ok / total >= CFG.verification.minScore
    };
  }
};

/* ═══════════════════════════════════════════════════════════════
   📞 API
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

  if (forceJSON) {
    config.response_format = { type: "json_object" };
  }

  const chat = await openai.chat.completions.create(config);
  return chat.choices[0].message.content;
}

/* ═══════════════════════════════════════════════════════════════
   🪄 TARJETA PARSER
═══════════════════════════════════════════════════════════════ */

function parseTarjetaLines(raw) {
  const cleaned = String(raw || "")
    .replace(/@@BODY|@@ENDBODY/g, "")
    .trim();

  const lines = cleaned
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/\[Título\]|\[Párrafo.*?\]|\[Subtítulo\]|\[Acción.*?\]|\[línea.*?\]/gi, "")
        .replace(/^(TÍTULO|PÁRRAFO\s*\d*|SUBTÍTULO|ACCIÓN)[:.\s-]*/gi, "")
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

function buildEmergencyTarjeta(libro) {
  const safeTitle = sanitizeTitleText(libro?.tagline || libro?.titulo || "Entrada mínima");
  const shortBookTitle = sanitizeTitleText(libro?.titulo || "el libro");
  const subtitulo = sanitizeSubtitleText(`Vuelve al libro real`) || "Vuelve al libro real";

  return {
    titulo: safeTitle || "Entrada mínima",
    parrafoTop: `[H]Cuando una generación no alcanza el nivel del libro, no conviene fingir profundidad.[/H] La salida correcta es volver a la fuente y recuperar una verdad sobria.`,
    subtitulo,
    parrafoBot: `[H]Abre ${shortBookTitle} en una página cualquiera y subraya una idea que siga viva hoy.[/H] Desde ahí se reconstruye una edición mejor.`,
    style: defaultStyle(),
    promptFlavor: "emergency-fallback"
  };
}

/* ═══════════════════════════════════════════════════════════════
   ⚡ ENRIQUECIMIENTO
═══════════════════════════════════════════════════════════════ */

async function enrich(libro, ctx) {
  let intento = 0;

  while (intento <= CFG.processing.maxRetries) {
    try {
      console.log("   [1/3] JSON principal...");
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

      console.log("   [2/3] Tarjeta base...");
      const tarjetaMessages = await buildTarjetaMessages(libro, ctx, extra);
      const rawTarjeta = await call(tarjetaMessages.system, tarjetaMessages.user, ctx.tempDinamica, false);
      let tarjetaBase = parseTarjetaLines(rawTarjeta);
      tarjetaBase = normalizeTarjetaObject(tarjetaBase);

      if (CFG.verification.enabled) {
        const v = VERIFICADOR.tarjeta(tarjetaBase);
        if (CFG.verification.logLowScore && v.score < 0.8) {
          console.log(`   ⚠️  Verificación tarjeta base: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(v.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
        if (CFG.verification.retryIfLowScore && !v.aprobado) {
          throw new Error(`Verificación tarjeta base falló: score ${v.score.toFixed(2)}`);
        }
      }

      console.log("   [3/3] Style...");
      let style = defaultStyle();
      try {
        const rawStyle = await call(buildPrompt(libro, "estilo", ctx), "Genera estilo", ctx.tempDinamica, false);
        style = JSON.parse(utils.cleanJSON(rawStyle));
      } catch {
        style = defaultStyle();
      }

      if (CFG.verification.enabled) {
        const v = VERIFICADOR.estilo(style);
        if (CFG.verification.logLowScore && v.score < 0.8) {
          console.log(`   ⚠️  Verificación estilo: ${v.nivel} (${(v.score * 100).toFixed(0)}%)`);
          console.log("      Checks fallidos:", Object.entries(v.checks).filter(([, ok]) => !ok).map(([k]) => k));
        }
      }

      if (style.paper && utils.lum(style.paper) > CFG.darkMode.lumThresholdPaper) {
        style.paper = CFG.darkMode.paperMin;
      }
      if (style.ink && utils.lum(style.ink) < CFG.darkMode.lumThresholdInk) {
        style.ink = CFG.darkMode.inkMax;
      }

      tarjetaBase.style = style;

      let tarjeta = tarjetaBase;
      let tarjetaPresentacion = tarjetaBase;

      if (CFG.secondPass.enabled) {
        const secondPass = await runAppsScriptSecondPass(libro, ctx, extra, tarjetaBase);
        tarjeta = secondPass.tarjetaFinal;
        tarjetaPresentacion = secondPass.tarjetaPresentacion;
        tarjeta.style = style;
        tarjetaPresentacion.style = style;
      }

      console.log("   ✅ Completado");
      return {
        ...libro,
        ...extra,
        portada: String(libro.portada || libro.portada_url || "").trim() || `📚 ${libro.titulo}\n${libro.autor}`,
        tarjeta,
        tarjeta_base: tarjetaBase,
        tarjeta_presentacion: tarjetaPresentacion,
        videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(`${libro.titulo} ${libro.autor} entrevista español`)}`
      };
    } catch (error) {
      intento += 1;
      console.log(`   ❌ Error (${intento}/${CFG.processing.maxRetries + 1}): ${error.message}`);
      if (intento <= CFG.processing.maxRetries) {
        await sleep(CFG.processing.retrySleepMs);
        continue;
      }
      console.log("   🛡️  Fallback activado");
      break;
    }
  }

const tarjetaEmergencia = buildEmergencyTarjeta(libro);

return {
  ...libro,
  dimension: "Bienestar",
  punto: "Cero",
  palabras: ["inercia", "claridad", "foco", "presencia"],
  frases: [
    "🚶 Camina 10 pasos lentos sin pensar en nada más",
    "🧠 Nombra una idea que no debes seguir posponiendo",
    "📖 Abre el libro físico y ubica una sola línea vigente",
    "✨ Quédate 30 segundos quieto y escucha tu siguiente impulso"
  ],
  colores: ["#ff8a8a", "#ffb56b", "#8cabff", "#d288ff"],
  textColors: ["#FFFFFF", "#000000", "#000000", "#FFFFFF"],
  fondo: "#0a0a0a",
  portada: libro.portada || `📚 ${libro.titulo}`,
  tarjeta: tarjetaEmergencia,
  tarjeta_base: tarjetaEmergencia,
  tarjeta_presentacion: tarjetaEmergencia,
  fallbackUsed: true,
  videoUrl: `https://duckduckgo.com/?q=!ducky+site:youtube.com+${encodeURIComponent(libro.titulo || "")}`
};
}

/* ═══════════════════════════════════════════════════════════════
   📚 CARGA DE FUENTES
═══════════════════════════════════════════════════════════════ */

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const clean = String(value || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

async function loadCSVBooks() {
  const raw = await fs.readFile(CFG.files.csv, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true
  });

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
  const singlePayload = { libros: [enriched] };
  await writeJSON(CFG.files.outSingle, singlePayload);

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
  const rest = batchPayload.libros.filter((libro) => utils.uniqueKey(libro) !== key);
  const merged = [enriched, ...rest].slice(0, CFG.processing.maxBatch);

  await writeJSON(CFG.files.outBatch, { libros: merged });

  console.log(`✅ Modo SINGLE completado`);
  console.log(`📚 ${CFG.files.outBatch} actualizado — "${bookMeta.titulo}" en posición [0]`);
  console.log(`🧾 ${CFG.files.outSingle} actualizado — carril canónico single-book`);
}

async function writeBatchOutput(libros) {
  await writeJSON(CFG.files.outBatch, { libros });
  console.log(`✅ Modo BATCH completado`);
  console.log(`📚 ${CFG.files.outBatch} actualizado con ${libros.length} libros`);
}

/* ═══════════════════════════════════════════════════════════════
   🚀 MAIN
═══════════════════════════════════════════════════════════════ */

async function runSingle(ctx) {
  const singleSource = await loadSingleBookSource();
  if (!singleSource) {
    throw new Error("SINGLE_MODE activo pero no existe /tmp/triggui-book.json ni SINGLE_BOOK");
  }

  const bookMeta = mapSingleBookMeta(singleSource);

  if (!bookMeta.titulo || !bookMeta.autor) {
    throw new Error("Libro single inválido: faltan título o autor");
  }

  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  TRIGGUI v9.6.0 — MODO SINGLE (1 libro)      ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log(`📖 ${bookMeta.titulo} — ${bookMeta.autor}`);
  console.log(`🤖 ${CFG.model} | 🌡️  ${ctx.tempDinamica.toFixed(2)}`);
  console.log(`🧾 Prompt editorial: ${CFG.prompts.useExternalEditorial ? "EXTERNAL" : "LEGACY estable"}`);
  console.log(`🧪 Second pass Apps Script: ${CFG.secondPass.enabled ? "ON" : "OFF"}`);

  const enriched = await enrich(bookMeta, ctx);
  await writeSingleOutputs(bookMeta, enriched);
}

async function runBatch(ctx) {
  const books = await loadCSVBooks();
  const selected = utils.shuffle(books).slice(0, Math.min(CFG.processing.maxBatch, books.length));

  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   TRIGGUI v9.6.0 — MODO BATCH (contenido)    ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log(`📚 Fuente: ${CFG.files.csv}`);
  console.log(`📦 Libros a enriquecer: ${selected.length}`);
  console.log(`🤖 ${CFG.model} | 🌡️  ${ctx.tempDinamica.toFixed(2)}`);

  const out = [];

  for (let i = 0; i < selected.length; i += 1) {
    const libro = selected[i];
    console.log(`\n[${i + 1}/${selected.length}] ${libro.titulo} — ${libro.autor}`);

    const enriched = await enrich(libro, ctx);
    out.push(enriched);

    if ((i + 1) % CFG.processing.resetMemoryEvery === 0) {
      state.palabras.clear();
      state.colores.clear();
      console.log("   ♻️  Reset memoria anti-repetición");
    }

    if (i < selected.length - 1) {
      await sleep(CFG.processing.delayBetweenBooksMs);
    }
  }

  await writeBatchOutput(out);
}

async function main() {
  const ctx = getContexto();
  const singleMode = process.env.SINGLE_MODE === "true" || await fileExists(CFG.files.tmpBook);

  if (singleMode) {
    await runSingle(ctx);
  } else {
    await runBatch(ctx);
  }
}

main().catch((error) => {
  console.error("❌ build-contenido.js falló:", error);
  process.exit(1);
});
